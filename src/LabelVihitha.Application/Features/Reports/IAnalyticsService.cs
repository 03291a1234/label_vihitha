namespace LabelVihitha.Application.Features.Reports;

public interface IAnalyticsService
{
    Task<DashboardSummary> GetDashboardSummaryAsync(DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<MarginReport> GetMarginAsync(DateTime? from, DateTime? to, int? categoryId, DateBucket bucket, CancellationToken ct = default);
    Task<SalesByCategoryReport> GetSalesByCategoryAsync(DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<DiscountReport> GetDiscountAsync(DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<InventoryValuationReport> GetInventoryValuationAsync(CancellationToken ct = default);
    Task<PaymentMethodReport> GetPaymentMethodsAsync(DateTime? from, DateTime? to, CancellationToken ct = default);
    Task<MoversReport> GetMoversAsync(DateTime? from, DateTime? to, int take, CancellationToken ct = default);
    Task<FollowUpReport> GetFollowUpsAsync(CancellationToken ct = default);
}
