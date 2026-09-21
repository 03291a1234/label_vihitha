using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Application.Features.Cash;

public record CashAccountDto(
    int Id, string Name, bool IsCommon, int? OwnerId, string? OwnerName,
    decimal Balance, bool IsActive, int SortOrder);

public record CashMovementDto(
    int Id, DateTime Date, CashMovementKind Kind, decimal Amount,
    int? FromAccountId, string? FromAccountName,
    int? ToAccountId, string? ToAccountName, string? Note);

/// <summary>Accounts with their balances, plus a reconciliation against the pooled cash figure
/// the P&amp;L computes. TrackedTotal should equal ExpectedCash when every flow has been logged.</summary>
public record CashOverviewDto(
    IReadOnlyList<CashAccountDto> Accounts,
    decimal TrackedTotal,
    decimal ExpectedCash,
    decimal Difference);

public record CreateCashAccountRequest(string Name, bool IsCommon, int? OwnerId, int SortOrder = 0);
public record UpdateCashAccountRequest(string Name, bool IsCommon, int? OwnerId, bool IsActive, int SortOrder);

public record RecordCashMovementRequest(
    DateTime Date, CashMovementKind Kind, decimal Amount,
    int? FromAccountId, int? ToAccountId, string? Note);
