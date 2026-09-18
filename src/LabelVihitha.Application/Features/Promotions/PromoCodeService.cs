using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Entities;
using LabelVihitha.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Promotions;

public class PromoCodeService : IPromoCodeService
{
    private readonly IApplicationDbContext _db;
    public PromoCodeService(IApplicationDbContext db) => _db = db;

    private static string Normalize(string code) => code.Trim().ToUpperInvariant();

    public async Task<IReadOnlyList<PromoCodeDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default)
    {
        var q = _db.PromoCodes.AsNoTracking();
        if (!includeInactive) q = q.Where(p => p.IsActive);
        return await q.OrderByDescending(p => p.IsActive).ThenBy(p => p.Code).Select(Project).ToListAsync(ct);
    }

    public async Task<PromoCodeDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var e = await _db.PromoCodes.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException(nameof(PromoCode), id);
        return Map(e);
    }

    public async Task<PromoCodeDto> CreateAsync(CreatePromoCodeRequest r, CancellationToken ct = default)
    {
        var code = Normalize(r.Code);
        await EnsureUniqueAsync(code, null, ct);
        var e = new PromoCode
        {
            Code = code,
            Description = r.Description?.Trim(),
            DiscountType = r.DiscountType,
            Value = r.Value,
            MinOrderAmount = r.MinOrderAmount,
            ValidFrom = r.ValidFrom,
            ValidTo = r.ValidTo,
            MaxUses = r.MaxUses,
            IsActive = true
        };
        _db.PromoCodes.Add(e);
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task<PromoCodeDto> UpdateAsync(int id, UpdatePromoCodeRequest r, CancellationToken ct = default)
    {
        var e = await _db.PromoCodes.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException(nameof(PromoCode), id);
        var code = Normalize(r.Code);
        await EnsureUniqueAsync(code, id, ct);
        e.Code = code;
        e.Description = r.Description?.Trim();
        e.DiscountType = r.DiscountType;
        e.Value = r.Value;
        e.MinOrderAmount = r.MinOrderAmount;
        e.ValidFrom = r.ValidFrom;
        e.ValidTo = r.ValidTo;
        e.MaxUses = r.MaxUses;
        e.IsActive = r.IsActive;
        e.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Map(e);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var e = await _db.PromoCodes.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException(nameof(PromoCode), id);
        e.IsDeleted = true;
        e.IsActive = false;
        e.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<PromoValidationResult> ValidateAsync(string? code, decimal subtotal, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            return new(false, 0m, "Enter a promo code.", null);

        var norm = Normalize(code);
        var promo = await _db.PromoCodes.AsNoTracking().FirstOrDefaultAsync(p => p.Code == norm, ct);
        if (promo is null || !promo.IsActive)
            return new(false, 0m, "This code isn't valid.", null);

        var now = DateTime.UtcNow;
        if (promo.ValidFrom is DateTime f && now < f)
            return new(false, 0m, "This code isn't active yet.", null);
        if (promo.ValidTo is DateTime t && now > t)
            return new(false, 0m, "This code has expired.", null);
        if (promo.MaxUses is int max && promo.TimesUsed >= max)
            return new(false, 0m, "This code has reached its usage limit.", null);
        if (promo.MinOrderAmount is decimal min && subtotal < min)
            return new(false, 0m, $"Spend at least {min:C} to use this code.", null);

        var discount = promo.DiscountType == PromoDiscountType.Percentage
            ? Math.Round(subtotal * promo.Value / 100m, 2)
            : promo.Value;
        discount = Math.Min(discount, subtotal); // never exceed the order
        if (discount <= 0m)
            return new(false, 0m, "This code gives no discount on this order.", null);

        return new(true, discount, $"Applied — {discount:C} off.", promo.Code);
    }

    public async Task MarkUsedAsync(string? code, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code)) return;
        var norm = Normalize(code);
        var promo = await _db.PromoCodes.FirstOrDefaultAsync(p => p.Code == norm, ct);
        if (promo is null) return;
        promo.TimesUsed += 1;
        await _db.SaveChangesAsync(ct);
    }

    private async Task EnsureUniqueAsync(string code, int? excludeId, CancellationToken ct)
    {
        var exists = await _db.PromoCodes.AnyAsync(p => p.Code == code && (excludeId == null || p.Id != excludeId), ct);
        if (exists) throw new ConflictException($"A promo code '{code}' already exists.");
    }

    private static readonly System.Linq.Expressions.Expression<Func<PromoCode, PromoCodeDto>> Project = p =>
        new PromoCodeDto(p.Id, p.Code, p.Description, p.DiscountType, p.Value, p.MinOrderAmount,
            p.ValidFrom, p.ValidTo, p.MaxUses, p.TimesUsed, p.IsActive);

    private static PromoCodeDto Map(PromoCode p) =>
        new(p.Id, p.Code, p.Description, p.DiscountType, p.Value, p.MinOrderAmount,
            p.ValidFrom, p.ValidTo, p.MaxUses, p.TimesUsed, p.IsActive);
}
