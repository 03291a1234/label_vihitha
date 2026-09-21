using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Finance;

public class FinanceService : IFinanceService
{
    private readonly IApplicationDbContext _db;
    private readonly ISalesCostingService _costing;
    public FinanceService(IApplicationDbContext db, ISalesCostingService costing)
    {
        _db = db;
        _costing = costing;
    }

    private static (DateTime from, DateTime to) Range(DateTime? from, DateTime? to)
    {
        var f = from ?? new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        // ToDate is inclusive of the whole calendar day — sales/expenses carry a time-of-day,
        // so a same-day upper bound (e.g. the Today/Yesterday presets) must reach end of day.
        var t = to.HasValue ? to.Value.Date.AddDays(1).AddTicks(-1) : DateTime.UtcNow.AddDays(1);
        return (f, t);
    }

    private static decimal Pct(decimal numerator, decimal denominator) =>
        denominator == 0 ? 0 : Math.Round(numerator / denominator * 100, 2);

    /// <summary>Operating expenses in a range (Expenses tab only). Supplier bills are NOT expenses —
    /// they're capitalised into Total Investment.</summary>
    private async Task<decimal> ExpensesTotalAsync(DateTime f, DateTime t, CancellationToken ct) =>
        await _db.Expenses.AsNoTracking().Where(e => e.Date >= f && e.Date <= t)
            .SumAsync(e => (decimal?)e.Amount, ct) ?? 0m;

    public async Task<ProfitLossReport> GetProfitAndLossAsync(DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var (f, t) = Range(from, to);

        // ---- P&L for the selected period ----
        var sales = await _costing.GetSalesTotalsAsync(f, t, ct);
        var (revenue, cogs, orders, units) = (sales.Revenue, sales.Cogs, sales.Orders, sales.Units);
        var grossProfit = sales.GrossProfit;

        var expenseRows = await _db.Expenses.AsNoTracking()
            .Where(e => e.Date >= f && e.Date <= t)
            .Select(e => new { e.ExpenseCategoryId, CategoryName = e.ExpenseCategory.Name, e.Amount })
            .ToListAsync(ct);
        var expensesTotal = expenseRows.Sum(r => r.Amount);
        var expensesByCategory = expenseRows
            .GroupBy(r => new { r.ExpenseCategoryId, r.CategoryName })
            .Select(g => new ExpenseLineDto(g.Key.ExpenseCategoryId, g.Key.CategoryName, g.Sum(x => x.Amount),
                Pct(g.Sum(x => x.Amount), expensesTotal)))
            .OrderByDescending(x => x.Amount)
            .ToList();

        var netProfit = grossProfit - expensesTotal;

        // ---- Inventory on hand (current snapshot) — shared valuation (same basis as Analytics) ----
        var inv = await _costing.GetValuationRowsAsync(ct);
        var invCost = inv.Sum(p => p.EffCost);
        var invSale = inv.Sum(p => p.EffSale);
        var invUnits = inv.Sum(p => p.QuantityOnHand);

        // Split current stock (at cost) by the owner who funded it. The funder is set on the
        // Inventory; a product may override it with its own PaidByOwner. null = jointly funded.
        var fundedByOwner = inv
            .Select(p => new
            {
                OwnerId = p.ProductOwnerId ?? p.InvOwnerId,
                OwnerName = p.ProductOwnerName ?? p.InvOwnerName,
                Cost = p.EffCost,
                Units = p.QuantityOnHand
            })
            .GroupBy(x => new { x.OwnerId, x.OwnerName })
            .Select(g => new OwnerInventoryDto(
                g.Key.OwnerId,
                g.Key.OwnerName ?? "Jointly funded / unassigned",
                g.Sum(x => x.Cost),
                g.Sum(x => x.Units)))
            .OrderByDescending(x => x.InventoryCost)
            .ToList();

        // Amount spent per vendor (current stock, at cost), broken down by inventory batch.
        // Component-aware: a product with cost lines splits its cost across each line's vendor
        // (lines to the same vendor are merged first, so a piece's units count once per vendor
        // it involves); a product without lines attributes its whole cost to its own vendor.
        var spendLines = inv.SelectMany(p =>
            p.Components.Count > 0
                ? p.Components
                    .GroupBy(c => new { c.VendorId, c.VendorName })
                    .Select(g => new
                    {
                        g.Key.VendorId, g.Key.VendorName,
                        p.InventoryId, p.InventoryName,
                        Cost = g.Sum(x => x.Amount) * p.QuantityOnHand,
                        Units = p.QuantityOnHand
                    })
                : new[]
                {
                    new
                    {
                        p.VendorId, VendorName = p.VendorName,
                        p.InventoryId, p.InventoryName,
                        Cost = p.EffCost,
                        Units = p.QuantityOnHand
                    }
                })
            .ToList();

        var spendByVendor = spendLines
            .GroupBy(x => new { x.VendorId, x.VendorName })
            .Select(vg => new VendorSpendDto(
                vg.Key.VendorId,
                vg.Key.VendorName ?? "No vendor",
                vg.Sum(x => x.Cost),
                vg.Sum(x => x.Units),
                vg.GroupBy(x => new { x.InventoryId, x.InventoryName })
                    .Select(ig => new VendorSpendInventoryDto(
                        ig.Key.InventoryId,
                        ig.Key.InventoryName ?? "No inventory",
                        ig.Sum(x => x.Cost),
                        ig.Sum(x => x.Units)))
                    .OrderByDescending(i => i.Cost)
                    .ToList()))
            .OrderByDescending(v => v.TotalCost)
            .ToList();

        // ---- Owner equity (to date): allocate all-time retained profit by share ----
        var allSales = await _costing.GetSalesTotalsAsync(
            new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc), DateTime.UtcNow.AddDays(1), ct);
        var (allRev, allCogs) = (allSales.Revenue, allSales.Cogs);
        var allExpenses = await ExpensesTotalAsync(
            new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc), DateTime.UtcNow.AddDays(1), ct);
        var allTimeNetProfit = allRev - allCogs - allExpenses;

        // ---- Total investment ----
        // Supplier bills attached to inventories — capitalised acquisition costs (stitching, cloth…),
        // NOT operating expenses. They count toward Total Investment.
        // Only bills on live inventories count — a soft-deleted inventory's bills leave with it.
        var totalBillsRecorded = await _db.InventoryBills.AsNoTracking()
            .Where(x => !x.Inventory.IsDeleted)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        // Capital deployed to date = everything bought/spent: stock still on hand (at cost) + cost of
        // goods already sold + supplier bills + operating expenses. This is where the money went.
        var capitalDeployed = invCost + allCogs + totalBillsRecorded + allExpenses;

        var owners = await _db.Owners.AsNoTracking()
            .Where(o => o.IsActive)
            .Select(o => new
            {
                o.Id, o.Name, o.ProfitSharePercent,
                Contributions = o.Transactions.Where(x => !x.IsDeleted && x.Type == OwnerTransactionType.Contribution).Sum(x => (decimal?)x.Amount) ?? 0m,
                Withdrawals = o.Transactions.Where(x => !x.IsDeleted && x.Type == OwnerTransactionType.Withdrawal).Sum(x => (decimal?)x.Amount) ?? 0m
            })
            .ToListAsync(ct);

        // Total invested = the owners' own capital put in (contributions net of withdrawals). Inventory
        // bought with sales revenue (e.g. a new batch funded from earnings) is NOT counted as investment.
        var totalInvested = owners.Sum(o => o.Contributions) - owners.Sum(o => o.Withdrawals);

        var ownerRows = owners
            .Select(o =>
            {
                var share = Math.Round(allTimeNetProfit * o.ProfitSharePercent / 100m, 2);
                return new OwnerEquityDto(o.Id, o.Name, o.ProfitSharePercent, o.Contributions, o.Withdrawals,
                    share, o.Contributions - o.Withdrawals + share);
            })
            .OrderByDescending(o => o.SharePercent).ThenBy(o => o.Name)
            .ToList();

        return new ProfitLossReport(
            f, t,
            revenue, cogs, grossProfit, Pct(grossProfit, revenue),
            expensesTotal, expensesByCategory, netProfit, Pct(netProfit, revenue),
            orders, units,
            invCost, invSale, invUnits,
            allTimeNetProfit,
            owners.Sum(o => o.ProfitSharePercent),
            ownerRows,
            ownerRows.Sum(o => o.Contributions),
            ownerRows.Sum(o => o.Withdrawals),
            ownerRows.Sum(o => o.Equity),
            fundedByOwner,
            spendByVendor,
            allCogs,
            allExpenses,
            totalBillsRecorded,
            totalInvested,
            capitalDeployed,
            allRev);
    }
}
