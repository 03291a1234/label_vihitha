using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Features.Finance;
using LabelVihitha.Domain.Entities;
using LabelVihitha.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Cash;

public class CashService : ICashService
{
    private readonly IApplicationDbContext _db;
    private readonly ISalesCostingService _costing;

    public CashService(IApplicationDbContext db, ISalesCostingService costing)
    {
        _db = db;
        _costing = costing;
    }

    public async Task<CashOverviewDto> GetOverviewAsync(CancellationToken ct = default)
    {
        var accounts = await _db.CashAccounts.AsNoTracking()
            .OrderBy(a => a.SortOrder).ThenBy(a => a.Name)
            .Select(a => new { a.Id, a.Name, a.IsCommon, a.OwnerId, OwnerName = a.Owner != null ? a.Owner.Name : null, a.IsActive, a.SortOrder })
            .ToListAsync(ct);

        // Net per account: money arriving (To) minus money leaving (From).
        var moves = await _db.CashMovements.AsNoTracking()
            .Select(m => new { m.Amount, m.FromAccountId, m.ToAccountId })
            .ToListAsync(ct);
        var inByAcct = moves.Where(m => m.ToAccountId != null).GroupBy(m => m.ToAccountId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));
        var outByAcct = moves.Where(m => m.FromAccountId != null).GroupBy(m => m.FromAccountId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        decimal Bal(int id) => (inByAcct.TryGetValue(id, out var i) ? i : 0m) - (outByAcct.TryGetValue(id, out var o) ? o : 0m);

        var dtos = accounts
            .Select(a => new CashAccountDto(a.Id, a.Name, a.IsCommon, a.OwnerId, a.OwnerName, Bal(a.Id), a.IsActive, a.SortOrder))
            .ToList();

        var tracked = dtos.Sum(a => a.Balance);
        var expected = await ExpectedCashAsync(ct);
        return new CashOverviewDto(dtos, tracked, expected, Math.Round(tracked - expected, 2));
    }

    /// <summary>The pooled cash the business should hold, computed the same way the P&amp;L does:
    /// owner contributions + sales collected − stock at cost − COGS − bills − expenses − withdrawals.</summary>
    private async Task<decimal> ExpectedCashAsync(CancellationToken ct)
    {
        var start = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = DateTime.UtcNow.AddDays(1);
        var sales = await _costing.GetSalesTotalsAsync(start, end, ct);
        var valuation = await _costing.GetValuationRowsAsync(ct);
        var invCost = valuation.Sum(p => p.EffCost);
        var bills = await _db.InventoryBills.AsNoTracking().Where(x => !x.Inventory.IsDeleted)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        var expenses = await _db.Expenses.AsNoTracking().SumAsync(e => (decimal?)e.Amount, ct) ?? 0m;
        var contributions = await _db.OwnerTransactions.AsNoTracking()
            .Where(t => t.Owner.IsActive && t.Type == OwnerTransactionType.Contribution)
            .SumAsync(t => (decimal?)t.Amount, ct) ?? 0m;
        var withdrawals = await _db.OwnerTransactions.AsNoTracking()
            .Where(t => t.Owner.IsActive && t.Type == OwnerTransactionType.Withdrawal)
            .SumAsync(t => (decimal?)t.Amount, ct) ?? 0m;
        return Math.Round(contributions + sales.Revenue - invCost - sales.Cogs - bills - expenses - withdrawals, 2);
    }

    public async Task<CashAccountDto> CreateAccountAsync(CreateCashAccountRequest r, CancellationToken ct = default)
    {
        var name = (r.Name ?? "").Trim();
        if (name.Length == 0) throw new ConflictException("Account name is required.");
        var acct = new CashAccount { Name = name, IsCommon = r.IsCommon, OwnerId = r.OwnerId, SortOrder = r.SortOrder, IsActive = true };
        _db.CashAccounts.Add(acct);
        await _db.SaveChangesAsync(ct);
        return new CashAccountDto(acct.Id, acct.Name, acct.IsCommon, acct.OwnerId, null, 0m, acct.IsActive, acct.SortOrder);
    }

    public async Task<CashAccountDto> UpdateAccountAsync(int id, UpdateCashAccountRequest r, CancellationToken ct = default)
    {
        var acct = await _db.CashAccounts.FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw new NotFoundException(nameof(CashAccount), id);
        acct.Name = (r.Name ?? "").Trim();
        acct.IsCommon = r.IsCommon;
        acct.OwnerId = r.OwnerId;
        acct.IsActive = r.IsActive;
        acct.SortOrder = r.SortOrder;
        await _db.SaveChangesAsync(ct);
        var ownerName = acct.OwnerId == null ? null
            : await _db.Owners.AsNoTracking().Where(o => o.Id == acct.OwnerId).Select(o => o.Name).FirstOrDefaultAsync(ct);
        return new CashAccountDto(acct.Id, acct.Name, acct.IsCommon, acct.OwnerId, ownerName, 0m, acct.IsActive, acct.SortOrder);
    }

    public async Task DeleteAccountAsync(int id, CancellationToken ct = default)
    {
        var acct = await _db.CashAccounts.FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw new NotFoundException(nameof(CashAccount), id);
        var used = await _db.CashMovements.AnyAsync(m => m.FromAccountId == id || m.ToAccountId == id, ct);
        if (used) throw new ConflictException("This account has cash movements — deactivate it instead of deleting.");
        acct.IsDeleted = true;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<CashMovementDto>> GetMovementsAsync(int? accountId, CancellationToken ct = default)
    {
        var q = _db.CashMovements.AsNoTracking().AsQueryable();
        if (accountId is int aid) q = q.Where(m => m.FromAccountId == aid || m.ToAccountId == aid);
        return await q.OrderByDescending(m => m.Date).ThenByDescending(m => m.Id)
            .Select(m => new CashMovementDto(m.Id, m.Date, m.Kind, m.Amount,
                m.FromAccountId, m.FromAccount != null ? m.FromAccount.Name : null,
                m.ToAccountId, m.ToAccount != null ? m.ToAccount.Name : null, m.Note))
            .ToListAsync(ct);
    }

    public async Task<CashMovementDto> RecordMovementAsync(RecordCashMovementRequest r, CancellationToken ct = default)
    {
        if (r.Amount <= 0) throw new ConflictException("Amount must be greater than zero.");
        int? from = r.FromAccountId, to = r.ToAccountId;
        switch (r.Kind)
        {
            case CashMovementKind.Transfer:
                if (from is null || to is null) throw new ConflictException("A transfer needs both a From and a To account.");
                if (from == to) throw new ConflictException("From and To must be different accounts.");
                break;
            case CashMovementKind.CashIn:
            case CashMovementKind.Opening:
                if (to is null) throw new ConflictException("Money in needs a destination account.");
                from = null;
                break;
            case CashMovementKind.CashOut:
                if (from is null) throw new ConflictException("Money out needs a source account.");
                to = null;
                break;
        }
        await EnsureAccountAsync(from, ct);
        await EnsureAccountAsync(to, ct);

        var m = new CashMovement
        {
            Date = DateTime.SpecifyKind(r.Date, DateTimeKind.Utc),
            Kind = r.Kind, Amount = r.Amount, FromAccountId = from, ToAccountId = to,
            Note = string.IsNullOrWhiteSpace(r.Note) ? null : r.Note.Trim()
        };
        _db.CashMovements.Add(m);
        await _db.SaveChangesAsync(ct);

        var names = await _db.CashAccounts.AsNoTracking()
            .Where(a => a.Id == from || a.Id == to)
            .ToDictionaryAsync(a => a.Id, a => a.Name, ct);
        return new CashMovementDto(m.Id, m.Date, m.Kind, m.Amount,
            m.FromAccountId, from is int f && names.TryGetValue(f, out var fn) ? fn : null,
            m.ToAccountId, to is int t && names.TryGetValue(t, out var tn) ? tn : null, m.Note);
    }

    public async Task DeleteMovementAsync(int id, CancellationToken ct = default)
    {
        var m = await _db.CashMovements.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException(nameof(CashMovement), id);
        m.IsDeleted = true;
        await _db.SaveChangesAsync(ct);
    }

    private async Task EnsureAccountAsync(int? id, CancellationToken ct)
    {
        if (id is null) return;
        if (!await _db.CashAccounts.AnyAsync(a => a.Id == id, ct))
            throw new NotFoundException(nameof(CashAccount), id);
    }
}
