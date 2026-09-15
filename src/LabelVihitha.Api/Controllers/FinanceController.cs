using LabelVihitha.Application.Features.Finance;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Profit &amp; Loss and owner-equity tally. Admin/Owner only.</summary>
[ApiController]
[Authorize(Roles = "Admin,Owner")]
[Route("api/finance")]
public class FinanceController : ControllerBase
{
    private readonly IFinanceService _finance;
    public FinanceController(IFinanceService finance) => _finance = finance;

    [HttpGet("profit-loss")]
    public async Task<ActionResult<ProfitLossReport>> ProfitLoss(
        [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
        => Ok(await _finance.GetProfitAndLossAsync(fromDate, toDate, ct));
}
