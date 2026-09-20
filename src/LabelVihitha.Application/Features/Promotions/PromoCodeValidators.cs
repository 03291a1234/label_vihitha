using FluentValidation;
using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Application.Features.Promotions;

/// <summary>Shared rules for creating/updating a promo code.</summary>
internal static class PromoRules
{
    public static void Apply<T>(AbstractValidator<T> v,
        System.Func<T, string> code, System.Func<T, PromoDiscountType> type, System.Func<T, decimal> value,
        System.Func<T, decimal?> minOrder, System.Func<T, System.DateTime?> from, System.Func<T, System.DateTime?> to,
        System.Func<T, int?> maxUses, System.Func<T, string?> description)
    {
        v.RuleFor(x => code(x)).NotEmpty().WithName("Code").MaximumLength(40)
            .Matches("^[A-Za-z0-9_-]+$").WithMessage("Code may use letters, numbers, hyphens and underscores only.");
        v.RuleFor(x => description(x)).MaximumLength(500).WithName("Description");

        // Percentage discounts are 0–100; fixed amounts are a positive USD value.
        v.RuleFor(x => value(x)).InclusiveBetween(0, 100).WithName("Value")
            .When(x => type(x) == PromoDiscountType.Percentage)
            .WithMessage("A percentage discount must be between 0 and 100.");
        v.RuleFor(x => value(x)).GreaterThan(0).WithName("Value")
            .When(x => type(x) == PromoDiscountType.FixedAmount)
            .WithMessage("A fixed discount must be greater than 0.");

        v.RuleFor(x => minOrder(x)).GreaterThanOrEqualTo(0).WithName("MinOrderAmount")
            .When(x => minOrder(x) != null);
        v.RuleFor(x => maxUses(x)).GreaterThanOrEqualTo(1).WithName("MaxUses")
            .When(x => maxUses(x) != null);
        v.RuleFor(x => to(x)).GreaterThanOrEqualTo(x => from(x)).WithName("ValidTo")
            .When(x => from(x) != null && to(x) != null)
            .WithMessage("Valid-to must be on or after valid-from.");
    }
}

public class CreatePromoCodeRequestValidator : AbstractValidator<CreatePromoCodeRequest>
{
    public CreatePromoCodeRequestValidator() => PromoRules.Apply(this,
        x => x.Code, x => x.DiscountType, x => x.Value, x => x.MinOrderAmount,
        x => x.ValidFrom, x => x.ValidTo, x => x.MaxUses, x => x.Description);
}

public class UpdatePromoCodeRequestValidator : AbstractValidator<UpdatePromoCodeRequest>
{
    public UpdatePromoCodeRequestValidator() => PromoRules.Apply(this,
        x => x.Code, x => x.DiscountType, x => x.Value, x => x.MinOrderAmount,
        x => x.ValidFrom, x => x.ValidTo, x => x.MaxUses, x => x.Description);
}
