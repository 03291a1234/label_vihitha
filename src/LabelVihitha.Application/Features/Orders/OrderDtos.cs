using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Application.Features.Orders;

public record OrderItemDto(
    int Id,
    int ProductId,
    string ProductName,
    string SKU,
    int Quantity,
    decimal OriginalPriceAtSale,
    decimal SalePriceAtSale,
    decimal FinalPriceAtSale,
    decimal DiscountAmount,
    decimal LineTotal);

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
    IReadOnlyList<OrderItemDto> Items);

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
    decimal? FinalPrice);   // null → snapshot the product's current SalePrice

public record CreateOrderRequest(
    int CustomerId,
    string? Notes,
    IReadOnlyList<CreateOrderItemRequest> Items);

public record UpdateOrderItemRequest(
    int Quantity,
    decimal? FinalPrice);

public record UpdateOrderStatusRequest(OrderStatus Status);

public record OrderQuery(
    int? CustomerId = null,
    OrderStatus? Status = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 25);
