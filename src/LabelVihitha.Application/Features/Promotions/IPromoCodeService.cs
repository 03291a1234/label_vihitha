namespace LabelVihitha.Application.Features.Promotions;

public interface IPromoCodeService
{
    Task<IReadOnlyList<PromoCodeDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default);
    Task<PromoCodeDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<PromoCodeDto> CreateAsync(CreatePromoCodeRequest request, CancellationToken ct = default);
    Task<PromoCodeDto> UpdateAsync(int id, UpdatePromoCodeRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);

    /// <summary>Check a code against an order subtotal and return the discount it would give.</summary>
    Task<PromoValidationResult> ValidateAsync(string? code, decimal subtotal, CancellationToken ct = default);

    /// <summary>Record one use of a code (called after a successful checkout).</summary>
    Task MarkUsedAsync(string? code, CancellationToken ct = default);
}
