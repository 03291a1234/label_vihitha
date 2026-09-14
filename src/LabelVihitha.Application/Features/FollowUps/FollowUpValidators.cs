using FluentValidation;

namespace LabelVihitha.Application.Features.FollowUps;

public class CreateFollowUpRequestValidator : AbstractValidator<CreateFollowUpRequest>
{
    public CreateFollowUpRequestValidator()
    {
        RuleFor(x => x.Note).NotEmpty().MaximumLength(1000);
    }
}

public class UpdateFollowUpRequestValidator : AbstractValidator<UpdateFollowUpRequest>
{
    public UpdateFollowUpRequestValidator()
    {
        RuleFor(x => x.Note).MaximumLength(1000);
        RuleFor(x => x.ResolutionNote).MaximumLength(1000);
    }
}
