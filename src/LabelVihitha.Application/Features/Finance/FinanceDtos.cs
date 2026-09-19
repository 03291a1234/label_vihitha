namespace LabelVihitha.Application.Features.Finance;

public record ExpenseLineDto(int CategoryId, string CategoryName, decimal Amount, decimal Pct);

/// <summary>Current on-hand inventory (at cost) attributed to the owner who funded it.
/// A null <see cref="OwnerId"/> is the "jointly funded / unassigned" bucket.</summary>
public record OwnerInventoryDto(int? OwnerId, string OwnerName, decimal InventoryCost, int Units);

/// <summary>One inventory batch's slice of a vendor's spend (current stock, at cost).
/// A null <see cref="InventoryId"/> is the "no inventory" bucket.</summary>
public record VendorSpendInventoryDto(int? InventoryId, string InventoryName, decimal Cost, int Units);

/// <summary>Amount spent with a vendor on current on-hand stock (at cost), broken down
/// by inventory batch. A null <see cref="VendorId"/> is the "no vendor" bucket.</summary>
public record VendorSpendDto(int? VendorId, string VendorName, decimal TotalCost, int Units,
    IReadOnlyList<VendorSpendInventoryDto> Inventories);

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
    decimal TotalOwnerEquity,

    // ---- Current inventory (at cost) split by the owner who funded it ----
    IReadOnlyList<OwnerInventoryDto> InventoryFundedByOwner,

    // ---- Amount spent per vendor (current stock, at cost), broken down by inventory ----
    IReadOnlyList<VendorSpendDto> SpendByVendor,

    // ---- Total investment reconciliation (all-time) ----
    // Money put into inventory to date = stock still on hand (at cost) + cost of goods already sold.
    decimal AllTimeCogs,
    // All operating expenses to date.
    decimal AllTimeExpenses,
    // Sum of amounts on supplier bills attached to inventories (documented actual spend).
    decimal TotalBillsRecorded,
    // Authoritative total capital deployed to date = stock on hand at cost + all-time COGS + all-time expenses.
    decimal TotalInvested);
