using LabelVihitha.Application.Features.Finance;
using LabelVihitha.Application.Features.Reports;
using LabelVihitha.Domain.Entities;
using LabelVihitha.Domain.Enums;
using LabelVihitha.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace LabelVihitha.Application.Tests;

/// <summary>
/// Locks the single-source-of-truth invariant for money: P&amp;L (FinanceService) and Analytics
/// (AnalyticsService) must report the same revenue/COGS/valuation because both consume
/// <see cref="SalesCostingService"/>. These guard the class of divergence bugs we hit before.
/// </summary>
public class CostingTests
{
    private static ApplicationDbContext NewDb() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"lv-tests-{Guid.NewGuid()}")
            .Options);

    /// <summary>Seeds one category + product (with a variant), and returns the product.</summary>
    private static Product SeedProduct(ApplicationDbContext db, decimal cost = 100m, decimal sale = 150m,
        int qty = 10, decimal? variantCostOverride = null)
    {
        var cat = new Category { Name = "Sarees", IsActive = true };
        db.Categories.Add(cat);
        db.SaveChanges();

        var p = new Product
        {
            CategoryId = cat.Id, SKU = "S1", Name = "Test Saree",
            OriginalPrice = cost, SalePrice = sale, QuantityOnHand = qty, IsActive = true,
            Variants = new List<ProductVariant>
            {
                new() { Size = "M", QuantityOnHand = qty, CostPrice = variantCostOverride, SalePrice = null }
            }
        };
        db.Products.Add(p);
        db.SaveChanges();
        return p;
    }

    /// <summary>Adds an order with one line + optional charge/discount. Returns the order.</summary>
    private static Order SeedOrder(ApplicationDbContext db, int productId, OrderStatus status,
        int qty, decimal originalAtSale, decimal saleAtSale, decimal finalAtSale,
        decimal lineDiscount = 0m, decimal orderDiscount = 0m, decimal charge = 0m)
    {
        var order = new Order
        {
            OrderNumber = $"O-{Guid.NewGuid():N}".Substring(0, 8),
            CustomerId = 1, OrderDate = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
            Status = status, OrderDiscount = orderDiscount,
            Items = new List<OrderItem>
            {
                new()
                {
                    ProductId = productId, Quantity = qty,
                    OriginalPriceAtSale = originalAtSale, SalePriceAtSale = saleAtSale,
                    FinalPriceAtSale = finalAtSale, DiscountAmount = lineDiscount,
                    LineTotal = finalAtSale * qty
                }
            }
        };
        if (charge > 0)
            order.Charges = new List<OrderCharge> { new() { Label = "Stitching", Amount = charge } };
        db.Orders.Add(order);
        db.SaveChanges();
        return order;
    }

    private static readonly DateTime From = new(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime To = new(2100, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task SalesTotals_exclude_pending_and_cancelled_orders()
    {
        using var db = NewDb();
        var p = SeedProduct(db);
        SeedOrder(db, p.Id, OrderStatus.Confirmed, qty: 2, originalAtSale: 100, saleAtSale: 150, finalAtSale: 150);
        SeedOrder(db, p.Id, OrderStatus.Pending,   qty: 5, originalAtSale: 100, saleAtSale: 150, finalAtSale: 150);
        SeedOrder(db, p.Id, OrderStatus.Cancelled, qty: 9, originalAtSale: 100, saleAtSale: 150, finalAtSale: 150);

        var totals = await new SalesCostingService(db).GetSalesTotalsAsync(From, To);

        Assert.Equal(300m, totals.Revenue);   // only the Confirmed order: 150 * 2
        Assert.Equal(200m, totals.Cogs);      // 100 * 2
        Assert.Equal(1, totals.Orders);
        Assert.Equal(2, totals.Units);
    }

    [Fact]
    public async Task SalesTotals_net_order_discount_and_add_charges()
    {
        using var db = NewDb();
        var p = SeedProduct(db);
        // line: 140 final * 2 = 280; minus order discount 10; plus charge 20 => 290 revenue
        SeedOrder(db, p.Id, OrderStatus.Fulfilled, qty: 2, originalAtSale: 100, saleAtSale: 150,
            finalAtSale: 140, lineDiscount: 10, orderDiscount: 10, charge: 20);

        var totals = await new SalesCostingService(db).GetSalesTotalsAsync(From, To);

        Assert.Equal(290m, totals.Revenue);
        Assert.Equal(200m, totals.Cogs);
        Assert.Equal(20m, totals.Charges);
        Assert.Equal(10m, totals.OrderDiscounts);
    }

    [Fact]
    public async Task SoldLines_still_count_when_product_is_soft_deleted()
    {
        // The historical divergence bug: a sale of a later-deleted product must still count.
        using var db = NewDb();
        var p = SeedProduct(db);
        SeedOrder(db, p.Id, OrderStatus.Confirmed, qty: 2, originalAtSale: 100, saleAtSale: 150, finalAtSale: 150);

        p.IsDeleted = true;
        db.SaveChanges();

        var totals = await new SalesCostingService(db).GetSalesTotalsAsync(From, To);
        Assert.Equal(300m, totals.Revenue);
        Assert.Equal(1, totals.Orders);
    }

    [Fact]
    public async Task Valuation_is_variant_aware()
    {
        using var db = NewDb();
        // Variant overrides cost at 120; product fallback cost is 100. 10 units => 1200 at cost.
        SeedProduct(db, cost: 100m, sale: 150m, qty: 10, variantCostOverride: 120m);

        var rows = await new SalesCostingService(db).GetValuationRowsAsync();
        var row = Assert.Single(rows);
        Assert.Equal(1200m, row.EffCost);   // 120 * 10 (variant override)
        Assert.Equal(1500m, row.EffSale);   // 150 * 10 (product fallback, variant sale null)
    }

    [Fact]
    public async Task PnL_and_Dashboard_report_the_same_revenue_cost_and_valuation()
    {
        using var db = NewDb();
        var p = SeedProduct(db, cost: 100m, sale: 150m, qty: 10, variantCostOverride: 120m);
        SeedOrder(db, p.Id, OrderStatus.Confirmed, qty: 3, originalAtSale: 100, saleAtSale: 150,
            finalAtSale: 150, orderDiscount: 15, charge: 30);

        var costing = new SalesCostingService(db);
        var pnl = await new FinanceService(db, costing).GetProfitAndLossAsync(null, null);
        var dash = await new AnalyticsService(db, costing).GetDashboardSummaryAsync(null, null);
        var valuation = await new AnalyticsService(db, costing).GetInventoryValuationAsync();

        // The invariant: the two dashboards can never disagree on the core numbers.
        Assert.Equal(pnl.Revenue, dash.TotalRevenue);
        Assert.Equal(pnl.Cogs, dash.TotalCost);
        Assert.Equal(pnl.InventoryValueAtCost, valuation.TotalAtOriginal);
        Assert.Equal(pnl.InventoryValueAtSale, valuation.TotalAtSale);

        // And the concrete values: revenue 150*3 - 15 + 30 = 465; cogs 100*3 = 300.
        Assert.Equal(465m, pnl.Revenue);
        Assert.Equal(300m, pnl.Cogs);
        Assert.Equal(1200m, pnl.InventoryValueAtCost);
    }
}
