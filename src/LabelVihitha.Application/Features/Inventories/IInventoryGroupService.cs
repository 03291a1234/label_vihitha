namespace LabelVihitha.Application.Features.Inventories;

public interface IInventoryGroupService
{
    Task<IReadOnlyList<InventoryDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default);
    Task<InventoryDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<InventoryDto> CreateAsync(CreateInventoryRequest request, CancellationToken ct = default);
    Task<InventoryDto> UpdateAsync(int id, UpdateInventoryRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
