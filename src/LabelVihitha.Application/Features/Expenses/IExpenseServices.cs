using LabelVihitha.Application.Common.Models;

namespace LabelVihitha.Application.Features.Expenses;

public interface IExpenseCategoryService
{
    Task<IReadOnlyList<ExpenseCategoryDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default);
    Task<ExpenseCategoryDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<ExpenseCategoryDto> CreateAsync(CreateExpenseCategoryRequest request, CancellationToken ct = default);
    Task<ExpenseCategoryDto> UpdateAsync(int id, UpdateExpenseCategoryRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}

public interface IExpenseService
{
    Task<PagedResult<ExpenseDto>> GetAsync(ExpenseQuery query, CancellationToken ct = default);
    Task<ExpenseDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<ExpenseDto> CreateAsync(CreateExpenseRequest request, CancellationToken ct = default);
    Task<ExpenseDto> UpdateAsync(int id, UpdateExpenseRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
