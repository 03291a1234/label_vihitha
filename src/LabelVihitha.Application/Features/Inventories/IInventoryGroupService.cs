namespace LabelVihitha.Application.Features.Inventories;

public interface IInventoryGroupService
{
    Task<IReadOnlyList<InventoryDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default);
    Task<InventoryDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<InventoryDto> CreateAsync(CreateInventoryRequest request, CancellationToken ct = default);
    Task<InventoryDto> UpdateAsync(int id, UpdateInventoryRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);

    Task<InventoryBillDto> AddBillAsync(int inventoryId, AddInventoryBillRequest request, CancellationToken ct = default);
    Task DeleteBillAsync(int inventoryId, int billId, CancellationToken ct = default);

    Task<ApplyShippingResult> ApplyShippingAsync(int inventoryId, ApplyShippingRequest request, CancellationToken ct = default);
}
