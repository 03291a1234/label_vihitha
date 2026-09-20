using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.SubCategories;

public class SubCategoryService : ISubCategoryService
{
    private readonly IApplicationDbContext _db;

    public SubCategoryService(IApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<SubCategoryDto>> GetAsync(int? categoryId, bool includeInactive, CancellationToken ct = default)
    {
        var q = _db.SubCategories.AsNoTracking();
        if (categoryId is int cid) q = q.Where(s => s.CategoryId == cid);
        if (!includeInactive) q = q.Where(s => s.IsActive);

        var rows = await q
            .OrderBy(s => s.Category.Name).ThenBy(s => s.Name)
            .Select(s => new Row(s.Id, s.CategoryId, s.Category.Name, s.Name, s.Description, s.IsActive,
                s.Products.Count(p => !p.IsDeleted), s.Sizes, s.ImageUrl))
            .ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<SubCategoryDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var row = await _db.SubCategories.AsNoTracking()
            .Where(s => s.Id == id)
            .Select(s => new Row(s.Id, s.CategoryId, s.Category.Name, s.Name, s.Description, s.IsActive,
                s.Products.Count(p => !p.IsDeleted), s.Sizes, s.ImageUrl))
            .FirstOrDefaultAsync(ct);
        return row is null ? throw new NotFoundException(nameof(SubCategory), id) : Map(row);
    }

    public async Task<SubCategoryDto> CreateAsync(CreateSubCategoryRequest request, CancellationToken ct = default)
    {
        if (!await _db.Categories.AnyAsync(c => c.Id == request.CategoryId, ct))
            throw new NotFoundException(nameof(Category), request.CategoryId);

        await EnsureNameUniqueAsync(request.CategoryId, request.Name, null, ct);

        var entity = new SubCategory
        {
            CategoryId = request.CategoryId,
            Name = request.Name.Trim(),
            Description = request.Description,
            ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim(),
            Sizes = JoinSizes(request.Sizes),
            IsActive = true
        };
        _db.SubCategories.Add(entity);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(entity.Id, ct);
    }

    public async Task<SubCategoryDto> UpdateAsync(int id, UpdateSubCategoryRequest request, CancellationToken ct = default)
    {
        var entity = await _db.SubCategories.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException(nameof(SubCategory), id);

        await EnsureNameUniqueAsync(entity.CategoryId, request.Name, id, ct);

        entity.Name = request.Name.Trim();
        entity.Description = request.Description;
        entity.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();
        entity.IsActive = request.IsActive;
        entity.Sizes = JoinSizes(request.Sizes);
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.SubCategories.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new NotFoundException(nameof(SubCategory), id);

        // Detach products from this subcategory (they keep their category), then soft-delete it.
        var products = await _db.Products.Where(p => p.SubCategoryId == id).ToListAsync(ct);
        foreach (var p in products) p.SubCategoryId = null;

        entity.IsDeleted = true;
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task EnsureNameUniqueAsync(int categoryId, string name, int? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        var exists = await _db.SubCategories.AnyAsync(
            s => !s.IsDeleted && s.CategoryId == categoryId && s.Name == normalized
                 && (excludeId == null || s.Id != excludeId), ct);
        if (exists)
            throw new ConflictException($"A subcategory named '{normalized}' already exists in this category.");
    }

    // Materialized shape (raw Sizes string), mapped in memory so the comma list can be split.
    private sealed record Row(int Id, int CategoryId, string CategoryName, string Name, string? Description,
        bool IsActive, int ProductCount, string? Sizes, string? ImageUrl);

    private static SubCategoryDto Map(Row r) =>
        new(r.Id, r.CategoryId, r.CategoryName, r.Name, r.Description, r.IsActive, r.ProductCount, SplitSizes(r.Sizes), r.ImageUrl);

    private static IReadOnlyList<string> SplitSizes(string? s) =>
        string.IsNullOrWhiteSpace(s)
            ? Array.Empty<string>()
            : s.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string? JoinSizes(IReadOnlyList<string>? sizes)
    {
        if (sizes is null) return null;
        var cleaned = sizes.Select(x => x.Trim()).Where(x => x.Length > 0).Distinct().ToList();
        return cleaned.Count == 0 ? null : string.Join(",", cleaned);
    }
}
