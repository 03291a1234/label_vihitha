using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Application.Features.Invoices;

public record PaymentDto(
    int Id,
    decimal Amount,
    PaymentMethod Method,
    DateTime PaymentDate,
    string? ReferenceNumber,
    string? RecordedBy);

public record InvoiceDto(
    int Id,
    string InvoiceNumber,
    int OrderId,
    string OrderNumber,
    string CustomerName,
    DateTime InvoiceDate,
    PaymentMethod PaymentMethod,
    string? PaymentReference,
    decimal AmountDue,
    decimal AmountPaid,
    decimal AmountRemaining,
    PaymentStatus PaymentStatus,
    DateTime? PaidDate,
    string? Notes,
    IReadOnlyList<PaymentDto> Payments);

public record InvoiceListItemDto(
    int Id,
    string InvoiceNumber,
    int OrderId,
    string OrderNumber,
    string CustomerName,
    DateTime InvoiceDate,
    PaymentMethod PaymentMethod,
    decimal AmountDue,
    decimal AmountPaid,
    PaymentStatus PaymentStatus);

public record CreateInvoiceRequest(
    int OrderId,
    PaymentMethod PaymentMethod,
    string? PaymentReference,
    string? Notes);

public record UpdateInvoiceRequest(
    PaymentMethod PaymentMethod,
    string? PaymentReference,
    string? Notes,
    PaymentStatus? PaymentStatus);   // allows the manual Refunded correction

public record RecordPaymentRequest(
    decimal Amount,
    PaymentMethod Method,
    string? ReferenceNumber);

public record InvoiceQuery(
    PaymentStatus? PaymentStatus = null,
    PaymentMethod? PaymentMethod = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    int Page = 1,
    int PageSize = 25);
