namespace LabelVihitha.Application.Features.Categories;

public record CategoryDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    int ProductCount,
    string? ImageUrl);

public record CreateCategoryRequest(
    string Name,
    string? Description,
    string? ImageUrl = null);

public record UpdateCategoryRequest(
    string Name,
    string? Description,
    bool IsActive,
    string? ImageUrl = null);
