using LabelVihitha.Application.Features.Promotions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Manage promo / discount codes. Admin &amp; Owner only.</summary>
[ApiController]
[Authorize(Roles = "Admin,Owner")]
[Route("api/promo-codes")]
public class PromoCodesController : ControllerBase
{
    private readonly IPromoCodeService _service;
    public PromoCodesController(IPromoCodeService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PromoCodeDto>>> Get([FromQuery] bool includeInactive, CancellationToken ct)
        => Ok(await _service.GetAllAsync(includeInactive, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PromoCodeDto>> GetById(int id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    /// <summary>Validate a code against a subtotal and return the discount it would apply (staff order builder).</summary>
    [HttpGet("validate")]
    public async Task<ActionResult<PromoValidationResult>> Validate(
        [FromQuery] string code, [FromQuery] decimal subtotal, CancellationToken ct)
        => Ok(await _service.ValidateAsync(code, subtotal, ct));

    [HttpPost]
    public async Task<ActionResult<PromoCodeDto>> Create(CreatePromoCodeRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<PromoCodeDto>> Update(int id, UpdatePromoCodeRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }
}
