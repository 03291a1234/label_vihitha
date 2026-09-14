using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Common.Models;
using LabelVihitha.Domain.Entities;
using LabelVihitha.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Orders;

public class OrderService : IOrderService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public OrderService(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<PagedResult<OrderListItemDto>> GetAsync(OrderQuery query, CancellationToken ct = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 200 ? 25 : query.PageSize;

        var q = _db.Orders.AsNoTracking();
        if (query.CustomerId is int cid) q = q.Where(o => o.CustomerId == cid);
        if (query.Status is OrderStatus st) q = q.Where(o => o.Status == st);
        if (query.FromDate is DateTime from) q = q.Where(o => o.OrderDate >= from);
        if (query.ToDate is DateTime to) q = q.Where(o => o.OrderDate <= to);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            q = q.Where(o => o.OrderNumber.Contains(term) || o.Customer.Name.Contains(term));
        }

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(o => o.OrderDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new OrderListItemDto(
                o.Id, o.OrderNumber, o.CustomerId, o.Customer.Name, o.OrderDate, o.Status,
                o.GrandTotal, o.Items.Count(i => !i.IsDeleted), o.Invoice != null))
            .ToListAsync(ct);

        return new PagedResult<OrderListItemDto>
        {
            Items = items, TotalCount = total, Page = page, PageSize = pageSize
        };
    }

    public async Task<OrderDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var order = await _db.Orders.AsNoTracking()
            .Include(o => o.Customer)
            .Include(o => o.Items.Where(i => !i.IsDeleted)).ThenInclude(i => i.Product)
            .Include(o => o.Invoice)
            .FirstOrDefaultAsync(o => o.Id == id, ct);
        return order is null ? throw new NotFoundException(nameof(Order), id) : MapToDto(order);
    }

    public async Task<OrderDto> CreateAsync(CreateOrderRequest request, CancellationToken ct = default)
    {
        if (request.Items is null || request.Items.Count == 0)
            throw new ConflictException("An order must contain at least one line item.");

        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId, ct)
            ?? throw new NotFoundException(nameof(Customer), request.CustomerId);

        var order = new Order
        {
            CustomerId = customer.Id,
            OrderDate = DateTime.UtcNow,
            Status = OrderStatus.Pending,
            Notes = request.Notes,
            CreatedBy = _currentUser.UserName ?? _currentUser.UserId,
            OrderNumber = await GenerateOrderNumberAsync(ct)
        };

        foreach (var line in request.Items)
            order.Items.Add(await BuildLineAsync(line, ct));

        RecalculateTotals(order);

        _db.Orders.Add(order);
        await SaveWithConcurrencyGuardAsync(ct);
        return await GetByIdAsync(order.Id, ct);
    }

    public async Task<OrderDto> UpdateStatusAsync(int id, UpdateOrderStatusRequest request, CancellationToken ct = default)
    {
        var order = await _db.Orders
            .Include(o => o.Items.Where(i => !i.IsDeleted))
            .FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new NotFoundException(nameof(Order), id);

        var target = request.Status;
        if (target == order.Status)
            return await GetByIdAsync(id, ct);

        if (!IsTransitionAllowed(order.Status, target))
            throw new ConflictException($"Cannot change status from {order.Status} to {target}.");

        // Cancelling a not-yet-fulfilled order returns its stock.
        if (target == OrderStatus.Cancelled)
            await RestockAsync(order, ct);

        order.Status = target;
        order.UpdatedAt = DateTime.UtcNow;
        await SaveWithConcurrencyGuardAsync(ct);
        return await GetByIdAsync(id, ct);
    }

    public async Task<OrderDto> AddItemAsync(int orderId, CreateOrderItemRequest request, CancellationToken ct = default)
    {
        var order = await LoadEditableOrderAsync(orderId, ct);
        order.Items.Add(await BuildLineAsync(request, ct));
        RecalculateTotals(order);
        order.UpdatedAt = DateTime.UtcNow;
        await SaveWithConcurrencyGuardAsync(ct);
        return await GetByIdAsync(orderId, ct);
    }

    public async Task<OrderDto> UpdateItemAsync(int orderId, int itemId, UpdateOrderItemRequest request, CancellationToken ct = default)
    {
        var order = await LoadEditableOrderAsync(orderId, ct);
        var item = order.Items.FirstOrDefault(i => i.Id == itemId && !i.IsDeleted)
            ?? throw new NotFoundException(nameof(OrderItem), itemId);

        if (request.Quantity < 1)
            throw new ConflictException("Quantity must be at least 1.");

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId, ct)
            ?? throw new NotFoundException(nameof(Product), item.ProductId);

        // Adjust stock by the delta between old and new quantity.
        var delta = request.Quantity - item.Quantity;
        if (delta > 0 && product.QuantityOnHand < delta)
            throw new ConflictException($"Insufficient stock for '{product.Name}'. Available: {product.QuantityOnHand}.");
        product.QuantityOnHand -= delta;

        item.Quantity = request.Quantity;
        item.FinalPriceAtSale = request.FinalPrice ?? item.FinalPriceAtSale;
        item.DiscountAmount = item.SalePriceAtSale - item.FinalPriceAtSale;
        item.LineTotal = item.FinalPriceAtSale * item.Quantity;
        item.UpdatedAt = DateTime.UtcNow;

        RecalculateTotals(order);
        order.UpdatedAt = DateTime.UtcNow;
        await SaveWithConcurrencyGuardAsync(ct);
        return await GetByIdAsync(orderId, ct);
    }

    public async Task<OrderDto> RemoveItemAsync(int orderId, int itemId, CancellationToken ct = default)
    {
        var order = await LoadEditableOrderAsync(orderId, ct);
        var item = order.Items.FirstOrDefault(i => i.Id == itemId && !i.IsDeleted)
            ?? throw new NotFoundException(nameof(OrderItem), itemId);

        if (order.Items.Count(i => !i.IsDeleted) == 1)
            throw new ConflictException("An order must keep at least one line item. Cancel the order instead.");

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId, ct);
        if (product is not null)
            product.QuantityOnHand += item.Quantity; // return stock

        item.IsDeleted = true;
        item.UpdatedAt = DateTime.UtcNow;

        RecalculateTotals(order);
        order.UpdatedAt = DateTime.UtcNow;
        await SaveWithConcurrencyGuardAsync(ct);
        return await GetByIdAsync(orderId, ct);
    }

    // ---- helpers -------------------------------------------------------

    private async Task<Order> LoadEditableOrderAsync(int orderId, CancellationToken ct)
    {
        var order = await _db.Orders
            .Include(o => o.Items.Where(i => !i.IsDeleted))
            .FirstOrDefaultAsync(o => o.Id == orderId, ct)
            ?? throw new NotFoundException(nameof(Order), orderId);

        if (order.Status != OrderStatus.Pending)
            throw new ConflictException("Line items can only be changed while the order is Pending.");

        return order;
    }

    /// <summary>Builds a line, snapshotting prices and decrementing product stock.</summary>
    private async Task<OrderItem> BuildLineAsync(CreateOrderItemRequest line, CancellationToken ct)
    {
        if (line.Quantity < 1)
            throw new ConflictException("Quantity must be at least 1.");

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == line.ProductId, ct)
            ?? throw new NotFoundException(nameof(Product), line.ProductId);

        if (product.QuantityOnHand < line.Quantity)
            throw new ConflictException($"Insufficient stock for '{product.Name}'. Available: {product.QuantityOnHand}.");

        product.QuantityOnHand -= line.Quantity;

        var finalPrice = line.FinalPrice ?? product.SalePrice;
        return new OrderItem
        {
            ProductId = product.Id,
            Quantity = line.Quantity,
            OriginalPriceAtSale = product.OriginalPrice,
            SalePriceAtSale = product.SalePrice,
            FinalPriceAtSale = finalPrice,
            DiscountAmount = product.SalePrice - finalPrice,
            LineTotal = finalPrice * line.Quantity
        };
    }

    private async Task RestockAsync(Order order, CancellationToken ct)
    {
        var productIds = order.Items.Where(i => !i.IsDeleted).Select(i => i.ProductId).ToList();
        var products = await _db.Products.Where(p => productIds.Contains(p.Id)).ToListAsync(ct);
        foreach (var item in order.Items.Where(i => !i.IsDeleted))
        {
            var product = products.FirstOrDefault(p => p.Id == item.ProductId);
            if (product is not null)
                product.QuantityOnHand += item.Quantity;
        }
    }

    private static void RecalculateTotals(Order order)
    {
        var live = order.Items.Where(i => !i.IsDeleted).ToList();
        order.SubTotal = live.Sum(i => i.SalePriceAtSale * i.Quantity);
        order.DiscountTotal = live.Sum(i => i.DiscountAmount * i.Quantity);
        order.GrandTotal = live.Sum(i => i.LineTotal);
    }

    private static bool IsTransitionAllowed(OrderStatus from, OrderStatus to) => from switch
    {
        OrderStatus.Pending => to is OrderStatus.Confirmed or OrderStatus.Cancelled,
        OrderStatus.Confirmed => to is OrderStatus.Fulfilled or OrderStatus.Cancelled,
        _ => false // Fulfilled and Cancelled are terminal
    };

    private async Task<string> GenerateOrderNumberAsync(CancellationToken ct)
    {
        var year = DateTime.UtcNow.Year;
        // Count all orders (incl. soft-deleted) this year so numbers are never reused.
        var count = await _db.Orders.IgnoreQueryFilters()
            .CountAsync(o => o.OrderDate.Year == year, ct);
        return $"LV-{year}-{count + 1:D4}";
    }

    private async Task SaveWithConcurrencyGuardAsync(CancellationToken ct)
    {
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException(
                "Stock changed while placing this order. Please review and try again.");
        }
    }

    private static OrderDto MapToDto(Order o) => new(
        o.Id,
        o.OrderNumber,
        o.CustomerId,
        o.Customer?.Name ?? string.Empty,
        o.OrderDate,
        o.Status,
        o.SubTotal,
        o.DiscountTotal,
        o.GrandTotal,
        o.Notes,
        o.CreatedBy,
        o.Invoice != null,
        o.Invoice?.Id,
        o.Items.Where(i => !i.IsDeleted)
            .OrderBy(i => i.Id)
            .Select(i => new OrderItemDto(
                i.Id, i.ProductId, i.Product?.Name ?? string.Empty, i.Product?.SKU ?? string.Empty,
                i.Quantity, i.OriginalPriceAtSale, i.SalePriceAtSale, i.FinalPriceAtSale,
                i.DiscountAmount, i.LineTotal))
            .ToList());
}
