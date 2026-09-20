using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Common.Models;
using LabelVihitha.Domain.Entities;
using LabelVihitha.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Invoices;

public class InvoiceService : IInvoiceService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public InvoiceService(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<PagedResult<InvoiceListItemDto>> GetAsync(InvoiceQuery query, CancellationToken ct = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 200 ? 25 : query.PageSize;

        var q = _db.Invoices.AsNoTracking();
        if (query.PaymentStatus is PaymentStatus ps) q = q.Where(i => i.PaymentStatus == ps);
        if (query.PaymentMethod is PaymentMethod pm) q = q.Where(i => i.PaymentMethod == pm);
        if (query.FromDate is DateTime from) q = q.Where(i => i.InvoiceDate >= from);
        if (query.ToDate is DateTime to) q = q.Where(i => i.InvoiceDate <= to);

        var total = await q.CountAsync(ct);
        var items = await ApplySort(q, query.SortBy, query.SortDir)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new InvoiceListItemDto(
                i.Id, i.InvoiceNumber, i.OrderId, i.Order.OrderNumber, i.Order.Customer.Name,
                i.InvoiceDate, i.PaymentMethod, i.AmountDue, i.AmountPaid, i.PaymentStatus))
            .ToListAsync(ct);

        return new PagedResult<InvoiceListItemDto>
        {
            Items = items, TotalCount = total, Page = page, PageSize = pageSize
        };
    }

    public async Task<InvoiceDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var invoice = await _db.Invoices.AsNoTracking()
            .Include(i => i.Order).ThenInclude(o => o.Customer)
            .Include(i => i.Payments.Where(p => !p.IsDeleted))
            .FirstOrDefaultAsync(i => i.Id == id, ct);
        return invoice is null ? throw new NotFoundException(nameof(Invoice), id) : MapToDto(invoice);
    }

    public async Task<InvoiceDto> CreateAsync(CreateInvoiceRequest request, CancellationToken ct = default)
    {
        var order = await _db.Orders
            .Include(o => o.Invoice)
            .FirstOrDefaultAsync(o => o.Id == request.OrderId, ct)
            ?? throw new NotFoundException(nameof(Order), request.OrderId);

        if (order.Status is OrderStatus.Pending or OrderStatus.Cancelled)
            throw new ConflictException("Only a Confirmed or Fulfilled order can be invoiced.");
        if (order.Invoice is not null)
            throw new ConflictException($"Order {order.OrderNumber} already has an invoice.");

        var invoice = new Invoice
        {
            OrderId = order.Id,
            InvoiceNumber = await GenerateInvoiceNumberAsync(ct),
            InvoiceDate = DateTime.UtcNow,
            PaymentMethod = request.PaymentMethod,
            PaymentReference = request.PaymentReference,
            AmountDue = order.GrandTotal,
            AmountPaid = 0m,
            PaymentStatus = PaymentStatus.Unpaid,
            Notes = request.Notes
        };

        _db.Invoices.Add(invoice);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(invoice.Id, ct);
    }

    public async Task<InvoiceDto> UpdateAsync(int id, UpdateInvoiceRequest request, CancellationToken ct = default)
    {
        var invoice = await _db.Invoices.FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotFoundException(nameof(Invoice), id);

        invoice.PaymentMethod = request.PaymentMethod;
        invoice.PaymentReference = request.PaymentReference;
        invoice.Notes = request.Notes;

        // Manual status override is limited to the Refunded correction placeholder;
        // Unpaid/PartiallyPaid/Paid are otherwise derived from recorded payments.
        if (request.PaymentStatus is PaymentStatus.Refunded)
        {
            invoice.PaymentStatus = PaymentStatus.Refunded;
            invoice.PaidDate = null;
        }
        else if (request.PaymentStatus is PaymentStatus status && status != invoice.PaymentStatus
                 && invoice.PaymentStatus == PaymentStatus.Refunded)
        {
            // Allow reverting a Refunded flag back to the payment-derived status.
            RecomputeStatus(invoice);
        }

        invoice.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<InvoiceDto> RecordPaymentAsync(int invoiceId, RecordPaymentRequest request, CancellationToken ct = default)
    {
        var invoice = await _db.Invoices
            .Include(i => i.Payments.Where(p => !p.IsDeleted))
            .FirstOrDefaultAsync(i => i.Id == invoiceId, ct)
            ?? throw new NotFoundException(nameof(Invoice), invoiceId);

        if (request.Amount <= 0m)
            throw new ConflictException("Payment amount must be greater than zero.");

        var remaining = invoice.AmountDue - invoice.AmountPaid;
        if (request.Amount > remaining)
            throw new ConflictException($"Payment exceeds the outstanding balance ({remaining:0.00}).");

        invoice.Payments.Add(new Payment
        {
            Amount = request.Amount,
            Method = request.Method,
            PaymentDate = DateTime.UtcNow,
            ReferenceNumber = request.ReferenceNumber,
            RecordedBy = _currentUser.UserName ?? _currentUser.UserId
        });

        invoice.AmountPaid += request.Amount;
        RecomputeStatus(invoice, HasRefund(invoice));
        invoice.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(invoiceId, ct);
    }

    public async Task<InvoiceDto> RecordRefundAsync(int invoiceId, RecordRefundRequest request, CancellationToken ct = default)
    {
        var invoice = await _db.Invoices
            .Include(i => i.Payments.Where(p => !p.IsDeleted))
            .FirstOrDefaultAsync(i => i.Id == invoiceId, ct)
            ?? throw new NotFoundException(nameof(Invoice), invoiceId);

        if (request.Amount <= 0m)
            throw new ConflictException("Refund amount must be greater than zero.");
        // Can't return more money than was actually collected.
        if (request.Amount > invoice.AmountPaid)
            throw new ConflictException($"Refund exceeds the amount collected ({invoice.AmountPaid:0.00}).");

        invoice.Payments.Add(new Payment
        {
            Amount = -request.Amount,        // refunds are stored as negative payments
            Method = request.Method,
            PaymentDate = DateTime.UtcNow,
            IsRefund = true,
            Notes = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
            RecordedBy = _currentUser.UserName ?? _currentUser.UserId
        });
        invoice.AmountPaid -= request.Amount;
        RecomputeStatus(invoice, hasRefund: true);
        invoice.UpdatedAt = DateTime.UtcNow;

        // Optional returns: put the order's items back into stock (product + matching variant).
        if (request.Restock)
            await RestockOrderAsync(invoice.OrderId, ct);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(invoiceId, ct);
    }

    /// <summary>Return every line of an order to stock (used when a refund is a return).</summary>
    private async Task RestockOrderAsync(int orderId, CancellationToken ct)
    {
        var items = await _db.OrderItems.Where(i => i.OrderId == orderId && !i.IsDeleted).ToListAsync(ct);
        foreach (var item in items)
        {
            var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId, ct);
            if (product != null) product.QuantityOnHand += item.Quantity;
            if (item.ProductVariantId is int vid)
            {
                var variant = await _db.ProductVariants.FirstOrDefaultAsync(v => v.Id == vid, ct);
                if (variant != null) variant.QuantityOnHand += item.Quantity;
            }
        }
    }

    private static bool HasRefund(Invoice invoice) =>
        invoice.Payments.Any(p => p.IsRefund && !p.IsDeleted);

    // ---- helpers -------------------------------------------------------

    private static IQueryable<Invoice> ApplySort(IQueryable<Invoice> q, string? sortBy, string? dir)
    {
        var desc = string.Equals(dir, "desc", StringComparison.OrdinalIgnoreCase);
        return sortBy?.ToLowerInvariant() switch
        {
            "invoicenumber" => desc ? q.OrderByDescending(i => i.InvoiceNumber) : q.OrderBy(i => i.InvoiceNumber),
            "ordernumber" => desc ? q.OrderByDescending(i => i.Order.OrderNumber) : q.OrderBy(i => i.Order.OrderNumber),
            "customername" => desc ? q.OrderByDescending(i => i.Order.Customer.Name) : q.OrderBy(i => i.Order.Customer.Name),
            "amountdue" => desc ? q.OrderByDescending(i => i.AmountDue) : q.OrderBy(i => i.AmountDue),
            "amountpaid" => desc ? q.OrderByDescending(i => i.AmountPaid) : q.OrderBy(i => i.AmountPaid),
            "paymentstatus" => desc ? q.OrderByDescending(i => i.PaymentStatus) : q.OrderBy(i => i.PaymentStatus),
            "paymentmethod" => desc ? q.OrderByDescending(i => i.PaymentMethod) : q.OrderBy(i => i.PaymentMethod),
            "invoicedate" => desc ? q.OrderByDescending(i => i.InvoiceDate) : q.OrderBy(i => i.InvoiceDate),
            _ => q.OrderByDescending(i => i.InvoiceDate)
        };
    }

    private static void RecomputeStatus(Invoice invoice, bool hasRefund = false)
    {
        var net = invoice.AmountPaid; // already net of refunds (stored as negative payments)
        if (hasRefund)
        {
            // A refund was issued: fully refunded when nothing is net collected, else partly.
            invoice.PaymentStatus = net <= 0m ? PaymentStatus.Refunded : PaymentStatus.PartiallyRefunded;
            invoice.PaidDate = null;
        }
        else if (net <= 0m)
        {
            invoice.PaymentStatus = PaymentStatus.Unpaid;
            invoice.PaidDate = null;
        }
        else if (net < invoice.AmountDue)
        {
            invoice.PaymentStatus = PaymentStatus.PartiallyPaid;
            invoice.PaidDate = null;
        }
        else
        {
            invoice.PaymentStatus = PaymentStatus.Paid;
            invoice.PaidDate = DateTime.UtcNow;
        }
    }

    private async Task<string> GenerateInvoiceNumberAsync(CancellationToken ct)
    {
        var year = DateTime.UtcNow.Year;
        var count = await _db.Invoices.IgnoreQueryFilters()
            .CountAsync(i => i.InvoiceDate.Year == year, ct);
        return $"INV-{year}-{count + 1:D4}";
    }

    private static InvoiceDto MapToDto(Invoice i) => new(
        i.Id,
        i.InvoiceNumber,
        i.OrderId,
        i.Order?.OrderNumber ?? string.Empty,
        i.Order?.Customer?.Name ?? string.Empty,
        i.InvoiceDate,
        i.PaymentMethod,
        i.PaymentReference,
        i.AmountDue,
        i.AmountPaid,
        i.AmountDue - i.AmountPaid,
        i.PaymentStatus,
        i.PaidDate,
        i.Notes,
        i.Payments.Where(p => !p.IsDeleted)
            .OrderBy(p => p.PaymentDate)
            .Select(p => new PaymentDto(p.Id, p.Amount, p.Method, p.PaymentDate, p.ReferenceNumber, p.RecordedBy, p.IsRefund, p.Notes))
            .ToList());
}
