using LabelVihitha.Application.Common.Models;
using LabelVihitha.Application.Features.Expenses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Company operating expenses. Finance data — Admin/Owner only.</summary>
[ApiController]
[Authorize(Roles = "Admin,Owner")]
[Route("api/expenses")]
public class ExpensesController : ControllerBase
{
    private readonly IExpenseService _service;
    public ExpensesController(IExpenseService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<PagedResult<ExpenseDto>>> Get([FromQuery] ExpenseQuery query, CancellationToken ct)
        => Ok(await _service.GetAsync(query, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ExpenseDto>> Get(int id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<ExpenseDto>> Create(CreateExpenseRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ExpenseDto>> Update(int id, UpdateExpenseRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Expense categories (Shipping, Tags, Hangers, ...). Admin/Owner only.</summary>
[ApiController]
[Authorize(Roles = "Admin,Owner")]
[Route("api/expense-categories")]
public class ExpenseCategoriesController : ControllerBase
{
    private readonly IExpenseCategoryService _service;
    public ExpenseCategoriesController(IExpenseCategoryService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ExpenseCategoryDto>>> GetAll(
        [FromQuery] bool includeInactive = false, CancellationToken ct = default)
        => Ok(await _service.GetAllAsync(includeInactive, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ExpenseCategoryDto>> Get(int id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<ExpenseCategoryDto>> Create(CreateExpenseCategoryRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ExpenseCategoryDto>> Update(int id, UpdateExpenseCategoryRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }
}
