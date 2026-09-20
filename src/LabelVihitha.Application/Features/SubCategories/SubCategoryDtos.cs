namespace LabelVihitha.Application.Features.SubCategories;

public record SubCategoryDto(
    int Id,
    int CategoryId,
    string CategoryName,
    string Name,
    string? Description,
    bool IsActive,
    int ProductCount,
    IReadOnlyList<string> Sizes,
    string? ImageUrl);

public record CreateSubCategoryRequest(
    int CategoryId,
    string Name,
    string? Description,
    IReadOnlyList<string>? Sizes,
    string? ImageUrl = null);

public record UpdateSubCategoryRequest(
    string Name,
    string? Description,
    bool IsActive,
    IReadOnlyList<string>? Sizes,
    string? ImageUrl = null);
