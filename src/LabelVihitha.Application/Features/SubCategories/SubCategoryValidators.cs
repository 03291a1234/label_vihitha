using FluentValidation;

namespace LabelVihitha.Application.Features.SubCategories;

public class CreateSubCategoryRequestValidator : AbstractValidator<CreateSubCategoryRequest>
{
    public CreateSubCategoryRequestValidator()
    {
        RuleFor(x => x.CategoryId).GreaterThan(0);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}

public class UpdateSubCategoryRequestValidator : AbstractValidator<UpdateSubCategoryRequest>
{
    public UpdateSubCategoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}
