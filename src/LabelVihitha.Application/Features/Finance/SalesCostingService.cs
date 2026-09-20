using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Finance;

/// <summary>One flattened committed-sale line — the shared basis for P&amp;L, dashboard,
/// margin, sales-by-category, discounts and movers.</summary>
public sealed record SoldLine(
    int OrderId, DateTime OrderDate,
    int CategoryId, string CategoryName,
    int ProductId, string SKU, string ProductName,
    int Quantity, decimal OriginalCost, decimal SaleValue, decimal FinalRevenue, decimal Discount);

/// <summary>Period sales totals. Revenue already nets order-level discounts and adds service charges.</summary>
public sealed record SalesTotals(decimal Revenue, decimal Cogs, int Orders, int Units, decimal Charges, decimal OrderDiscounts)
{
    public decimal GrossProfit => Revenue - Cogs;
}

/// <summary>One cost line (cloth, stitching…) attributed to a vendor.</summary>
public sealed record CostComponentRow(int? VendorId, string? VendorName, decimal Amount);

/// <summary>Current on-hand valuation for one product, variant-aware, with the funding/vendor
/// context the finance breakdowns need.</summary>
public sealed record ProductValuationRow(
    int ProductId, int CategoryId, string CategoryName,
    int QuantityOnHand, decimal EffCost, decimal EffSale,
    int? ProductOwnerId, string? ProductOwnerName,
    int? InvOwnerId, string? InvOwnerName,
    int? VendorId, string? VendorName,
    int? InventoryId, string? InventoryName,
    IReadOnlyList<CostComponentRow> Components);

/// <summary>
/// Single source of truth for "what sold" and "what's on hand at cost/sale". P&amp;L (FinanceService)
/// and Analytics (AnalyticsService) both consume this so their revenue, COGS and valuation can never
/// drift apart (they used to — this consolidation removes the divergence class of bugs).
/// </summary>
public interface ISalesCostingService
{
    Task<IReadOnlyList<SoldLine>> GetSoldLinesAsync(DateTime from, DateTime to, int? categoryId, CancellationToken ct = default);
    Task<SalesTotals> GetSalesTotalsAsync(DateTime from, DateTime to, CancellationToken ct = default);
    Task<IReadOnlyList<ProductValuationRow>> GetValuationRowsAsync(CancellationToken ct = default);
}

public sealed class SalesCostingService : ISalesCostingService
{
    private readonly IApplicationDbContext _db;
    public SalesCostingService(IApplicationDbContext db) => _db = db;

    /// <summary>A committed sale = order Confirmed or Fulfilled (Pending excluded, Cancelled restocked).</summary>
    public static readonly OrderStatus[] SoldStatuses = { OrderStatus.Confirmed, OrderStatus.Fulfilled };

    public async Task<IReadOnlyList<SoldLine>> GetSoldLinesAsync(DateTime from, DateTime to, int? categoryId, CancellationToken ct = default)
    {
        // Ignore soft-delete filters so historical sales still count when a product (or its category)
        // was later deleted — otherwise reports drift below reality. Re-apply the non-deleted filters
        // for the order line and its order explicitly.
        var q = _db.OrderItems.AsNoTracking().IgnoreQueryFilters()
            .Where(i => !i.IsDeleted && !i.Order.IsDeleted
                        && SoldStatuses.Contains(i.Order.Status)
                        && i.Order.OrderDate >= from && i.Order.OrderDate <= to);
        if (categoryId is int cid)
            q = q.Where(i => i.Product.CategoryId == cid);

        return await q.Select(i => new SoldLine(
            i.OrderId, i.Order.OrderDate,
            i.Product.CategoryId, i.Product.Category.Name,
            i.ProductId, i.Product.SKU, i.Product.Name,
            i.Quantity,
            i.OriginalPriceAtSale * i.Quantity,
            i.SalePriceAtSale * i.Quantity,
            i.FinalPriceAtSale * i.Quantity,
            i.DiscountAmount * i.Quantity))
            .ToListAsync(ct);
    }

    public async Task<SalesTotals> GetSalesTotalsAsync(DateTime from, DateTime to, CancellationToken ct = default)
    {
        var lines = await GetSoldLinesAsync(from, to, null, ct);

        // Order-level discounts (promo / manual) reduce what the customer actually paid, so they
        // reduce revenue — the per-line FinalPriceAtSale doesn't include them.
        var orderDiscounts = await _db.Orders.AsNoTracking()
            .Where(o => SoldStatuses.Contains(o.Status) && o.OrderDate >= from && o.OrderDate <= to)
            .SumAsync(o => (decimal?)o.OrderDiscount, ct) ?? 0m;

        // Additional service charges (stitching, shipping…) are revenue the customer paid, with no
        // cost of goods — add them on top of the product line revenue.
        var charges = await _db.OrderCharges.AsNoTracking()
            .Where(c => SoldStatuses.Contains(c.Order.Status) && c.Order.OrderDate >= from && c.Order.OrderDate <= to)
            .SumAsync(c => (decimal?)c.Amount, ct) ?? 0m;

        var revenue = lines.Sum(l => l.FinalRevenue) - orderDiscounts + charges;
        var cogs = lines.Sum(l => l.OriginalCost);
        return new SalesTotals(revenue, cogs,
            lines.Select(l => l.OrderId).Distinct().Count(),
            lines.Sum(l => l.Quantity), charges, orderDiscounts);
    }

    public async Task<IReadOnlyList<ProductValuationRow>> GetValuationRowsAsync(CancellationToken ct = default)
    {
        return await _db.Products.AsNoTracking().Where(p => p.IsActive)
            .Select(p => new ProductValuationRow(
                p.Id, p.CategoryId, p.Category.Name,
                p.QuantityOnHand,
                // Variant-aware valuation: sizes with an override at their own price, the rest at the product's.
                p.Variants.Where(v => !v.IsDeleted && v.CostPrice != null).Sum(v => (v.CostPrice ?? 0m) * v.QuantityOnHand)
                    + p.OriginalPrice * p.Variants.Where(v => !v.IsDeleted && v.CostPrice == null).Sum(v => v.QuantityOnHand),
                p.Variants.Where(v => !v.IsDeleted && v.SalePrice != null).Sum(v => (v.SalePrice ?? 0m) * v.QuantityOnHand)
                    + p.SalePrice * p.Variants.Where(v => !v.IsDeleted && v.SalePrice == null).Sum(v => v.QuantityOnHand),
                p.PaidByOwnerId,
                p.PaidByOwner != null ? p.PaidByOwner.Name : null,
                p.Inventory != null ? p.Inventory.PaidByOwnerId : null,
                p.Inventory != null && p.Inventory.PaidByOwner != null ? p.Inventory.PaidByOwner.Name : null,
                p.VendorId,
                p.Vendor != null ? p.Vendor.Name : null,
                p.InventoryId,
                p.Inventory != null ? p.Inventory.Name : null,
                p.CostComponents.Where(c => !c.IsDeleted)
                    .Select(c => new CostComponentRow(c.VendorId, c.Vendor != null ? c.Vendor.Name : null, c.Amount))
                    .ToList()))
            .ToListAsync(ct);
    }
}
