using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Categories;

public class CategoryService : ICategoryService
{
    private readonly IApplicationDbContext _db;

    public CategoryService(IApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<CategoryDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default)
    {
        var query = _db.Categories.AsNoTracking();
        if (!includeInactive)
            query = query.Where(c => c.IsActive);

        return await query
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(
                c.Id, c.Name, c.Description, c.IsActive,
                c.Products.Count(p => !p.IsDeleted), c.ImageUrl))
            .ToListAsync(ct);
    }

    public async Task<CategoryDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var category = await _db.Categories.AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new CategoryDto(
                c.Id, c.Name, c.Description, c.IsActive,
                c.Products.Count(p => !p.IsDeleted), c.ImageUrl))
            .FirstOrDefaultAsync(ct);

        return category ?? throw new NotFoundException(nameof(Category), id);
    }

    public async Task<CategoryDto> CreateAsync(CreateCategoryRequest request, CancellationToken ct = default)
    {
        var entity = new Category
        {
            Name = request.Name.Trim(),
            Description = request.Description,
            ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim(),
            IsActive = true
        };

        _db.Categories.Add(entity);
        await _db.SaveChangesAsync(ct);
        return Map(entity, 0);
    }

    public async Task<CategoryDto> UpdateAsync(int id, UpdateCategoryRequest request, CancellationToken ct = default)
    {
        var entity = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException(nameof(Category), id);

        entity.Name = request.Name.Trim();
        entity.Description = request.Description;
        entity.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        var count = await _db.Products.CountAsync(p => p.CategoryId == id && !p.IsDeleted, ct);
        return Map(entity, count);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException(nameof(Category), id);

        // Soft delete — historical orders may reference products in this category.
        entity.IsDeleted = true;
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private static CategoryDto Map(Category c, int productCount) => new(
        c.Id, c.Name, c.Description, c.IsActive, productCount, c.ImageUrl);
}
