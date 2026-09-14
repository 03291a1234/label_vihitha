using FluentValidation;

namespace LabelVihitha.Application.Features.Store;

public class StoreCheckoutItemValidator : AbstractValidator<StoreCheckoutItem>
{
    public StoreCheckoutItemValidator()
    {
        RuleFor(x => x.ProductId).GreaterThan(0);
        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}

public class StoreCheckoutRequestValidator : AbstractValidator<StoreCheckoutRequest>
{
    public StoreCheckoutRequestValidator()
    {
        RuleFor(x => x.CustomerName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.CustomerPhone).MaximumLength(30);
        RuleFor(x => x.CustomerEmail).MaximumLength(200)
            .EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.CustomerEmail));
        RuleFor(x => x.Items).NotEmpty().WithMessage("Your cart is empty.");
        RuleForEach(x => x.Items).SetValidator(new StoreCheckoutItemValidator());
    }
}
