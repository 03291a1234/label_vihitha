using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Features.Products;
using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Inventories;

public class InventoryGroupService : IInventoryGroupService
{
    private readonly IApplicationDbContext _db;

    public InventoryGroupService(IApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<InventoryDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default)
    {
        var q = _db.Inventories.AsNoTracking();
        if (!includeInactive) q = q.Where(i => i.IsActive);

        var inventories = await q.OrderBy(i => i.Name)
            .Select(i => new { i.Id, i.Name, i.Description, i.IsActive })
            .ToListAsync(ct);
        var ids = inventories.Select(i => i.Id).ToList();

        var breakdown = await BuildBreakdownAsync(ids, ct);

        return inventories.Select(i =>
        {
            var (units, cats) = breakdown.TryGetValue(i.Id, out var b) ? b : (0, new List<CategoryCount>());
            var count = cats.Sum(c => c.ProductCount);
            return new InventoryDto(i.Id, i.Name, i.Description, i.IsActive, count, units, cats);
        }).ToList();
    }

    public async Task<InventoryDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var i = await _db.Inventories.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new { x.Id, x.Name, x.Description, x.IsActive })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException(nameof(Inventory), id);

        var breakdown = await BuildBreakdownAsync(new List<int> { id }, ct);
        var (units, cats) = breakdown.TryGetValue(id, out var b) ? b : (0, new List<CategoryCount>());
        return new InventoryDto(i.Id, i.Name, i.Description, i.IsActive, cats.Sum(c => c.ProductCount), units, cats);
    }

    /// <summary>Per-inventory category → subcategory stock breakdown.</summary>
    private async Task<Dictionary<int, (int Units, List<CategoryCount> Categories)>> BuildBreakdownAsync(
        List<int> inventoryIds, CancellationToken ct)
    {
        if (inventoryIds.Count == 0)
            return new();

        var rows = await _db.Products.AsNoTracking()
            .Where(p => !p.IsDeleted && p.InventoryId != null && inventoryIds.Contains(p.InventoryId.Value))
            .Select(p => new
            {
                InventoryId = p.InventoryId!.Value,
                p.CategoryId,
                CategoryName = p.Category.Name,
                p.SubCategoryId,
                SubCategoryName = p.SubCategory != null ? p.SubCategory.Name : null,
                p.QuantityOnHand
            })
            .ToListAsync(ct);

        return rows
            .GroupBy(r => r.InventoryId)
            .ToDictionary(
                g => g.Key,
                g => (
                    g.Sum(x => x.QuantityOnHand),
                    g.GroupBy(x => new { x.CategoryId, x.CategoryName })
                        .Select(cg => new CategoryCount(
                            cg.Key.CategoryId, cg.Key.CategoryName, cg.Count(), cg.Sum(x => x.QuantityOnHand),
                            cg.GroupBy(x => new { x.SubCategoryId, x.SubCategoryName })
                                .Select(sg => new SubCategoryCount(
                                    sg.Key.SubCategoryId, sg.Key.SubCategoryName ?? "Unassigned",
                                    sg.Count(), sg.Sum(x => x.QuantityOnHand)))
                                .OrderByDescending(s => s.ProductCount).ThenBy(s => s.SubCategoryName)
                                .ToList()))
                        .OrderBy(c => c.CategoryName)
                        .ToList()));
    }

    public async Task<InventoryDto> CreateAsync(CreateInventoryRequest request, CancellationToken ct = default)
    {
        await EnsureNameUniqueAsync(request.Name, null, ct);
        var entity = new Inventory { Name = request.Name.Trim(), Description = request.Description, IsActive = true };
        _db.Inventories.Add(entity);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(entity.Id, ct);
    }

    public async Task<InventoryDto> UpdateAsync(int id, UpdateInventoryRequest request, CancellationToken ct = default)
    {
        var entity = await _db.Inventories.FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotFoundException(nameof(Inventory), id);

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
        var entity = await _db.Inventories.FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotFoundException(nameof(Inventory), id);

        // Detach products (they keep their category), then soft-delete the inventory.
        var products = await _db.Products.Where(p => p.InventoryId == id).ToListAsync(ct);
        foreach (var p in products) p.InventoryId = null;

        entity.IsDeleted = true;
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task EnsureNameUniqueAsync(string name, int? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        var exists = await _db.Inventories.AnyAsync(
            i => !i.IsDeleted && i.Name == normalized && (excludeId == null || i.Id != excludeId), ct);
        if (exists)
            throw new ConflictException($"An inventory named '{normalized}' already exists.");
    }
}
