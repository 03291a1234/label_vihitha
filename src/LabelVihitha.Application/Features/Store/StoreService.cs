using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Features.Invoices;
using LabelVihitha.Application.Features.Orders;
using LabelVihitha.Domain.Entities;
using LabelVihitha.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Store;

/// <summary>
/// Public storefront: browse active products and check a cart out. Checkout reuses the
/// internal order/invoice flow — find-or-create the customer, create the order, confirm
/// it (a committed sale), then raise the invoice.
/// </summary>
public class StoreService : IStoreService
{
    private readonly IApplicationDbContext _db;
    private readonly IOrderService _orders;
    private readonly IInvoiceService _invoices;

    public StoreService(IApplicationDbContext db, IOrderService orders, IInvoiceService invoices)
    {
        _db = db;
        _orders = orders;
        _invoices = invoices;
    }

    public async Task<IReadOnlyList<StoreProductDto>> GetProductsAsync(string? search, int? categoryId, CancellationToken ct = default)
    {
        var q = _db.Products.AsNoTracking().Where(p => p.IsActive);
        if (categoryId is int cid) q = q.Where(p => p.CategoryId == cid);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            q = q.Where(p => p.Name.Contains(term) || p.SKU.Contains(term));
        }

        return await q
            .OrderByDescending(p => p.QuantityOnHand > 0)
            .ThenBy(p => p.Name)
            .Select(p => new StoreProductDto(
                p.Id, p.SKU, p.Name, p.Category.Name,
                p.SubCategory != null ? p.SubCategory.Name : null,
                p.SalePrice, p.ImageUrl, p.QuantityOnHand, p.QuantityOnHand > 0,
                p.Variants.Where(v => !v.IsDeleted).OrderBy(v => v.Id)
                    .Select(v => new StoreVariantDto(v.Id, v.Size, v.QuantityOnHand, v.QuantityOnHand > 0))
                    .ToList()))
            .ToListAsync(ct);
    }

    public async Task<StoreCheckoutResult> CheckoutAsync(StoreCheckoutRequest request, CancellationToken ct = default)
    {
        if (request.Items is null || request.Items.Count == 0)
            throw new ConflictException("Your cart is empty.");

        var customer = await FindOrCreateCustomerAsync(request, ct);

        var order = await _orders.CreateAsync(new CreateOrderRequest(
            customer.Id,
            request.Notes,
            request.Items.Select(i => new CreateOrderItemRequest(i.ProductId, i.Quantity, null, i.ProductVariantId)).ToList()), ct);

        // Storefront purchases are committed immediately.
        await _orders.UpdateStatusAsync(order.Id, new UpdateOrderStatusRequest(OrderStatus.Confirmed), ct);

        var invoice = await _invoices.CreateAsync(new CreateInvoiceRequest(
            order.Id, request.PaymentMethod, null,
            $"Online order for {customer.Name}"), ct);

        return new StoreCheckoutResult(
            order.OrderNumber, invoice.InvoiceNumber, order.GrandTotal,
            request.PaymentMethod.ToString(), customer.Name);
    }

    private async Task<Customer> FindOrCreateCustomerAsync(StoreCheckoutRequest request, CancellationToken ct)
    {
        var phone = request.CustomerPhone?.Trim();
        Customer? customer = null;
        if (!string.IsNullOrWhiteSpace(phone))
            customer = await _db.Customers.FirstOrDefaultAsync(c => c.Phone == phone, ct);

        if (customer is null)
        {
            customer = new Customer
            {
                Name = request.CustomerName.Trim(),
                Phone = phone,
                Email = request.CustomerEmail?.Trim(),
                Notes = "Created via storefront"
            };
            _db.Customers.Add(customer);
            await _db.SaveChangesAsync(ct);
        }
        return customer;
    }
}
