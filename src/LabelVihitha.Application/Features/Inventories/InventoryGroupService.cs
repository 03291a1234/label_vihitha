using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
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

        return await q
            .OrderBy(i => i.Name)
            .Select(i => new InventoryDto(
                i.Id, i.Name, i.Description, i.IsActive,
                i.Products.Count(p => !p.IsDeleted)))
            .ToListAsync(ct);
    }

    public async Task<InventoryDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var dto = await _db.Inventories.AsNoTracking()
            .Where(i => i.Id == id)
            .Select(i => new InventoryDto(
                i.Id, i.Name, i.Description, i.IsActive,
                i.Products.Count(p => !p.IsDeleted)))
            .FirstOrDefaultAsync(ct);
        return dto ?? throw new NotFoundException(nameof(Inventory), id);
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
