using LabelVihitha.Application.Features.Products;

namespace LabelVihitha.Application.Features.Inventories;

public record InventoryDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    int? PaidByOwnerId,
    string? PaidByOwnerName,
    int ProductCount,
    int TotalUnits,
    decimal TotalCostUsd,
    IReadOnlyList<CategoryCount> Categories,
    IReadOnlyList<InventoryBillDto> Bills,
    decimal TotalBillsUsd);

public record CreateInventoryRequest(string Name, string? Description, int? PaidByOwnerId);

public record UpdateInventoryRequest(string Name, string? Description, bool IsActive, int? PaidByOwnerId);

// ---- Supplier bills attached to an inventory batch ----
public record InventoryBillDto(int Id, string FileUrl, string FileName, decimal? Amount, DateTime? BillDate, string? Note);

public record AddInventoryBillRequest(string FileUrl, string FileName, decimal? Amount, DateTime? BillDate, string? Note);
