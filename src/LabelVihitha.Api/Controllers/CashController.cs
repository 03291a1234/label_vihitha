using LabelVihitha.Application.Features.Cash;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Cash-by-location tracking: accounts (common / per-owner) and movements between them. Admin/Owner only.</summary>
[ApiController]
[Authorize(Roles = "Admin,Owner")]
[Route("api/cash")]
public class CashController : ControllerBase
{
    private readonly ICashService _cash;
    public CashController(ICashService cash) => _cash = cash;

    [HttpGet("overview")]
    public async Task<ActionResult<CashOverviewDto>> Overview(CancellationToken ct)
        => Ok(await _cash.GetOverviewAsync(ct));

    [HttpPost("accounts")]
    public async Task<ActionResult<CashAccountDto>> CreateAccount(CreateCashAccountRequest request, CancellationToken ct)
        => Ok(await _cash.CreateAccountAsync(request, ct));

    [HttpPut("accounts/{id:int}")]
    public async Task<ActionResult<CashAccountDto>> UpdateAccount(int id, UpdateCashAccountRequest request, CancellationToken ct)
        => Ok(await _cash.UpdateAccountAsync(id, request, ct));

    [HttpDelete("accounts/{id:int}")]
    public async Task<IActionResult> DeleteAccount(int id, CancellationToken ct)
    {
        await _cash.DeleteAccountAsync(id, ct);
        return NoContent();
    }

    [HttpGet("movements")]
    public async Task<ActionResult<IReadOnlyList<CashMovementDto>>> Movements([FromQuery] int? accountId, CancellationToken ct)
        => Ok(await _cash.GetMovementsAsync(accountId, ct));

    [HttpPost("movements")]
    public async Task<ActionResult<CashMovementDto>> RecordMovement(RecordCashMovementRequest request, CancellationToken ct)
        => Ok(await _cash.RecordMovementAsync(request, ct));

    [HttpDelete("movements/{id:int}")]
    public async Task<IActionResult> DeleteMovement(int id, CancellationToken ct)
    {
        await _cash.DeleteMovementAsync(id, ct);
        return NoContent();
    }
}
