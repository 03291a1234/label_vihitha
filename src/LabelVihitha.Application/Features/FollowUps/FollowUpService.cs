using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Common.Models;
using LabelVihitha.Domain.Entities;
using LabelVihitha.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.FollowUps;

public class FollowUpService : IFollowUpService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public FollowUpService(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<FollowUpDto>> GetForOrderAsync(int orderId, CancellationToken ct = default)
    {
        if (!await _db.Orders.AnyAsync(o => o.Id == orderId, ct))
            throw new NotFoundException(nameof(Order), orderId);

        var now = DateTime.UtcNow;
        var items = await _db.OrderFollowUps.AsNoTracking()
            .Include(f => f.Order)
            .Include(f => f.OrderItem).ThenInclude(i => i!.Product)
            .Where(f => f.OrderId == orderId)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync(ct);

        return items.Select(f => MapToDto(f, now)).ToList();
    }

    public async Task<FollowUpDto> CreateAsync(int orderId, CreateFollowUpRequest request, CancellationToken ct = default)
    {
        var order = await _db.Orders
            .Include(o => o.Items.Where(i => !i.IsDeleted))
            .FirstOrDefaultAsync(o => o.Id == orderId, ct)
            ?? throw new NotFoundException(nameof(Order), orderId);

        if (request.OrderItemId is int itemId &&
            order.Items.All(i => i.Id != itemId))
        {
            throw new ConflictException($"Order item {itemId} does not belong to order {order.OrderNumber}.");
        }

        var entity = new OrderFollowUp
        {
            OrderId = orderId,
            OrderItemId = request.OrderItemId,
            Note = request.Note.Trim(),
            FollowUpDate = request.FollowUpDate,
            Status = FollowUpStatus.Open,
            CreatedBy = _currentUser.UserName ?? _currentUser.UserId
        };

        _db.OrderFollowUps.Add(entity);
        await _db.SaveChangesAsync(ct);
        return await GetSingleAsync(entity.Id, ct);
    }

    public async Task<FollowUpDto> UpdateAsync(int id, UpdateFollowUpRequest request, CancellationToken ct = default)
    {
        var entity = await _db.OrderFollowUps.FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw new NotFoundException(nameof(OrderFollowUp), id);

        entity.Status = request.Status;
        if (!string.IsNullOrWhiteSpace(request.Note))
            entity.Note = request.Note.Trim();
        entity.FollowUpDate = request.FollowUpDate ?? entity.FollowUpDate;

        if (request.Status == FollowUpStatus.Resolved)
        {
            entity.ResolvedAt = DateTime.UtcNow;
            entity.ResolutionNote = request.ResolutionNote;
        }
        else
        {
            // Re-opening clears the resolution.
            entity.ResolvedAt = null;
            entity.ResolutionNote = null;
        }

        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetSingleAsync(id, ct);
    }

    public async Task<PagedResult<FollowUpDto>> GetDashboardAsync(FollowUpQuery query, CancellationToken ct = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 200 ? 50 : query.PageSize;
        var now = DateTime.UtcNow;

        var q = _db.OrderFollowUps.AsNoTracking()
            .Include(f => f.Order)
            .Include(f => f.OrderItem).ThenInclude(i => i!.Product)
            .AsQueryable();

        if (query.Status is FollowUpStatus st)
            q = q.Where(f => f.Status == st);
        else if (query.OpenOnly)
            q = q.Where(f => f.Status != FollowUpStatus.Resolved);

        if (query.OverdueOnly)
            q = q.Where(f => f.FollowUpDate != null && f.FollowUpDate < now && f.Status != FollowUpStatus.Resolved);

        if (!string.IsNullOrWhiteSpace(query.CreatedBy))
            q = q.Where(f => f.CreatedBy == query.CreatedBy);

        var total = await q.CountAsync(ct);
        var items = await q
            // Overdue first, then soonest due date, then newest.
            .OrderBy(f => f.FollowUpDate == null)
            .ThenBy(f => f.FollowUpDate)
            .ThenByDescending(f => f.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<FollowUpDto>
        {
            Items = items.Select(f => MapToDto(f, now)).ToList(),
            TotalCount = total, Page = page, PageSize = pageSize
        };
    }

    private async Task<FollowUpDto> GetSingleAsync(int id, CancellationToken ct)
    {
        var entity = await _db.OrderFollowUps.AsNoTracking()
            .Include(f => f.Order)
            .Include(f => f.OrderItem).ThenInclude(i => i!.Product)
            .FirstAsync(f => f.Id == id, ct);
        return MapToDto(entity, DateTime.UtcNow);
    }

    private static FollowUpDto MapToDto(OrderFollowUp f, DateTime now) => new(
        f.Id,
        f.OrderId,
        f.Order?.OrderNumber ?? string.Empty,
        f.OrderItemId,
        f.OrderItem?.Product?.Name,
        f.Note,
        f.FollowUpDate,
        f.Status,
        f.CreatedBy,
        f.CreatedAt,
        f.ResolvedAt,
        f.ResolutionNote,
        f.FollowUpDate.HasValue && f.FollowUpDate < now && f.Status != FollowUpStatus.Resolved);
}
