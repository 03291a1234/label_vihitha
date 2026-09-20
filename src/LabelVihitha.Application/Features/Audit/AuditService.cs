using LabelVihitha.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Audit;

public record AuditEntryDto(int Id, string EntityName, string EntityId, string Action,
    string? ChangedBy, DateTime ChangedAt, string? OldValues, string? NewValues);

public record AuditPage(IReadOnlyList<AuditEntryDto> Items, int Total, int Page, int PageSize);

public interface IAuditService
{
    Task<AuditPage> QueryAsync(string? entity, string? action, DateTime? from, DateTime? to,
        int page, int pageSize, CancellationToken ct = default);
    Task<IReadOnlyList<string>> EntityNamesAsync(CancellationToken ct = default);
}

public class AuditService : IAuditService
{
    private readonly IApplicationDbContext _db;
    public AuditService(IApplicationDbContext db) => _db = db;

    public async Task<AuditPage> QueryAsync(string? entity, string? action, DateTime? from, DateTime? to,
        int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 200 ? 50 : pageSize;

        var q = _db.AuditLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(entity)) q = q.Where(a => a.EntityName == entity);
        if (!string.IsNullOrWhiteSpace(action)) q = q.Where(a => a.Action == action);
        if (from is DateTime f) q = q.Where(a => a.ChangedAt >= f);
        if (to is DateTime t) q = q.Where(a => a.ChangedAt <= t);

        var total = await q.CountAsync(ct);
        var items = await q.OrderByDescending(a => a.ChangedAt).ThenByDescending(a => a.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(a => new AuditEntryDto(a.Id, a.EntityName, a.EntityId, a.Action,
                a.ChangedBy, a.ChangedAt, a.OldValues, a.NewValues))
            .ToListAsync(ct);

        return new AuditPage(items, total, page, pageSize);
    }

    public async Task<IReadOnlyList<string>> EntityNamesAsync(CancellationToken ct = default) =>
        await _db.AuditLogs.AsNoTracking().Select(a => a.EntityName).Distinct().OrderBy(n => n).ToListAsync(ct);
}
