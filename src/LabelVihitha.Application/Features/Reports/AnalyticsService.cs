using System.Globalization;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Features.Finance;
using LabelVihitha.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Reports;

public class AnalyticsService : IAnalyticsService
{
    private readonly IApplicationDbContext _db;
    private readonly ISalesCostingService _costing;
    public AnalyticsService(IApplicationDbContext db, ISalesCostingService costing)
    {
        _db = db;
        _costing = costing;
    }

    // A committed sale = order Confirmed or Fulfilled — shared with the costing service.
    private static readonly OrderStatus[] SoldStatuses = SalesCostingService.SoldStatuses;

    private static (DateTime from, DateTime to) Range(DateTime? from, DateTime? to)
    {
        var f = from ?? new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var t = to ?? DateTime.UtcNow.AddDays(1);
        return (f, t);
    }

    /// <summary>Canonical sold lines (single source of truth shared with P&amp;L).</summary>
    private async Task<IReadOnlyList<SoldLine>> FetchSoldLinesAsync(DateTime from, DateTime to, int? categoryId, CancellationToken ct)
        => await _costing.GetSoldLinesAsync(from, to, categoryId, ct);

    private static decimal Pct(decimal numerator, decimal denominator) =>
        denominator == 0 ? 0 : Math.Round(numerator / denominator * 100, 2);

    public async Task<DashboardSummary> GetDashboardSummaryAsync(DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var (f, t) = Range(from, to);
        var sales = await _costing.GetSalesTotalsAsync(f, t, ct);
        var (revenue, cost, margin) = (sales.Revenue, sales.Cogs, sales.GrossProfit);

        var outstanding = await _db.Invoices.AsNoTracking()
            .Where(i => i.PaymentStatus != PaymentStatus.Paid && i.PaymentStatus != PaymentStatus.Refunded)
            .SumAsync(i => (decimal?)(i.AmountDue - i.AmountPaid), ct) ?? 0m;

        var open = await _db.OrderFollowUps.AsNoTracking()
            .CountAsync(x => x.Status != FollowUpStatus.Resolved, ct);
        var now = DateTime.UtcNow;
        var overdue = await _db.OrderFollowUps.AsNoTracking()
            .CountAsync(x => x.Status != FollowUpStatus.Resolved && x.FollowUpDate != null && x.FollowUpDate < now, ct);
        var lowStock = await _db.Products.AsNoTracking()
            .CountAsync(p => p.IsActive && p.QuantityOnHand <= p.ReorderThreshold, ct);

        return new DashboardSummary(
            f, t, revenue, cost, margin, Pct(margin, revenue),
            sales.Orders, sales.Units,
            outstanding, open, overdue, lowStock);
    }

    public async Task<MarginReport> GetMarginAsync(DateTime? from, DateTime? to, int? categoryId, DateBucket bucket, CancellationToken ct = default)
    {
        var (f, t) = Range(from, to);
        var lines = await FetchSoldLinesAsync(f, t, categoryId, ct);

        var byCategory = lines
            .GroupBy(l => new { l.CategoryId, l.CategoryName })
            .Select(g =>
            {
                var cost = g.Sum(x => x.OriginalCost);
                var final = g.Sum(x => x.FinalRevenue);
                return new MarginByCategory(
                    g.Key.CategoryId, g.Key.CategoryName,
                    cost, g.Sum(x => x.SaleValue), final, g.Sum(x => x.Discount),
                    final - cost, Pct(final - cost, final), g.Sum(x => x.Quantity));
            })
            .OrderByDescending(r => r.FinalRevenue)
            .ToList();

        var byDate = lines
            .GroupBy(l => BucketKey(l.OrderDate, bucket))
            .OrderBy(g => g.Key.sort)
            .Select(g =>
            {
                var cost = g.Sum(x => x.OriginalCost);
                var final = g.Sum(x => x.FinalRevenue);
                return new MarginByDate(g.Key.label, cost, final, final - cost, Pct(final - cost, final));
            })
            .ToList();

        var totalCost = lines.Sum(l => l.OriginalCost);
        var totalFinal = lines.Sum(l => l.FinalRevenue);

        return new MarginReport(
            f, t, totalCost, lines.Sum(l => l.SaleValue), totalFinal, lines.Sum(l => l.Discount),
            totalFinal - totalCost, Pct(totalFinal - totalCost, totalFinal),
            lines.Sum(l => l.Quantity), lines.Select(l => l.OrderId).Distinct().Count(),
            byCategory, byDate);
    }

    public async Task<SalesByCategoryReport> GetSalesByCategoryAsync(DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var (f, t) = Range(from, to);
        var lines = await FetchSoldLinesAsync(f, t, null, ct);

        var rows = lines
            .GroupBy(l => new { l.CategoryId, l.CategoryName })
            .Select(g =>
            {
                var saleValue = g.Sum(x => x.SaleValue);
                var discount = g.Sum(x => x.Discount);
                return new SalesByCategoryRow(
                    g.Key.CategoryId, g.Key.CategoryName,
                    g.Sum(x => x.Quantity), g.Sum(x => x.FinalRevenue), saleValue,
                    discount, Pct(discount, saleValue));
            })
            .OrderByDescending(r => r.Revenue)
            .ToList();

        return new SalesByCategoryReport(f, t, rows);
    }

    public async Task<DiscountReport> GetDiscountAsync(DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var (f, t) = Range(from, to);
        var lines = await FetchSoldLinesAsync(f, t, null, ct);

        var rows = lines
            .GroupBy(l => new { l.CategoryId, l.CategoryName })
            .Select(g =>
            {
                var saleValue = g.Sum(x => x.SaleValue);
                var discount = g.Sum(x => x.Discount);
                return new DiscountRow(
                    g.Key.CategoryId, g.Key.CategoryName,
                    g.Count(), g.Count(x => x.Discount > 0),
                    saleValue, discount, Pct(discount, saleValue));
            })
            .OrderByDescending(r => r.TotalDiscount)
            .ToList();

        var totalSale = lines.Sum(l => l.SaleValue);
        var totalDiscount = lines.Sum(l => l.Discount);
        return new DiscountReport(f, t, totalDiscount, Pct(totalDiscount, totalSale), rows);
    }

    public async Task<InventoryValuationReport> GetInventoryValuationAsync(CancellationToken ct = default)
    {
        // Shared valuation basis (identical to the P&L snapshot), grouped by category in memory.
        var products = await _costing.GetValuationRowsAsync(ct);

        var rows = products
            .GroupBy(p => new { p.CategoryId, p.CategoryName })
            .Select(g => new InventoryValuationRow(
                g.Key.CategoryId, g.Key.CategoryName,
                g.Count(), g.Sum(p => p.QuantityOnHand),
                g.Sum(p => p.EffCost),
                g.Sum(p => p.EffSale)))
            .OrderByDescending(r => r.ValueAtSale)
            .ToList();

        return new InventoryValuationReport(
            rows.Sum(r => r.ValueAtOriginal), rows.Sum(r => r.ValueAtSale), rows.Sum(r => r.UnitsOnHand), rows);
    }

    public async Task<PaymentMethodReport> GetPaymentMethodsAsync(DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        var (f, t) = Range(from, to);
        var grouped = await _db.Payments.AsNoTracking()
            .Where(p => p.PaymentDate >= f && p.PaymentDate <= t)
            .GroupBy(p => p.Method)
            .Select(g => new { Method = g.Key, Count = g.Count(), Amount = g.Sum(x => x.Amount) })
            .ToListAsync(ct);

        var total = grouped.Sum(x => x.Amount);
        var rows = grouped
            .Select(x => new PaymentMethodRow(x.Method.ToString(), x.Count, x.Amount, Pct(x.Amount, total)))
            .OrderByDescending(r => r.AmountPaid)
            .ToList();

        return new PaymentMethodReport(f, t, total, rows);
    }

    public async Task<MoversReport> GetMoversAsync(DateTime? from, DateTime? to, int take, CancellationToken ct = default)
    {
        var (f, t) = Range(from, to);
        take = take is < 1 or > 50 ? 5 : take;
        var lines = await FetchSoldLinesAsync(f, t, null, ct);

        var sold = lines
            .GroupBy(l => new { l.ProductId, l.SKU, l.ProductName, l.CategoryName })
            .Select(g => new { g.Key, Units = g.Sum(x => x.Quantity), Revenue = g.Sum(x => x.FinalRevenue) })
            .ToList();

        var top = sold
            .OrderByDescending(x => x.Units).ThenByDescending(x => x.Revenue)
            .Take(take)
            .Select(x => new MoverRow(x.Key.ProductId, x.Key.SKU, x.Key.ProductName, x.Key.CategoryName, x.Units, x.Revenue, 0))
            .ToList();

        // Slow movers: active products with the fewest sales (including zero) in the window.
        var soldMap = sold.ToDictionary(x => x.Key.ProductId, x => x);
        var products = await _db.Products.AsNoTracking()
            .Where(p => p.IsActive)
            .Select(p => new { p.Id, p.SKU, p.Name, CategoryName = p.Category.Name, p.QuantityOnHand })
            .ToListAsync(ct);

        var slow = products
            .Select(p => new MoverRow(
                p.Id, p.SKU, p.Name, p.CategoryName,
                soldMap.TryGetValue(p.Id, out var s) ? s.Units : 0,
                soldMap.TryGetValue(p.Id, out var s2) ? s2.Revenue : 0m,
                p.QuantityOnHand))
            .OrderBy(x => x.UnitsSold).ThenByDescending(x => x.QuantityOnHand)
            .Take(take)
            .ToList();

        return new MoversReport(f, t, top, slow);
    }

    public async Task<FollowUpReport> GetFollowUpsAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var items = await _db.OrderFollowUps.AsNoTracking()
            .Select(x => new { x.Status, x.FollowUpDate, x.CreatedBy })
            .ToListAsync(ct);

        bool Overdue(DateTime? d, FollowUpStatus s) => d.HasValue && d < now && s != FollowUpStatus.Resolved;

        var byStaff = items
            .GroupBy(x => x.CreatedBy ?? "—")
            .Select(g => new FollowUpStaffRow(
                g.Key,
                g.Count(x => x.Status == FollowUpStatus.Open),
                g.Count(x => x.Status == FollowUpStatus.InProgress),
                g.Count(x => Overdue(x.FollowUpDate, x.Status))))
            .OrderByDescending(r => r.Open + r.InProgress)
            .ToList();

        return new FollowUpReport(
            items.Count(x => x.Status == FollowUpStatus.Open),
            items.Count(x => x.Status == FollowUpStatus.InProgress),
            items.Count(x => Overdue(x.FollowUpDate, x.Status)),
            byStaff);
    }

    // ---- date bucketing (in-memory) ----
    private static (string label, string sort) BucketKey(DateTime d, DateBucket bucket)
    {
        switch (bucket)
        {
            case DateBucket.Day:
                return (d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        d.ToString("yyyyMMdd", CultureInfo.InvariantCulture));
            case DateBucket.Week:
                var cal = CultureInfo.InvariantCulture.Calendar;
                var week = cal.GetWeekOfYear(d, CalendarWeekRule.FirstFourDayWeek, DayOfWeek.Monday);
                return ($"{d:yyyy} W{week:00}", $"{d:yyyy}{week:00}");
            case DateBucket.Month:
            default:
                return (d.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                        d.ToString("yyyyMM", CultureInfo.InvariantCulture));
        }
    }
}
