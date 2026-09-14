using FluentValidation;

namespace LabelVihitha.Application.Features.Orders;

public class CreateOrderItemRequestValidator : AbstractValidator<CreateOrderItemRequest>
{
    public CreateOrderItemRequestValidator()
    {
        RuleFor(x => x.ProductId).GreaterThan(0);
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.FinalPrice).GreaterThanOrEqualTo(0).When(x => x.FinalPrice.HasValue);
    }
}

public class CreateOrderRequestValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderRequestValidator()
    {
        RuleFor(x => x.CustomerId).GreaterThan(0);
        RuleFor(x => x.Notes).MaximumLength(2000);
        RuleFor(x => x.Items).NotEmpty().WithMessage("An order must contain at least one line item.");
        RuleForEach(x => x.Items).SetValidator(new CreateOrderItemRequestValidator());
    }
}

public class UpdateOrderItemRequestValidator : AbstractValidator<UpdateOrderItemRequest>
{
    public UpdateOrderItemRequestValidator()
    {
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.FinalPrice).GreaterThanOrEqualTo(0).When(x => x.FinalPrice.HasValue);
    }
}
