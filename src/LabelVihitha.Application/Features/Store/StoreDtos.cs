using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Application.Features.Store;

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
    bool InStock);

public record StoreCheckoutItem(int ProductId, int Quantity);

public record StoreCheckoutRequest(
    string CustomerName,
    string? CustomerPhone,
    string? CustomerEmail,
    PaymentMethod PaymentMethod,
    string? Notes,
    IReadOnlyList<StoreCheckoutItem> Items);

public record StoreCheckoutResult(
    string OrderNumber,
    string InvoiceNumber,
    decimal GrandTotal,
    string PaymentMethod,
    string CustomerName);
