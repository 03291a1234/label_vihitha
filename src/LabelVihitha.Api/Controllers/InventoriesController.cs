using LabelVihitha.Application.Features.Inventories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Named inventories / collections that group products.</summary>
[ApiController]
[Authorize]
[Route("api/inventories")]
public class InventoriesController : ControllerBase
{
    private const string ManageRoles = "Owner,Staff";
    private readonly IInventoryGroupService _service;

    public InventoriesController(IInventoryGroupService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InventoryDto>>> GetAll(
        [FromQuery] bool includeInactive = false, CancellationToken ct = default)
        => Ok(await _service.GetAllAsync(includeInactive, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<InventoryDto>> Get(int id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    [HttpPost]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<InventoryDto>> Create(CreateInventoryRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<InventoryDto>> Update(int id, UpdateInventoryRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }
}
