using LabelVihitha.Application.Features.SubCategories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/subcategories")]
public class SubCategoriesController : ControllerBase
{
    private const string ManageRoles = "Admin,Inventory";
    private readonly ISubCategoryService _service;

    public SubCategoriesController(ISubCategoryService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SubCategoryDto>>> Get(
        [FromQuery] int? categoryId, [FromQuery] bool includeInactive = false, CancellationToken ct = default)
        => Ok(await _service.GetAsync(categoryId, includeInactive, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<SubCategoryDto>> GetById(int id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    [HttpPost]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<SubCategoryDto>> Create(CreateSubCategoryRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<SubCategoryDto>> Update(int id, UpdateSubCategoryRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }
}
