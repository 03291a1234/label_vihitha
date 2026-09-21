using LabelVihitha.Application.Common.Models;

namespace LabelVihitha.Application.Features.Orders;

public interface IOrderService
{
    Task<PagedResult<OrderListItemDto>> GetAsync(OrderQuery query, CancellationToken ct = default);
    Task<OrderSummaryDto> GetSummaryAsync(OrderQuery query, CancellationToken ct = default);
    Task<OrderDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<OrderDto> CreateAsync(CreateOrderRequest request, CancellationToken ct = default);
    Task<OrderDto> UpdateStatusAsync(int id, UpdateOrderStatusRequest request, CancellationToken ct = default);
    Task<OrderDto> UpdateOrderDateAsync(int id, UpdateOrderDateRequest request, CancellationToken ct = default);

    // Line-item editing is only permitted while the order is Pending.
    Task<OrderDto> AddItemAsync(int orderId, CreateOrderItemRequest request, CancellationToken ct = default);
    Task<OrderDto> UpdateItemAsync(int orderId, int itemId, UpdateOrderItemRequest request, CancellationToken ct = default);
    Task<OrderDto> RemoveItemAsync(int orderId, int itemId, CancellationToken ct = default);

    // Additional service charges — only permitted while the order is Pending.
    Task<OrderDto> AddChargeAsync(int orderId, OrderChargeInput request, CancellationToken ct = default);
    Task<OrderDto> RemoveChargeAsync(int orderId, int chargeId, CancellationToken ct = default);
}
