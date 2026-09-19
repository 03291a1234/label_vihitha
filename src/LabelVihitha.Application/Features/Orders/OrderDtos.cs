using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Application.Features.Orders;

public record OrderItemDto(
    int Id,
    int ProductId,
    string ProductName,
    string SKU,
    int? ProductVariantId,
    string? Size,
    int Quantity,
    decimal OriginalPriceAtSale,
    decimal SalePriceAtSale,
    decimal FinalPriceAtSale,
    decimal DiscountAmount,
    decimal LineTotal);

public record OrderChargeDto(int Id, string Label, decimal Amount);
public record OrderChargeInput(string Label, decimal Amount);

public record OrderDto(
    int Id,
    string OrderNumber,
    int CustomerId,
    string CustomerName,
    DateTime OrderDate,
    OrderStatus Status,
    decimal SubTotal,
    decimal DiscountTotal,
    decimal GrandTotal,
    string? Notes,
    string? CreatedBy,
    bool HasInvoice,
    int? InvoiceId,
    IReadOnlyList<OrderItemDto> Items,
    IReadOnlyList<OrderChargeDto> Charges,
    decimal ChargesTotal);

public record OrderListItemDto(
    int Id,
    string OrderNumber,
    int CustomerId,
    string CustomerName,
    DateTime OrderDate,
    OrderStatus Status,
    decimal GrandTotal,
    int ItemCount,
    bool HasInvoice);

public record CreateOrderItemRequest(
    int ProductId,
    int Quantity,
    decimal? FinalPrice,   // null → snapshot the product's current SalePrice
    int? ProductVariantId = null);   // which size to draw down (required once a product has variants)

public record CreateOrderRequest(
    int CustomerId,
    string? Notes,
    IReadOnlyList<CreateOrderItemRequest> Items,
    decimal OrderDiscount = 0m,        // order-level discount (promo/manual)
    string? PromoCode = null,
    IReadOnlyList<OrderChargeInput>? Charges = null,   // additional services (stitching, shipping…)
    DateTime? OrderDate = null);       // backdate an order; null → now

public record UpdateOrderItemRequest(
    int Quantity,
    decimal? FinalPrice);

public record UpdateOrderStatusRequest(OrderStatus Status);

public record UpdateOrderDateRequest(DateTime OrderDate);

public record OrderQuery(
    int? CustomerId = null,
    OrderStatus? Status = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    string? Search = null,
    string? SortBy = null,
    string? SortDir = null,
    int Page = 1,
    int PageSize = 25);
