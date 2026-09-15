using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Common.Models;
using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Expenses;

public class ExpenseService : IExpenseService
{
    private readonly IApplicationDbContext _db;
    public ExpenseService(IApplicationDbContext db) => _db = db;

    public async Task<PagedResult<ExpenseDto>> GetAsync(ExpenseQuery query, CancellationToken ct = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 200 ? 25 : query.PageSize;

        var q = _db.Expenses.AsNoTracking();
        if (query.CategoryId is int cid) q = q.Where(e => e.ExpenseCategoryId == cid);
        if (query.FromDate is DateTime f) q = q.Where(e => e.Date >= f);
        if (query.ToDate is DateTime t) q = q.Where(e => e.Date <= t);

        var total = await q.CountAsync(ct);
        var ordered = ApplySort(q, query.SortBy, query.SortDir);
        var items = await ordered
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(e => new ExpenseDto(e.Id, e.ExpenseCategoryId, e.ExpenseCategory.Name,
                e.Date, e.Amount, e.Description, e.Notes))
            .ToListAsync(ct);

        return new PagedResult<ExpenseDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<ExpenseDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var dto = await _db.Expenses.AsNoTracking()
            .Where(e => e.Id == id)
            .Select(e => new ExpenseDto(e.Id, e.ExpenseCategoryId, e.ExpenseCategory.Name,
                e.Date, e.Amount, e.Description, e.Notes))
            .FirstOrDefaultAsync(ct);
        return dto ?? throw new NotFoundException(nameof(Expense), id);
    }

    public async Task<ExpenseDto> CreateAsync(CreateExpenseRequest request, CancellationToken ct = default)
    {
        await EnsureCategoryAsync(request.ExpenseCategoryId, ct);
        var entity = new Expense
        {
            ExpenseCategoryId = request.ExpenseCategoryId,
            Date = request.Date,
            Amount = request.Amount,
            Description = request.Description,
            Notes = request.Notes
        };
        _db.Expenses.Add(entity);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(entity.Id, ct);
    }

    public async Task<ExpenseDto> UpdateAsync(int id, UpdateExpenseRequest request, CancellationToken ct = default)
    {
        var entity = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw new NotFoundException(nameof(Expense), id);
        await EnsureCategoryAsync(request.ExpenseCategoryId, ct);
        entity.ExpenseCategoryId = request.ExpenseCategoryId;
        entity.Date = request.Date;
        entity.Amount = request.Amount;
        entity.Description = request.Description;
        entity.Notes = request.Notes;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw new NotFoundException(nameof(Expense), id);
        entity.IsDeleted = true;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task EnsureCategoryAsync(int categoryId, CancellationToken ct)
    {
        if (!await _db.ExpenseCategories.AnyAsync(c => c.Id == categoryId && !c.IsDeleted, ct))
            throw new NotFoundException(nameof(ExpenseCategory), categoryId);
    }

    private static IQueryable<Expense> ApplySort(IQueryable<Expense> q, string? sortBy, string? dir)
    {
        var desc = !string.Equals(dir, "asc", StringComparison.OrdinalIgnoreCase); // default newest first
        return sortBy?.ToLowerInvariant() switch
        {
            "amount" => desc ? q.OrderByDescending(e => e.Amount) : q.OrderBy(e => e.Amount),
            "category" => desc ? q.OrderByDescending(e => e.ExpenseCategory.Name) : q.OrderBy(e => e.ExpenseCategory.Name),
            _ => desc ? q.OrderByDescending(e => e.Date).ThenByDescending(e => e.Id)
                      : q.OrderBy(e => e.Date).ThenBy(e => e.Id)
        };
    }
}
