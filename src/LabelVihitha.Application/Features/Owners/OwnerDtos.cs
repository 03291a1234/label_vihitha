using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Application.Features.Owners;

public record OwnerTransactionDto(int Id, int OwnerId, DateTime Date, OwnerTransactionType Type, decimal Amount, string? Notes);

public record OwnerDto(
    int Id,
    string Name,
    string? Email,
    string? Phone,
    string? Notes,
    decimal ProfitSharePercent,
    bool IsActive,
    decimal TotalContributions,
    decimal TotalWithdrawals);

public record CreateOwnerRequest(string Name, string? Email, string? Phone, string? Notes, decimal ProfitSharePercent);
public record UpdateOwnerRequest(string Name, string? Email, string? Phone, string? Notes, decimal ProfitSharePercent, bool IsActive);

public record CreateOwnerTransactionRequest(DateTime Date, OwnerTransactionType Type, decimal Amount, string? Notes);
