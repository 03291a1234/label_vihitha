namespace LabelVihitha.Application.Features.Customers;

public interface ICustomerService
{
    Task<IReadOnlyList<CustomerDto>> GetAllAsync(string? search, CancellationToken ct = default);
    Task<CustomerDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken ct = default);
    Task<CustomerDto> UpdateAsync(int id, UpdateCustomerRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
