using LabelVihitha.Application.Features.Owners;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Business owners / partners and their capital ledger. Admin/Owner only.</summary>
[ApiController]
[Authorize(Roles = "Admin,Owner")]
[Route("api/owners")]
public class OwnersController : ControllerBase
{
    private readonly IOwnerService _service;
    public OwnersController(IOwnerService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OwnerDto>>> GetAll(
        [FromQuery] bool includeInactive = false, CancellationToken ct = default)
        => Ok(await _service.GetAllAsync(includeInactive, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OwnerDto>> Get(int id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<OwnerDto>> Create(CreateOwnerRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<OwnerDto>> Update(int id, UpdateOwnerRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpGet("{id:int}/transactions")]
    public async Task<ActionResult<IReadOnlyList<OwnerTransactionDto>>> GetTransactions(int id, CancellationToken ct)
        => Ok(await _service.GetTransactionsAsync(id, ct));

    [HttpPost("{id:int}/transactions")]
    public async Task<ActionResult<OwnerTransactionDto>> AddTransaction(int id, CreateOwnerTransactionRequest request, CancellationToken ct)
        => Ok(await _service.AddTransactionAsync(id, request, ct));

    [HttpDelete("{id:int}/transactions/{transactionId:int}")]
    public async Task<IActionResult> DeleteTransaction(int id, int transactionId, CancellationToken ct)
    {
        await _service.DeleteTransactionAsync(id, transactionId, ct);
        return NoContent();
    }
}
