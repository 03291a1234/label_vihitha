namespace LabelVihitha.Application.Features.Owners;

public interface IOwnerService
{
    Task<IReadOnlyList<OwnerDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default);
    Task<OwnerDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<OwnerDto> CreateAsync(CreateOwnerRequest request, CancellationToken ct = default);
    Task<OwnerDto> UpdateAsync(int id, UpdateOwnerRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);

    Task<IReadOnlyList<OwnerTransactionDto>> GetTransactionsAsync(int ownerId, CancellationToken ct = default);
    Task<OwnerTransactionDto> AddTransactionAsync(int ownerId, CreateOwnerTransactionRequest request, CancellationToken ct = default);
    Task DeleteTransactionAsync(int ownerId, int transactionId, CancellationToken ct = default);
}
