namespace LabelVihitha.Application.Features.Finance;

public record ExpenseLineDto(int CategoryId, string CategoryName, decimal Amount, decimal Pct);

public record OwnerEquityDto(
    int OwnerId,
    string Name,
    decimal SharePercent,
    decimal Contributions,
    decimal Withdrawals,
    decimal ProfitShare,
    decimal Equity);

/// <summary>
/// Profit &amp; Loss for the selected period, plus a current inventory snapshot and the
/// to-date owner-equity ledger (contributions − withdrawals + allocated profit share).
/// </summary>
public record ProfitLossReport(
    DateTime From,
    DateTime To,

    // ---- P&L for the selected period ----
    decimal Revenue,
    decimal Cogs,
    decimal GrossProfit,
    decimal GrossMarginPct,
    decimal ExpensesTotal,
    IReadOnlyList<ExpenseLineDto> ExpensesByCategory,
    decimal NetProfit,
    decimal NetMarginPct,
    int OrderCount,
    int UnitsSold,

    // ---- Inventory on hand (current snapshot, at cost and at retail) ----
    decimal InventoryValueAtCost,
    decimal InventoryValueAtSale,
    int InventoryUnits,

    // ---- Owner equity (to date) ----
    decimal AllTimeNetProfit,
    decimal TotalSharePercent,
    IReadOnlyList<OwnerEquityDto> Owners,
    decimal TotalContributions,
    decimal TotalWithdrawals,
    decimal TotalOwnerEquity);
