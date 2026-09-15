namespace LabelVihitha.Application.Features.Vendors;

public interface IVendorService
{
    Task<IReadOnlyList<VendorDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default);
    Task<VendorDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<VendorDto> CreateAsync(CreateVendorRequest request, CancellationToken ct = default);
    Task<VendorDto> UpdateAsync(int id, UpdateVendorRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
