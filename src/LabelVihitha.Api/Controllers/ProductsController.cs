using LabelVihitha.Application.Common.Models;
using LabelVihitha.Application.Features.Products;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    private const string ManageRoles = "Owner,Staff";
    private readonly IProductService _service;

    public ProductsController(IProductService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<PagedResult<ProductDto>>> Get(
        [FromQuery] ProductQuery query, CancellationToken ct)
        => Ok(await _service.GetAsync(query, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    [HttpPost]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<ProductDto>> Create(CreateProductRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<ProductDto>> Update(int id, UpdateProductRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }
}
