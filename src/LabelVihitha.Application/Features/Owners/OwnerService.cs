using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Entities;
using LabelVihitha.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Owners;

public class OwnerService : IOwnerService
{
    private readonly IApplicationDbContext _db;
    public OwnerService(IApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<OwnerDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default)
    {
        var q = _db.Owners.AsNoTracking();
        if (!includeInactive) q = q.Where(o => o.IsActive);
        return await q.OrderBy(o => o.Name).Select(Project).ToListAsync(ct);
    }

    public async Task<OwnerDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var dto = await _db.Owners.AsNoTracking().Where(o => o.Id == id).Select(Project).FirstOrDefaultAsync(ct);
        return dto ?? throw new NotFoundException(nameof(Owner), id);
    }

    public async Task<OwnerDto> CreateAsync(CreateOwnerRequest request, CancellationToken ct = default)
    {
        await EnsureNameUniqueAsync(request.Name, null, ct);
        var entity = new Owner
        {
            Name = request.Name.Trim(),
            Email = Trim(request.Email),
            Phone = Trim(request.Phone),
            Notes = Trim(request.Notes),
            ProfitSharePercent = request.ProfitSharePercent,
            IsActive = true
        };
        _db.Owners.Add(entity);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(entity.Id, ct);
    }

    public async Task<OwnerDto> UpdateAsync(int id, UpdateOwnerRequest request, CancellationToken ct = default)
    {
        var entity = await _db.Owners.FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new NotFoundException(nameof(Owner), id);
        await EnsureNameUniqueAsync(request.Name, id, ct);
        entity.Name = request.Name.Trim();
        entity.Email = Trim(request.Email);
        entity.Phone = Trim(request.Phone);
        entity.Notes = Trim(request.Notes);
        entity.ProfitSharePercent = request.ProfitSharePercent;
        entity.IsActive = request.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.Owners.FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new NotFoundException(nameof(Owner), id);
        entity.IsDeleted = true;
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<OwnerTransactionDto>> GetTransactionsAsync(int ownerId, CancellationToken ct = default)
    {
        if (!await _db.Owners.AnyAsync(o => o.Id == ownerId, ct))
            throw new NotFoundException(nameof(Owner), ownerId);
        return await _db.OwnerTransactions.AsNoTracking()
            .Where(t => t.OwnerId == ownerId)
            .OrderByDescending(t => t.Date).ThenByDescending(t => t.Id)
            .Select(t => new OwnerTransactionDto(t.Id, t.OwnerId, t.Date, t.Type, t.Amount, t.Notes))
            .ToListAsync(ct);
    }

    public async Task<OwnerTransactionDto> AddTransactionAsync(int ownerId, CreateOwnerTransactionRequest request, CancellationToken ct = default)
    {
        if (!await _db.Owners.AnyAsync(o => o.Id == ownerId, ct))
            throw new NotFoundException(nameof(Owner), ownerId);
        var entity = new OwnerTransaction
        {
            OwnerId = ownerId,
            Date = request.Date,
            Type = request.Type,
            Amount = request.Amount,
            Notes = request.Notes
        };
        _db.OwnerTransactions.Add(entity);
        await _db.SaveChangesAsync(ct);
        return new OwnerTransactionDto(entity.Id, entity.OwnerId, entity.Date, entity.Type, entity.Amount, entity.Notes);
    }

    public async Task DeleteTransactionAsync(int ownerId, int transactionId, CancellationToken ct = default)
    {
        var entity = await _db.OwnerTransactions.FirstOrDefaultAsync(t => t.Id == transactionId && t.OwnerId == ownerId, ct)
            ?? throw new NotFoundException(nameof(OwnerTransaction), transactionId);
        entity.IsDeleted = true;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    // Projection with per-owner contribution/withdrawal totals (translatable sub-aggregates).
    private static System.Linq.Expressions.Expression<Func<Owner, OwnerDto>> Project => o => new OwnerDto(
        o.Id, o.Name, o.Email, o.Phone, o.Notes, o.ProfitSharePercent, o.IsActive,
        o.Transactions.Where(t => !t.IsDeleted && t.Type == OwnerTransactionType.Contribution).Sum(t => (decimal?)t.Amount) ?? 0m,
        o.Transactions.Where(t => !t.IsDeleted && t.Type == OwnerTransactionType.Withdrawal).Sum(t => (decimal?)t.Amount) ?? 0m);

    private async Task EnsureNameUniqueAsync(string name, int? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        var exists = await _db.Owners.AnyAsync(
            o => !o.IsDeleted && o.Name == normalized && (excludeId == null || o.Id != excludeId), ct);
        if (exists)
            throw new ConflictException($"An owner named '{normalized}' already exists.");
    }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
