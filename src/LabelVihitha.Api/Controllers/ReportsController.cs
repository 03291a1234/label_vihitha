using LabelVihitha.Application.Features.Reports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Financial/analytics reports — Owner only (margins are sensitive).</summary>
[ApiController]
[Authorize(Roles = "Admin,Owner")]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly IAnalyticsService _analytics;

    public ReportsController(IAnalyticsService analytics) => _analytics = analytics;

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummary>> Summary(
        [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
        => Ok(await _analytics.GetDashboardSummaryAsync(fromDate, toDate, ct));

    [HttpGet("margin")]
    public async Task<ActionResult<MarginReport>> Margin(
        [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate,
        [FromQuery] int? categoryId, [FromQuery] DateBucket bucket = DateBucket.Month, CancellationToken ct = default)
        => Ok(await _analytics.GetMarginAsync(fromDate, toDate, categoryId, bucket, ct));

    [HttpGet("sales-by-category")]
    public async Task<ActionResult<SalesByCategoryReport>> SalesByCategory(
        [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
        => Ok(await _analytics.GetSalesByCategoryAsync(fromDate, toDate, ct));

    [HttpGet("discounts")]
    public async Task<ActionResult<DiscountReport>> Discounts(
        [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
        => Ok(await _analytics.GetDiscountAsync(fromDate, toDate, ct));

    [HttpGet("inventory-valuation")]
    public async Task<ActionResult<InventoryValuationReport>> InventoryValuation(CancellationToken ct)
        => Ok(await _analytics.GetInventoryValuationAsync(ct));

    [HttpGet("payment-methods")]
    public async Task<ActionResult<PaymentMethodReport>> PaymentMethods(
        [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
        => Ok(await _analytics.GetPaymentMethodsAsync(fromDate, toDate, ct));

    [HttpGet("movers")]
    public async Task<ActionResult<MoversReport>> Movers(
        [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int take = 5, CancellationToken ct = default)
        => Ok(await _analytics.GetMoversAsync(fromDate, toDate, take, ct));

    [HttpGet("follow-ups")]
    public async Task<ActionResult<FollowUpReport>> FollowUps(CancellationToken ct)
        => Ok(await _analytics.GetFollowUpsAsync(ct));
}
