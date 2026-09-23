using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Features.Invoices;
using LabelVihitha.Application.Features.Orders;
using LabelVihitha.Application.Features.Promotions;
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
    private readonly IPromoCodeService _promos;

    public StoreService(IApplicationDbContext db, IOrderService orders, IInvoiceService invoices, IPromoCodeService promos)
    {
        _db = db;
        _orders = orders;
        _invoices = invoices;
        _promos = promos;
    }

    /// <summary>Authoritative cart subtotal from live product sale prices.</summary>
    private async Task<decimal> CartSubtotalAsync(IReadOnlyList<StoreCheckoutItem> items, CancellationToken ct)
    {
        var ids = items.Select(i => i.ProductId).Distinct().ToList();
        var prices = await _db.Products.AsNoTracking().Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.SalePrice, ct);
        return items.Sum(i => (prices.TryGetValue(i.ProductId, out var pr) ? pr : 0m) * i.Quantity);
    }

    public async Task<PromoValidationResult> ValidatePromoAsync(StorePromoRequest request, CancellationToken ct = default)
    {
        var subtotal = await CartSubtotalAsync(request.Items ?? new List<StoreCheckoutItem>(), ct);
        return await _promos.ValidateAsync(request.Code, subtotal, ct);
    }

    public async Task<IReadOnlyList<StoreProductDto>> GetProductsAsync(string? search, int? categoryId, CancellationToken ct = default)
    {
        // Only sell products that are active AND belong to a store-visible inventory
        // (products with no inventory stay visible).
        var q = _db.Products.AsNoTracking()
            .Where(p => p.IsActive && (p.Inventory == null || p.Inventory.IsVisibleOnStore));
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
                    .ToList(),
                p.Category.ImageUrl,
                p.SubCategory != null ? p.SubCategory.ImageUrl : null))
            .ToListAsync(ct);
    }

    public async Task<StoreCheckoutResult> CheckoutAsync(StoreCheckoutRequest request, CancellationToken ct = default)
    {
        if (request.Items is null || request.Items.Count == 0)
            throw new ConflictException("Your cart is empty.");

        // Block any item whose inventory has since been hidden from the store (stale cart).
        var itemIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
        var unavailable = await _db.Products.AsNoTracking()
            .AnyAsync(p => itemIds.Contains(p.Id) && (!p.IsActive || (p.Inventory != null && !p.Inventory.IsVisibleOnStore)), ct);
        if (unavailable)
            throw new ConflictException("Some items in your cart are no longer available. Please review your cart.");

        var customer = await FindOrCreateCustomerAsync(request, ct);

        // Validate any promo code against the authoritative cart subtotal.
        var subtotal = await CartSubtotalAsync(request.Items, ct);
        var promo = await _promos.ValidateAsync(request.PromoCode, subtotal, ct);
        var promoDiscount = promo.Valid ? promo.DiscountAmount : 0m;
        var manualDiscount = Math.Max(0m, request.ManualDiscount);
        // Promo + manual discount together, but never below zero.
        var discount = Math.Min(subtotal, promoDiscount + manualDiscount);

        var order = await _orders.CreateAsync(new CreateOrderRequest(
            customer.Id,
            request.Notes,
            request.Items.Select(i => new CreateOrderItemRequest(i.ProductId, i.Quantity, null, i.ProductVariantId)).ToList(),
            discount,
            promo.Valid ? promo.Code : null), ct);

        // A storefront order starts as Pending — a request the owner reviews. The owner moves it to
        // Confirmed (and invoices/takes payment) after reviewing, then Fulfilled once it's received.
        if (promo.Valid) await _promos.MarkUsedAsync(promo.Code, ct);

        return new StoreCheckoutResult(
            order.OrderNumber, "", order.SubTotal, order.DiscountTotal, order.GrandTotal,
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
