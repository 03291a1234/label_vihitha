using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Finance;

public class FinanceService : IFinanceService
{
    private readonly IApplicationDbContext _db;
    public FinanceService(IApplicationDbContext db) => _db = db;

    // A committed sale = order Confirmed or Fulfilled (Pending excluded, Cancelled restocked).
    private static readonly OrderStatus[] SoldStatuses = { OrderStatus.Confirmed, OrderStatus.Fulfilled };

    private static (DateTime from, DateTime to) Range(DateTime? from, DateTime? to)
    {
        var f = from ?? new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var t = to ?? DateTime.UtcNow.AddDays(1);
        return (f, t);
    }

    private static decimal Pct(decimal numerator, decimal denominator) =>
        denominator == 0 ? 0 : Math.Round(numerator / denominator * 100, 2);

    /// <summary>Committed sales revenue and cost of goods sold in a date range.</summary>
    private async Task<(decimal Revenue, decimal Cogs, int Orders, int Units)> SalesAsync(DateTime f, DateTime t, CancellationToken ct)
    {
        var lines = await _db.OrderItems.AsNoTracking()
            .Where(i => SoldStatuses.Contains(i.Order.Status) && i.Order.OrderDate >= f && i.Order.OrderDate <= t)
            .Select(i => new { i.OrderId, Revenue = i.FinalPriceAtSale * i.Quantity, Cost = i.OriginalPriceAtSale * i.Quantity, i.Quantity })
            .ToListAsync(ct);
        return (lines.Sum(l => l.Revenue), lines.Sum(l => l.Cost),
                lines.Select(l => l.OrderId).Distinct().Count(), lines.Sum(l => l.Quantity));
    }

    private async Task<decimal> ExpensesTotalAsync(DateTime f, DateTime t, CancellationToken ct) =>
        await _db.Expenses.AsNoTracking().Where(e => e.Date >= f && e.Date <= t)
            .SumAsync(e => (decimal?)e.Amount, ct) ?? 0m;

    public async Task<ProfitLossReport> GetProfitAndLossAsync(DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var (f, t) = Range(from, to);

        // ---- P&L for the selected period ----
        var (revenue, cogs, orders, units) = await SalesAsync(f, t, ct);
        var grossProfit = revenue - cogs;

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

        // ---- Inventory on hand (current snapshot) ----
        var inv = await _db.Products.AsNoTracking().Where(p => p.IsActive)
            .Select(p => new { p.OriginalPrice, p.SalePrice, p.QuantityOnHand,
                p.PaidByOwnerId, PaidByOwnerName = p.PaidByOwner != null ? p.PaidByOwner.Name : null })
            .ToListAsync(ct);
        var invCost = inv.Sum(p => p.OriginalPrice * p.QuantityOnHand);
        var invSale = inv.Sum(p => p.SalePrice * p.QuantityOnHand);
        var invUnits = inv.Sum(p => p.QuantityOnHand);

        // Split current stock (at cost) by the owner who funded it; null = jointly funded.
        var fundedByOwner = inv
            .GroupBy(p => new { p.PaidByOwnerId, p.PaidByOwnerName })
            .Select(g => new OwnerInventoryDto(
                g.Key.PaidByOwnerId,
                g.Key.PaidByOwnerName ?? "Jointly funded / unassigned",
                g.Sum(x => x.OriginalPrice * x.QuantityOnHand),
                g.Sum(x => x.QuantityOnHand)))
            .OrderByDescending(x => x.InventoryCost)
            .ToList();

        // ---- Owner equity (to date): allocate all-time retained profit by share ----
        var (allRev, allCogs, _, _) = await SalesAsync(
            new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc), DateTime.UtcNow.AddDays(1), ct);
        var allExpenses = await ExpensesTotalAsync(
            new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc), DateTime.UtcNow.AddDays(1), ct);
        var allTimeNetProfit = allRev - allCogs - allExpenses;

        var owners = await _db.Owners.AsNoTracking()
            .Where(o => o.IsActive)
            .Select(o => new
            {
                o.Id, o.Name, o.ProfitSharePercent,
                Contributions = o.Transactions.Where(x => !x.IsDeleted && x.Type == OwnerTransactionType.Contribution).Sum(x => (decimal?)x.Amount) ?? 0m,
                Withdrawals = o.Transactions.Where(x => !x.IsDeleted && x.Type == OwnerTransactionType.Withdrawal).Sum(x => (decimal?)x.Amount) ?? 0m
            })
            .ToListAsync(ct);

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
            fundedByOwner);
    }
}
