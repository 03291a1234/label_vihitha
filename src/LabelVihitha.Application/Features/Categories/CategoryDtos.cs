namespace LabelVihitha.Application.Features.Categories;

public record CategoryDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    int ProductCount);

public record CreateCategoryRequest(
    string Name,
    string? Description);

public record UpdateCategoryRequest(
    string Name,
    string? Description,
    bool IsActive);
