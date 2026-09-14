using FluentValidation;

namespace LabelVihitha.Application.Features.Products;

public class CreateProductRequestValidator : AbstractValidator<CreateProductRequest>
{
    public CreateProductRequestValidator()
    {
        RuleFor(x => x.CategoryId).GreaterThan(0);
        RuleFor(x => x.SKU).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.OriginalPrice).GreaterThanOrEqualTo(0).When(x => x.OriginalPrice.HasValue);
        RuleFor(x => x.SalePrice).GreaterThanOrEqualTo(0).When(x => x.SalePrice.HasValue);
        RuleFor(x => x.QuantityOnHand).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ReorderThreshold).GreaterThanOrEqualTo(0);
    }
}

public class UpdateProductRequestValidator : AbstractValidator<UpdateProductRequest>
{
    public UpdateProductRequestValidator()
    {
        RuleFor(x => x.CategoryId).GreaterThan(0);
        RuleFor(x => x.SKU).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.OriginalPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SalePrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.QuantityOnHand).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ReorderThreshold).GreaterThanOrEqualTo(0);
    }
}
