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
    IReadOnlyList<CategoryCount> Categories);

public record CreateInventoryRequest(string Name, string? Description, int? PaidByOwnerId);

public record UpdateInventoryRequest(string Name, string? Description, bool IsActive, int? PaidByOwnerId);
