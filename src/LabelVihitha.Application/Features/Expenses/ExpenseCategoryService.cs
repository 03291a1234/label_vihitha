using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Expenses;

public class ExpenseCategoryService : IExpenseCategoryService
{
    private readonly IApplicationDbContext _db;
    public ExpenseCategoryService(IApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<ExpenseCategoryDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default)
    {
        var q = _db.ExpenseCategories.AsNoTracking();
        if (!includeInactive) q = q.Where(c => c.IsActive);
        return await q.OrderBy(c => c.Name)
            .Select(c => new ExpenseCategoryDto(c.Id, c.Name, c.Description, c.IsActive,
                c.Expenses.Count(e => !e.IsDeleted)))
            .ToListAsync(ct);
    }

    public async Task<ExpenseCategoryDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var dto = await _db.ExpenseCategories.AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new ExpenseCategoryDto(c.Id, c.Name, c.Description, c.IsActive,
                c.Expenses.Count(e => !e.IsDeleted)))
            .FirstOrDefaultAsync(ct);
        return dto ?? throw new NotFoundException(nameof(ExpenseCategory), id);
    }

    public async Task<ExpenseCategoryDto> CreateAsync(CreateExpenseCategoryRequest request, CancellationToken ct = default)
    {
        await EnsureNameUniqueAsync(request.Name, null, ct);
        var entity = new ExpenseCategory { Name = request.Name.Trim(), Description = request.Description, IsActive = true };
        _db.ExpenseCategories.Add(entity);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(entity.Id, ct);
    }

    public async Task<ExpenseCategoryDto> UpdateAsync(int id, UpdateExpenseCategoryRequest request, CancellationToken ct = default)
    {
        var entity = await _db.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException(nameof(ExpenseCategory), id);
        await EnsureNameUniqueAsync(request.Name, id, ct);
        entity.Name = request.Name.Trim();
        entity.Description = request.Description;
        entity.IsActive = request.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.ExpenseCategories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException(nameof(ExpenseCategory), id);
        if (await _db.Expenses.AnyAsync(e => e.ExpenseCategoryId == id && !e.IsDeleted, ct))
            throw new ConflictException("This category has expenses. Reassign or remove them before deleting it.");
        entity.IsDeleted = true;
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task EnsureNameUniqueAsync(string name, int? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        var exists = await _db.ExpenseCategories.AnyAsync(
            c => !c.IsDeleted && c.Name == normalized && (excludeId == null || c.Id != excludeId), ct);
        if (exists)
            throw new ConflictException($"An expense category named '{normalized}' already exists.");
    }
}
