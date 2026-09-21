using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Features.Products;
using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Inventories;

public class InventoryGroupService : IInventoryGroupService
{
    private readonly IApplicationDbContext _db;

    // A committed sale = order Confirmed or Fulfilled.
    private static readonly Domain.Enums.OrderStatus[] SoldStatuses =
        { Domain.Enums.OrderStatus.Confirmed, Domain.Enums.OrderStatus.Fulfilled };

    public InventoryGroupService(IApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<InventoryDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default)
    {
        var q = _db.Inventories.AsNoTracking();
        if (!includeInactive) q = q.Where(i => i.IsActive);

        var inventories = await q.OrderBy(i => i.Name)
            .Select(i => new { i.Id, i.Name, i.Description, i.IsActive, i.PaidByOwnerId,
                PaidByOwnerName = i.PaidByOwner != null ? i.PaidByOwner.Name : null })
            .ToListAsync(ct);
        var ids = inventories.Select(i => i.Id).ToList();

        var breakdown = await BuildBreakdownAsync(ids, ct);
        var bills = await BuildBillsAsync(ids, ct);
        var sold = await BuildSoldAsync(ids, ct);
        var (directExp, unattributedExp) = await ExpenseAttributionAsync(ct);
        var totalInvRev = sold.Values.Sum(v => v.Revenue);

        return inventories.Select(i =>
        {
            var (units, cost, cats) = breakdown.TryGetValue(i.Id, out var b) ? b : (0, 0m, new List<CategoryCount>());
            var count = cats.Sum(c => c.ProductCount);
            var bl = bills.TryGetValue(i.Id, out var lst) ? lst : new List<InventoryBillDto>();
            var (rev, cogs) = sold.TryGetValue(i.Id, out var s) ? s : (0m, 0m);
            var billTotal = bl.Sum(x => x.Amount ?? 0m);
            // Operating expenses: this inventory's own tagged expenses + its share of untagged ones.
            // (Bills are capital, not expenses — they go into the initial cost below, not here.)
            var direct = directExp.GetValueOrDefault(i.Id);
            var alloc = Math.Round(direct + (totalInvRev > 0 ? unattributedExp * (rev / totalInvRev) : 0m), 2);
            return new InventoryDto(i.Id, i.Name, i.Description, i.IsActive, i.PaidByOwnerId, i.PaidByOwnerName,
                count, units, cost, cats, bl, billTotal,
                rev, cogs, cost + cogs + billTotal, rev - cogs, alloc, rev - cogs - alloc);
        }).ToList();
    }

    public async Task<InventoryDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var i = await _db.Inventories.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new { x.Id, x.Name, x.Description, x.IsActive, x.PaidByOwnerId,
                PaidByOwnerName = x.PaidByOwner != null ? x.PaidByOwner.Name : null })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException(nameof(Inventory), id);

        var breakdown = await BuildBreakdownAsync(new List<int> { id }, ct);
        var (units, cost, cats) = breakdown.TryGetValue(id, out var b) ? b : (0, 0m, new List<CategoryCount>());
        var bills = await BuildBillsAsync(new List<int> { id }, ct);
        var bl = bills.TryGetValue(id, out var lst) ? lst : new List<InventoryBillDto>();
        // Compute across all inventories so this one's expense share matches the list view.
        var allIds = await _db.Inventories.AsNoTracking().Select(x => x.Id).ToListAsync(ct);
        var allSold = await BuildSoldAsync(allIds, ct);
        var (rev, cogs) = allSold.TryGetValue(id, out var s) ? s : (0m, 0m);
        var totalInvRev = allSold.Values.Sum(v => v.Revenue);
        var (directExp, unattributedExp) = await ExpenseAttributionAsync(ct);
        var billTotal = bl.Sum(x => x.Amount ?? 0m);
        var direct = directExp.GetValueOrDefault(id);
        var alloc = Math.Round(direct + (totalInvRev > 0 ? unattributedExp * (rev / totalInvRev) : 0m), 2);
        return new InventoryDto(i.Id, i.Name, i.Description, i.IsActive, i.PaidByOwnerId, i.PaidByOwnerName,
            cats.Sum(c => c.ProductCount), units, cost, cats, bl, billTotal,
            rev, cogs, cost + cogs + billTotal, rev - cogs, alloc, rev - cogs - alloc);
    }

    /// <summary>Operating expenses split for per-inventory P&L: expenses tagged to a specific inventory
    /// (charged directly), and the remaining untagged pool (spread by each inventory's sales share).
    /// Supplier bills are added to each inventory's direct costs at the call site.</summary>
    private async Task<(Dictionary<int, decimal> DirectByInventory, decimal Unattributed)> ExpenseAttributionAsync(CancellationToken ct)
    {
        var rows = await _db.Expenses.AsNoTracking()
            .GroupBy(e => e.InventoryId)
            .Select(g => new { g.Key, Amount = g.Sum(x => x.Amount) })
            .ToListAsync(ct);
        var direct = rows.Where(r => r.Key != null).ToDictionary(r => r.Key!.Value, r => r.Amount);
        var unattributed = rows.Where(r => r.Key == null).Sum(r => r.Amount);
        return (direct, unattributed);
    }

    /// <summary>Revenue and cost of goods sold to date, per inventory, from committed sales.
    /// Prices are the snapshots taken at sale time; a sold line is attributed to its product's
    /// current inventory. Order-level service charges (stitching, shipping…) are revenue too, so
    /// each order's charges are spread across its inventoried lines in proportion to their revenue.
    /// Ignores query filters so sales of later-deleted products still count.</summary>
    private async Task<Dictionary<int, (decimal Revenue, decimal Cogs)>> BuildSoldAsync(List<int> inventoryIds, CancellationToken ct)
    {
        if (inventoryIds.Count == 0) return new();
        var lines = await _db.OrderItems.AsNoTracking().IgnoreQueryFilters()
            .Where(oi => !oi.IsDeleted && !oi.Order.IsDeleted && SoldStatuses.Contains(oi.Order.Status)
                         && oi.Product.InventoryId != null && inventoryIds.Contains(oi.Product.InventoryId.Value))
            .Select(oi => new
            {
                oi.OrderId,
                InvId = oi.Product.InventoryId!.Value,
                Revenue = oi.FinalPriceAtSale * oi.Quantity,
                Cogs = oi.OriginalPriceAtSale * oi.Quantity
            })
            .ToListAsync(ct);
        if (lines.Count == 0) return new();

        var orderIds = lines.Select(l => l.OrderId).Distinct().ToList();

        // Order-level service charges (add) for the orders that touch these inventories.
        var chargeByOrder = (await _db.OrderCharges.AsNoTracking()
                .Where(c => orderIds.Contains(c.OrderId))
                .GroupBy(c => c.OrderId)
                .Select(g => new { OrderId = g.Key, Amount = g.Sum(x => x.Amount) })
                .ToListAsync(ct))
            .ToDictionary(x => x.OrderId, x => x.Amount);

        // Order-level discounts (promo / manual; subtract).
        var discountByOrder = (await _db.Orders.AsNoTracking()
                .Where(o => orderIds.Contains(o.Id))
                .Select(o => new { o.Id, o.OrderDiscount })
                .ToListAsync(ct))
            .ToDictionary(x => x.Id, x => x.OrderDiscount);

        // Inventoried line revenue per order (denominator for spreading that order's adjustments).
        var orderLineRev = lines.GroupBy(l => l.OrderId).ToDictionary(g => g.Key, g => g.Sum(x => x.Revenue));

        var result = new Dictionary<int, (decimal Revenue, decimal Cogs)>();
        foreach (var l in lines)
        {
            // Net order-level adjustment = service charges − discounts, spread by line-revenue share.
            var adjust = chargeByOrder.GetValueOrDefault(l.OrderId) - discountByOrder.GetValueOrDefault(l.OrderId);
            var share = orderLineRev[l.OrderId] > 0 ? adjust * (l.Revenue / orderLineRev[l.OrderId]) : 0m;
            var cur = result.TryGetValue(l.InvId, out var v) ? v : (0m, 0m);
            result[l.InvId] = (cur.Item1 + l.Revenue + share, cur.Item2 + l.Cogs);
        }
        return result;
    }

    /// <summary>Bills attached to each inventory, newest first.</summary>
    private async Task<Dictionary<int, List<InventoryBillDto>>> BuildBillsAsync(List<int> inventoryIds, CancellationToken ct)
    {
        if (inventoryIds.Count == 0) return new();
        var rows = await _db.InventoryBills.AsNoTracking()
            .Where(x => inventoryIds.Contains(x.InventoryId))
            .OrderBy(x => x.Vendor != null ? x.Vendor.Name : "~").ThenByDescending(x => x.BillDate ?? x.CreatedAt)
            .Select(x => new { x.InventoryId, Dto = new InventoryBillDto(x.Id, x.FileUrl, x.FileName, x.Amount, x.BillDate, x.Note,
                x.VendorId, x.Vendor != null ? x.Vendor.Name : null) })
            .ToListAsync(ct);
        return rows.GroupBy(r => r.InventoryId).ToDictionary(g => g.Key, g => g.Select(r => r.Dto).ToList());
    }

    public async Task<InventoryBillDto> AddBillAsync(int inventoryId, AddInventoryBillRequest request, CancellationToken ct = default)
    {
        if (!await _db.Inventories.AnyAsync(i => i.Id == inventoryId, ct))
            throw new NotFoundException(nameof(Inventory), inventoryId);
        var hasFile = !string.IsNullOrWhiteSpace(request.FileUrl);
        // A bill line is meaningful if it carries either an attached invoice or an amount.
        if (!hasFile && !(request.Amount is > 0))
            throw new FluentValidation.ValidationException("A bill needs a file or an amount.");
        if (request.VendorId is int vid && !await _db.Vendors.AnyAsync(v => v.Id == vid && !v.IsDeleted, ct))
            throw new NotFoundException(nameof(Vendor), vid);

        var entity = new InventoryBill
        {
            InventoryId = inventoryId,
            VendorId = request.VendorId,
            FileUrl = hasFile ? request.FileUrl.Trim() : string.Empty,
            FileName = string.IsNullOrWhiteSpace(request.FileName) ? (hasFile ? "bill" : string.Empty) : request.FileName.Trim(),
            Amount = request.Amount is > 0 ? request.Amount : null,
            BillDate = request.BillDate,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim()
        };
        _db.InventoryBills.Add(entity);
        await _db.SaveChangesAsync(ct);
        var vendorName = entity.VendorId is int id
            ? await _db.Vendors.Where(v => v.Id == id).Select(v => v.Name).FirstOrDefaultAsync(ct) : null;
        return new InventoryBillDto(entity.Id, entity.FileUrl, entity.FileName, entity.Amount, entity.BillDate, entity.Note,
            entity.VendorId, vendorName);
    }

    public async Task DeleteBillAsync(int inventoryId, int billId, CancellationToken ct = default)
    {
        var bill = await _db.InventoryBills.FirstOrDefaultAsync(x => x.Id == billId && x.InventoryId == inventoryId, ct)
            ?? throw new NotFoundException(nameof(InventoryBill), billId);
        bill.IsDeleted = true;
        bill.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Split a shipping cost evenly across every on-hand unit in the inventory, add each unit's
    /// share to its product's cost, then reset the sale price to the given markup over the new cost.
    /// </summary>
    public async Task<ApplyShippingResult> ApplyShippingAsync(int inventoryId, ApplyShippingRequest request, CancellationToken ct = default)
    {
        if (!await _db.Inventories.AnyAsync(i => i.Id == inventoryId, ct))
            throw new NotFoundException(nameof(Inventory), inventoryId);
        if (request.AmountUsd <= 0) throw new ConflictException("Shipping amount must be greater than zero.");
        if (request.MarkupPercent < 0) throw new ConflictException("Markup can't be negative.");

        var products = await _db.Products
            .Include(p => p.Variants.Where(v => !v.IsDeleted))
            .Include(p => p.CostComponents.Where(c => !c.IsDeleted))
            .Where(p => p.InventoryId == inventoryId && !p.IsDeleted)
            .ToListAsync(ct);

        var totalUnits = products.Sum(p => p.QuantityOnHand);
        if (totalUnits <= 0) throw new ConflictException("This inventory has no units on hand to spread shipping across.");

        var perUnit = request.AmountUsd / totalUnits;          // full precision; money columns round on save
        var mult = 1m + request.MarkupPercent / 100m;
        var updated = 0;

        foreach (var p in products.Where(p => p.QuantityOnHand > 0))
        {
            // Add each unit's shipping share to the per-unit cost. Keep the cost-component ledger in
            // step for products that use it, so a later re-sum doesn't drop the shipping.
            if (p.CostComponents.Count > 0)
                p.CostComponents.Add(new ProductCostComponent { Label = "Shipping (allocated)", Amount = decimal.Round(perUnit, 2) });
            p.OriginalPrice = decimal.Round(p.OriginalPrice + perUnit, 2);
            p.SalePrice = decimal.Round(p.OriginalPrice * mult, 2);

            foreach (var v in p.Variants.Where(v => v.CostPrice != null))
            {
                v.CostPrice = decimal.Round(v.CostPrice!.Value + perUnit, 2);
                v.SalePrice = decimal.Round(v.CostPrice.Value * mult, 2);
            }
            p.UpdatedAt = DateTime.UtcNow;
            updated++;
        }

        await _db.SaveChangesAsync(ct);
        return new ApplyShippingResult(updated, totalUnits, decimal.Round(perUnit, 4), request.AmountUsd, request.MarkupPercent);
    }

    /// <summary>Reset every product's sale price to the given markup over its current cost. Cost is
    /// untouched — use this to fix a markup without re-charging shipping.</summary>
    public async Task<RepriceResult> RepriceAsync(int inventoryId, RepriceRequest request, CancellationToken ct = default)
    {
        if (!await _db.Inventories.AnyAsync(i => i.Id == inventoryId, ct))
            throw new NotFoundException(nameof(Inventory), inventoryId);
        if (request.MarkupPercent < 0) throw new ConflictException("Markup can't be negative.");

        var products = await _db.Products
            .Include(p => p.Variants.Where(v => !v.IsDeleted))
            .Where(p => p.InventoryId == inventoryId && !p.IsDeleted)
            .ToListAsync(ct);

        var mult = 1m + request.MarkupPercent / 100m;
        foreach (var p in products)
        {
            p.SalePrice = decimal.Round(p.OriginalPrice * mult, 2);
            foreach (var v in p.Variants)
                v.SalePrice = decimal.Round((v.CostPrice ?? p.OriginalPrice) * mult, 2);
            p.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
        return new RepriceResult(products.Count, request.MarkupPercent);
    }

    /// <summary>Per-inventory category → subcategory stock breakdown, plus total units and cost.</summary>
    private async Task<Dictionary<int, (int Units, decimal Cost, List<CategoryCount> Categories)>> BuildBreakdownAsync(
        List<int> inventoryIds, CancellationToken ct)
    {
        if (inventoryIds.Count == 0)
            return new();

        var rows = await _db.Products.AsNoTracking()
            .Where(p => !p.IsDeleted && p.InventoryId != null && inventoryIds.Contains(p.InventoryId.Value))
            .Select(p => new
            {
                InventoryId = p.InventoryId!.Value,
                p.CategoryId,
                CategoryName = p.Category.Name,
                p.SubCategoryId,
                SubCategoryName = p.SubCategory != null ? p.SubCategory.Name : null,
                p.QuantityOnHand,
                // Variant-aware cost: sizes with an override at their own cost, the rest at the product's.
                Cost = p.Variants.Where(v => !v.IsDeleted && v.CostPrice != null).Sum(v => (v.CostPrice ?? 0m) * v.QuantityOnHand)
                     + p.OriginalPrice * p.Variants.Where(v => !v.IsDeleted && v.CostPrice == null).Sum(v => v.QuantityOnHand)
            })
            .ToListAsync(ct);

        return rows
            .GroupBy(r => r.InventoryId)
            .ToDictionary(
                g => g.Key,
                g => (
                    g.Sum(x => x.QuantityOnHand),
                    g.Sum(x => x.Cost),
                    g.GroupBy(x => new { x.CategoryId, x.CategoryName })
                        .Select(cg => new CategoryCount(
                            cg.Key.CategoryId, cg.Key.CategoryName, cg.Count(), cg.Sum(x => x.QuantityOnHand),
                            cg.GroupBy(x => new { x.SubCategoryId, x.SubCategoryName })
                                .Select(sg => new SubCategoryCount(
                                    sg.Key.SubCategoryId, sg.Key.SubCategoryName ?? "Unassigned",
                                    sg.Count(), sg.Sum(x => x.QuantityOnHand)))
                                .OrderByDescending(s => s.ProductCount).ThenBy(s => s.SubCategoryName)
                                .ToList()))
                        .OrderBy(c => c.CategoryName)
                        .ToList()));
    }

    public async Task<InventoryDto> CreateAsync(CreateInventoryRequest request, CancellationToken ct = default)
    {
        await EnsureNameUniqueAsync(request.Name, null, ct);
        await EnsureOwnerValidAsync(request.PaidByOwnerId, ct);
        var entity = new Inventory { Name = request.Name.Trim(), Description = request.Description,
            PaidByOwnerId = request.PaidByOwnerId, IsActive = true };
        _db.Inventories.Add(entity);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(entity.Id, ct);
    }

    public async Task<InventoryDto> UpdateAsync(int id, UpdateInventoryRequest request, CancellationToken ct = default)
    {
        var entity = await _db.Inventories.FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotFoundException(nameof(Inventory), id);

        await EnsureNameUniqueAsync(request.Name, id, ct);
        await EnsureOwnerValidAsync(request.PaidByOwnerId, ct);

        entity.Name = request.Name.Trim();
        entity.Description = request.Description;
        entity.IsActive = request.IsActive;
        entity.PaidByOwnerId = request.PaidByOwnerId;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.Inventories.FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotFoundException(nameof(Inventory), id);

        // Detach products (they keep their category), then soft-delete the inventory.
        var products = await _db.Products.Where(p => p.InventoryId == id).ToListAsync(ct);
        foreach (var p in products) p.InventoryId = null;

        // Soft-delete the inventory's supplier bills too, so they stop counting as capital.
        var bills = await _db.InventoryBills.Where(b => b.InventoryId == id && !b.IsDeleted).ToListAsync(ct);
        foreach (var b in bills) { b.IsDeleted = true; b.UpdatedAt = DateTime.UtcNow; }

        entity.IsDeleted = true;
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>A chosen funding owner (if any) must exist.</summary>
    private async Task EnsureOwnerValidAsync(int? ownerId, CancellationToken ct)
    {
        if (ownerId is not int id) return;
        if (!await _db.Owners.AnyAsync(o => o.Id == id && !o.IsDeleted, ct))
            throw new NotFoundException(nameof(Owner), id);
    }

    private async Task EnsureNameUniqueAsync(string name, int? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        var exists = await _db.Inventories.AnyAsync(
            i => !i.IsDeleted && i.Name == normalized && (excludeId == null || i.Id != excludeId), ct);
        if (exists)
            throw new ConflictException($"An inventory named '{normalized}' already exists.");
    }
}
