namespace LabelVihitha.Application.Features.Cash;

public interface ICashService
{
    Task<CashOverviewDto> GetOverviewAsync(CancellationToken ct = default);
    Task<CashAccountDto> CreateAccountAsync(CreateCashAccountRequest request, CancellationToken ct = default);
    Task<CashAccountDto> UpdateAccountAsync(int id, UpdateCashAccountRequest request, CancellationToken ct = default);
    Task DeleteAccountAsync(int id, CancellationToken ct = default);

    Task<IReadOnlyList<CashMovementDto>> GetMovementsAsync(int? accountId, CancellationToken ct = default);
    Task<CashMovementDto> RecordMovementAsync(RecordCashMovementRequest request, CancellationToken ct = default);
    Task DeleteMovementAsync(int id, CancellationToken ct = default);
}
