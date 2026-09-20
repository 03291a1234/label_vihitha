using LabelVihitha.Application.Common.Models;
using LabelVihitha.Application.Features.Invoices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/invoices")]
public class InvoicesController : ControllerBase
{
    private const string ManageRoles = "Admin,Owner";
    private readonly IInvoiceService _service;

    public InvoicesController(IInvoiceService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<PagedResult<InvoiceListItemDto>>> Get(
        [FromQuery] InvoiceQuery query, CancellationToken ct)
        => Ok(await _service.GetAsync(query, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<InvoiceDto>> GetById(int id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    [HttpPost]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<InvoiceDto>> Create(CreateInvoiceRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<InvoiceDto>> Update(int id, UpdateInvoiceRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpPost("{id:int}/payments")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<InvoiceDto>> RecordPayment(int id, RecordPaymentRequest request, CancellationToken ct)
        => Ok(await _service.RecordPaymentAsync(id, request, ct));

    [HttpPost("{id:int}/refunds")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<InvoiceDto>> RecordRefund(int id, RecordRefundRequest request, CancellationToken ct)
        => Ok(await _service.RecordRefundAsync(id, request, ct));
}
