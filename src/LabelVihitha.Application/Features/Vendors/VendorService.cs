using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Vendors;

public class VendorService : IVendorService
{
    private readonly IApplicationDbContext _db;

    public VendorService(IApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<VendorDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default)
    {
        var q = _db.Vendors.AsNoTracking();
        if (!includeInactive) q = q.Where(v => v.IsActive);

        return await q.OrderBy(v => v.Name)
            .Select(v => new VendorDto(
                v.Id, v.Name, v.ContactPerson, v.Phone, v.Email, v.Notes, v.IsActive,
                v.Products.Count(p => !p.IsDeleted),
                v.Products.Where(p => !p.IsDeleted).Sum(p => (int?)p.QuantityOnHand) ?? 0))
            .ToListAsync(ct);
    }

    public async Task<VendorDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var dto = await _db.Vendors.AsNoTracking()
            .Where(v => v.Id == id)
            .Select(v => new VendorDto(
                v.Id, v.Name, v.ContactPerson, v.Phone, v.Email, v.Notes, v.IsActive,
                v.Products.Count(p => !p.IsDeleted),
                v.Products.Where(p => !p.IsDeleted).Sum(p => (int?)p.QuantityOnHand) ?? 0))
            .FirstOrDefaultAsync(ct);
        return dto ?? throw new NotFoundException(nameof(Vendor), id);
    }

    public async Task<VendorDto> CreateAsync(CreateVendorRequest request, CancellationToken ct = default)
    {
        await EnsureNameUniqueAsync(request.Name, null, ct);
        var entity = new Vendor
        {
            Name = request.Name.Trim(),
            ContactPerson = Trim(request.ContactPerson),
            Phone = Trim(request.Phone),
            Email = Trim(request.Email),
            Notes = Trim(request.Notes),
            IsActive = true
        };
        _db.Vendors.Add(entity);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(entity.Id, ct);
    }

    public async Task<VendorDto> UpdateAsync(int id, UpdateVendorRequest request, CancellationToken ct = default)
    {
        var entity = await _db.Vendors.FirstOrDefaultAsync(v => v.Id == id, ct)
            ?? throw new NotFoundException(nameof(Vendor), id);

        await EnsureNameUniqueAsync(request.Name, id, ct);

        entity.Name = request.Name.Trim();
        entity.ContactPerson = Trim(request.ContactPerson);
        entity.Phone = Trim(request.Phone);
        entity.Email = Trim(request.Email);
        entity.Notes = Trim(request.Notes);
        entity.IsActive = request.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.Vendors.FirstOrDefaultAsync(v => v.Id == id, ct)
            ?? throw new NotFoundException(nameof(Vendor), id);

        // Detach products from this vendor (they keep everything else), then soft-delete.
        var products = await _db.Products.Where(p => p.VendorId == id).ToListAsync(ct);
        foreach (var p in products) p.VendorId = null;

        entity.IsDeleted = true;
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task EnsureNameUniqueAsync(string name, int? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        var exists = await _db.Vendors.AnyAsync(
            v => !v.IsDeleted && v.Name == normalized && (excludeId == null || v.Id != excludeId), ct);
        if (exists)
            throw new ConflictException($"A vendor named '{normalized}' already exists.");
    }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
