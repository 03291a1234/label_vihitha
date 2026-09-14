using FluentValidation;

namespace LabelVihitha.Application.Features.Invoices;

public class CreateInvoiceRequestValidator : AbstractValidator<CreateInvoiceRequest>
{
    public CreateInvoiceRequestValidator()
    {
        RuleFor(x => x.OrderId).GreaterThan(0);
        RuleFor(x => x.PaymentReference).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public class UpdateInvoiceRequestValidator : AbstractValidator<UpdateInvoiceRequest>
{
    public UpdateInvoiceRequestValidator()
    {
        RuleFor(x => x.PaymentReference).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public class RecordPaymentRequestValidator : AbstractValidator<RecordPaymentRequest>
{
    public RecordPaymentRequestValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.ReferenceNumber).MaximumLength(100);
    }
}
