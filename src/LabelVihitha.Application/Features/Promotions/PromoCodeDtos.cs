using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Application.Features.Promotions;

public record PromoCodeDto(
    int Id,
    string Code,
    string? Description,
    PromoDiscountType DiscountType,
    decimal Value,
    decimal? MinOrderAmount,
    DateTime? ValidFrom,
    DateTime? ValidTo,
    int? MaxUses,
    int TimesUsed,
    bool IsActive);

public record CreatePromoCodeRequest(
    string Code,
    string? Description,
    PromoDiscountType DiscountType,
    decimal Value,
    decimal? MinOrderAmount,
    DateTime? ValidFrom,
    DateTime? ValidTo,
    int? MaxUses);

public record UpdatePromoCodeRequest(
    string Code,
    string? Description,
    PromoDiscountType DiscountType,
    decimal Value,
    decimal? MinOrderAmount,
    DateTime? ValidFrom,
    DateTime? ValidTo,
    int? MaxUses,
    bool IsActive);

/// <summary>Result of checking a code against an order subtotal.</summary>
public record PromoValidationResult(bool Valid, decimal DiscountAmount, string Message, string? Code);
