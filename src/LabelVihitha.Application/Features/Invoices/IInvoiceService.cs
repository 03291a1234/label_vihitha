using LabelVihitha.Application.Common.Models;

namespace LabelVihitha.Application.Features.Invoices;

public interface IInvoiceService
{
    Task<PagedResult<InvoiceListItemDto>> GetAsync(InvoiceQuery query, CancellationToken ct = default);
    Task<InvoiceDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<InvoiceDto> CreateAsync(CreateInvoiceRequest request, CancellationToken ct = default);
    Task<InvoiceDto> UpdateAsync(int id, UpdateInvoiceRequest request, CancellationToken ct = default);
    Task<InvoiceDto> RecordPaymentAsync(int invoiceId, RecordPaymentRequest request, CancellationToken ct = default);
}
