using LabelVihitha.Application.Features.Vendors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Suppliers / stores the boutique buys stock from.</summary>
[ApiController]
[Authorize]
[Route("api/vendors")]
public class VendorsController : ControllerBase
{
    private const string ManageRoles = "Admin,Inventory";
    private readonly IVendorService _service;

    public VendorsController(IVendorService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<VendorDto>>> GetAll(
        [FromQuery] bool includeInactive = false, CancellationToken ct = default)
        => Ok(await _service.GetAllAsync(includeInactive, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<VendorDto>> Get(int id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    [HttpPost]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<VendorDto>> Create(CreateVendorRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<VendorDto>> Update(int id, UpdateVendorRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }
}
