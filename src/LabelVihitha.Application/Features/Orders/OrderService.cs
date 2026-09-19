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
        var items = await ApplySort(q, query.SortBy, query.SortDir)
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
            .Include(o => o.Charges.Where(c => !c.IsDeleted))
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

        // Order date: backdated when supplied (e.g. logging a past sale), else now.
        var orderDate = request.OrderDate is DateTime d ? DateTime.SpecifyKind(d, DateTimeKind.Utc) : DateTime.UtcNow;

        var order = new Order
        {
            CustomerId = customer.Id,
            OrderDate = orderDate,
            Status = OrderStatus.Pending,
            Notes = request.Notes,
            OrderDiscount = request.OrderDiscount < 0 ? 0m : request.OrderDiscount,
            PromoCode = string.IsNullOrWhiteSpace(request.PromoCode) ? null : request.PromoCode.Trim().ToUpperInvariant(),
            CreatedBy = _currentUser.UserName ?? _currentUser.UserId,
            OrderNumber = await GenerateOrderNumberAsync(orderDate, ct)
        };

        foreach (var line in request.Items)
            order.Items.Add(await BuildLineAsync(line, ct));

        // Additional service charges (stitching, shipping…).
        if (request.Charges is not null)
            foreach (var c in request.Charges)
                if (!string.IsNullOrWhiteSpace(c.Label) && c.Amount > 0)
                    order.Charges.Add(new OrderCharge { Label = c.Label.Trim(), Amount = c.Amount });

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

        var product = await _db.Products.Include(p => p.Variants).FirstOrDefaultAsync(p => p.Id == item.ProductId, ct)
            ?? throw new NotFoundException(nameof(Product), item.ProductId);
        var variant = item.ProductVariantId is int vid ? product.Variants.FirstOrDefault(v => v.Id == vid) : null;

        // Adjust stock by the delta between old and new quantity (on the item's size variant).
        var delta = request.Quantity - item.Quantity;
        var available = variant?.QuantityOnHand ?? product.QuantityOnHand;
        if (delta > 0 && available < delta)
            throw new ConflictException(
                $"Insufficient stock for '{product.Name}'{(variant != null ? $" (size {variant.Size})" : "")}. Available: {available}.");
        product.QuantityOnHand -= delta;
        if (variant is not null) variant.QuantityOnHand -= delta;

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

        var product = await _db.Products.Include(p => p.Variants).FirstOrDefaultAsync(p => p.Id == item.ProductId, ct);
        if (product is not null)
            RestockItem(item, product); // return stock to the size variant

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
            .Include(o => o.Charges.Where(c => !c.IsDeleted))
            .FirstOrDefaultAsync(o => o.Id == orderId, ct)
            ?? throw new NotFoundException(nameof(Order), orderId);

        if (order.Status != OrderStatus.Pending)
            throw new ConflictException("Line items can only be changed while the order is Pending.");

        return order;
    }

    public async Task<OrderDto> AddChargeAsync(int orderId, OrderChargeInput request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Label))
            throw new ConflictException("A service needs a label.");
        if (request.Amount <= 0)
            throw new ConflictException("A service amount must be greater than zero.");

        var order = await LoadEditableOrderAsync(orderId, ct);
        order.Charges.Add(new OrderCharge { Label = request.Label.Trim(), Amount = request.Amount });
        RecalculateTotals(order);
        order.UpdatedAt = DateTime.UtcNow;
        await SaveWithConcurrencyGuardAsync(ct);
        return await GetByIdAsync(orderId, ct);
    }

    public async Task<OrderDto> RemoveChargeAsync(int orderId, int chargeId, CancellationToken ct = default)
    {
        var order = await LoadEditableOrderAsync(orderId, ct);
        var charge = order.Charges.FirstOrDefault(c => c.Id == chargeId && !c.IsDeleted)
            ?? throw new NotFoundException(nameof(OrderCharge), chargeId);
        charge.IsDeleted = true;
        charge.UpdatedAt = DateTime.UtcNow;
        RecalculateTotals(order);
        order.UpdatedAt = DateTime.UtcNow;
        await SaveWithConcurrencyGuardAsync(ct);
        return await GetByIdAsync(orderId, ct);
    }

    /// <summary>Builds a line, snapshotting prices and decrementing the chosen size's stock.</summary>
    private async Task<OrderItem> BuildLineAsync(CreateOrderItemRequest line, CancellationToken ct)
    {
        if (line.Quantity < 1)
            throw new ConflictException("Quantity must be at least 1.");

        var product = await _db.Products.Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == line.ProductId, ct)
            ?? throw new NotFoundException(nameof(Product), line.ProductId);

        var variant = ResolveVariant(product, line.ProductVariantId);
        if (variant.QuantityOnHand < line.Quantity)
            throw new ConflictException(
                $"Insufficient stock for '{product.Name}' (size {variant.Size}). Available: {variant.QuantityOnHand}.");

        variant.QuantityOnHand -= line.Quantity;
        product.QuantityOnHand -= line.Quantity;

        var finalPrice = line.FinalPrice ?? product.SalePrice;
        return new OrderItem
        {
            ProductId = product.Id,
            ProductVariantId = variant.Id,
            Size = variant.Size,
            Quantity = line.Quantity,
            OriginalPriceAtSale = product.OriginalPrice,
            SalePriceAtSale = product.SalePrice,
            FinalPriceAtSale = finalPrice,
            DiscountAmount = product.SalePrice - finalPrice,
            LineTotal = finalPrice * line.Quantity
        };
    }

    /// <summary>Pick the size variant to sell: the requested one, or the only one if unambiguous.</summary>
    private static ProductVariant ResolveVariant(Product product, int? variantId)
    {
        var active = product.Variants.Where(v => !v.IsDeleted).ToList();
        if (variantId is int vid)
            return active.FirstOrDefault(v => v.Id == vid)
                ?? throw new ConflictException($"The selected size is not available for '{product.Name}'.");
        if (active.Count == 1) return active[0];
        if (active.Count == 0) throw new ConflictException($"'{product.Name}' has no stock configured.");
        throw new ConflictException($"Select a size for '{product.Name}'.");
    }

    /// <summary>Return an item's quantity to its size variant (and the product total).</summary>
    private static void RestockItem(OrderItem item, Product product)
    {
        product.QuantityOnHand += item.Quantity;
        if (item.ProductVariantId is int vid)
        {
            var variant = product.Variants.FirstOrDefault(v => v.Id == vid);
            if (variant is not null) variant.QuantityOnHand += item.Quantity;
        }
    }

    private async Task RestockAsync(Order order, CancellationToken ct)
    {
        var productIds = order.Items.Where(i => !i.IsDeleted).Select(i => i.ProductId).ToList();
        var products = await _db.Products.Include(p => p.Variants)
            .Where(p => productIds.Contains(p.Id)).ToListAsync(ct);
        foreach (var item in order.Items.Where(i => !i.IsDeleted))
        {
            var product = products.FirstOrDefault(p => p.Id == item.ProductId);
            if (product is not null) RestockItem(item, product);
        }
    }

    private static IQueryable<Order> ApplySort(IQueryable<Order> q, string? sortBy, string? dir)
    {
        var desc = string.Equals(dir, "desc", StringComparison.OrdinalIgnoreCase);
        return sortBy?.ToLowerInvariant() switch
        {
            "ordernumber" => desc ? q.OrderByDescending(o => o.OrderNumber) : q.OrderBy(o => o.OrderNumber),
            "customername" => desc ? q.OrderByDescending(o => o.Customer.Name) : q.OrderBy(o => o.Customer.Name),
            "status" => desc ? q.OrderByDescending(o => o.Status) : q.OrderBy(o => o.Status),
            "grandtotal" => desc ? q.OrderByDescending(o => o.GrandTotal) : q.OrderBy(o => o.GrandTotal),
            "orderdate" => desc ? q.OrderByDescending(o => o.OrderDate) : q.OrderBy(o => o.OrderDate),
            _ => q.OrderByDescending(o => o.OrderDate)
        };
    }

    private static void RecalculateTotals(Order order)
    {
        var live = order.Items.Where(i => !i.IsDeleted).ToList();
        var lineSum = live.Sum(i => i.LineTotal);
        var chargesSum = order.Charges.Where(c => !c.IsDeleted).Sum(c => c.Amount);
        // The order-level discount can't take the product total below zero.
        var orderDiscount = Math.Min(Math.Max(order.OrderDiscount, 0m), lineSum);
        order.SubTotal = live.Sum(i => i.SalePriceAtSale * i.Quantity);
        order.DiscountTotal = live.Sum(i => i.DiscountAmount * i.Quantity) + orderDiscount;
        // Services are added on top of the discounted product total.
        order.GrandTotal = lineSum - orderDiscount + chargesSum;
    }

    private static bool IsTransitionAllowed(OrderStatus from, OrderStatus to) => from switch
    {
        OrderStatus.Pending => to is OrderStatus.Confirmed or OrderStatus.Cancelled,
        OrderStatus.Confirmed => to is OrderStatus.Fulfilled or OrderStatus.Cancelled,
        _ => false // Fulfilled and Cancelled are terminal
    };

    private async Task<string> GenerateOrderNumberAsync(DateTime orderDate, CancellationToken ct)
    {
        var year = orderDate.Year;
        // Count all orders (incl. soft-deleted) that year so numbers are never reused.
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
                i.ProductVariantId, i.Size,
                i.Quantity, i.OriginalPriceAtSale, i.SalePriceAtSale, i.FinalPriceAtSale,
                i.DiscountAmount, i.LineTotal))
            .ToList(),
        o.Charges.Where(c => !c.IsDeleted)
            .OrderBy(c => c.Id)
            .Select(c => new OrderChargeDto(c.Id, c.Label, c.Amount))
            .ToList(),
        o.Charges.Where(c => !c.IsDeleted).Sum(c => c.Amount));
}
