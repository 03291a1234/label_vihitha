namespace LabelVihitha.Application.Features.Inventories;

public record InventoryDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    int ProductCount);

public record CreateInventoryRequest(string Name, string? Description);

public record UpdateInventoryRequest(string Name, string? Description, bool IsActive);
