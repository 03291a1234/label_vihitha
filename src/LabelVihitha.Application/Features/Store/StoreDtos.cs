using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Application.Features.Store;

public record StoreVariantDto(int Id, string Size, int Available, bool InStock);

/// <summary>Public product card for the storefront (no cost/margin exposed).</summary>
public record StoreProductDto(
    int Id,
    string SKU,
    string Name,
    string CategoryName,
    string? SubCategoryName,
    decimal Price,
    string? ImageUrl,
    int Available,
    bool InStock,
    IReadOnlyList<StoreVariantDto> Variants,
    string? CategoryImageUrl = null,
    string? SubCategoryImageUrl = null);

public record StoreCheckoutItem(int ProductId, int Quantity, int? ProductVariantId = null);

public record StoreCheckoutRequest(
    string CustomerName,
    string? CustomerPhone,
    string? CustomerEmail,
    PaymentMethod PaymentMethod,
    string? Notes,
    IReadOnlyList<StoreCheckoutItem> Items,
    string? PromoCode = null,
    decimal ManualDiscount = 0m);   // staff-applied ad-hoc discount ($), stacks with a promo

public record StoreCheckoutResult(
    string OrderNumber,
    string InvoiceNumber,
    decimal SubTotal,
    decimal Discount,
    decimal GrandTotal,
    string PaymentMethod,
    string CustomerName);

/// <summary>Preview a promo code against the current cart (public, pre-checkout).</summary>
public record StorePromoRequest(string Code, IReadOnlyList<StoreCheckoutItem> Items);
