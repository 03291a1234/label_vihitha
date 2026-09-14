namespace LabelVihitha.Application.Features.Reports;

public enum DateBucket { Day, Week, Month }

// ---- Dashboard summary (KPI cards) ----
public record DashboardSummary(
    DateTime FromDate,
    DateTime ToDate,
    decimal TotalRevenue,
    decimal TotalCost,
    decimal GrossMargin,
    decimal MarginPercent,
    int OrderCount,
    int UnitsSold,
    decimal OutstandingInvoiceAmount,
    int OpenFollowUps,
    int OverdueFollowUps,
    int LowStockCount);

// ---- Margin report ----
public record MarginByCategory(
    int CategoryId, string CategoryName,
    decimal OriginalCost, decimal SaleValue, decimal FinalRevenue,
    decimal Discount, decimal Margin, decimal MarginPercent, int UnitsSold);

public record MarginByDate(
    string Bucket, decimal OriginalCost, decimal FinalRevenue, decimal Margin, decimal MarginPercent);

public record MarginReport(
    DateTime FromDate, DateTime ToDate,
    decimal TotalOriginalCost, decimal TotalSaleValue, decimal TotalFinalRevenue,
    decimal TotalDiscount, decimal GrossMargin, decimal MarginPercent,
    int UnitsSold, int OrderCount,
    IReadOnlyList<MarginByCategory> ByCategory,
    IReadOnlyList<MarginByDate> ByDate);

// ---- Sales by category ----
public record SalesByCategoryRow(
    int CategoryId, string CategoryName,
    int UnitsSold, decimal Revenue, decimal SaleValue,
    decimal DiscountTotal, decimal AvgDiscountPercentOffSale);

public record SalesByCategoryReport(
    DateTime FromDate, DateTime ToDate, IReadOnlyList<SalesByCategoryRow> Rows);

// ---- Discount / negotiation ----
public record DiscountRow(
    int CategoryId, string CategoryName,
    int LineCount, int DiscountedLineCount,
    decimal TotalSaleValue, decimal TotalDiscount, decimal AvgDiscountPercent);

public record DiscountReport(
    DateTime FromDate, DateTime ToDate,
    decimal TotalDiscount, decimal OverallDiscountPercent,
    IReadOnlyList<DiscountRow> Rows);

// ---- Inventory valuation ----
public record InventoryValuationRow(
    int CategoryId, string CategoryName,
    int Products, int UnitsOnHand, decimal ValueAtOriginal, decimal ValueAtSale);

public record InventoryValuationReport(
    decimal TotalAtOriginal, decimal TotalAtSale, int TotalUnits,
    IReadOnlyList<InventoryValuationRow> Rows);

// ---- Payment methods ----
public record PaymentMethodRow(string Method, int PaymentCount, decimal AmountPaid, decimal Share);

public record PaymentMethodReport(
    DateTime FromDate, DateTime ToDate, decimal TotalPaid, IReadOnlyList<PaymentMethodRow> Rows);

// ---- Top / slow movers ----
public record MoverRow(
    int ProductId, string SKU, string Name, string CategoryName,
    int UnitsSold, decimal Revenue, int QuantityOnHand);

public record MoversReport(
    DateTime FromDate, DateTime ToDate,
    IReadOnlyList<MoverRow> TopMovers, IReadOnlyList<MoverRow> SlowMovers);

// ---- Follow-ups summary ----
public record FollowUpStaffRow(string Staff, int Open, int InProgress, int Overdue);

public record FollowUpReport(
    int Open, int InProgress, int Overdue, IReadOnlyList<FollowUpStaffRow> ByStaff);
