using FluentValidation;

namespace LabelVihitha.Application.Features.Categories;

public class CreateCategoryRequestValidator : AbstractValidator<CreateCategoryRequest>
{
    public CreateCategoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.DefaultOriginalPrice).GreaterThanOrEqualTo(0).When(x => x.DefaultOriginalPrice.HasValue);
        RuleFor(x => x.DefaultSalePrice).GreaterThanOrEqualTo(0).When(x => x.DefaultSalePrice.HasValue);
    }
}

public class UpdateCategoryRequestValidator : AbstractValidator<UpdateCategoryRequest>
{
    public UpdateCategoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.DefaultOriginalPrice).GreaterThanOrEqualTo(0).When(x => x.DefaultOriginalPrice.HasValue);
        RuleFor(x => x.DefaultSalePrice).GreaterThanOrEqualTo(0).When(x => x.DefaultSalePrice.HasValue);
    }
}
