namespace LabelVihitha.Application.Features.SubCategories;

public record SubCategoryDto(
    int Id,
    int CategoryId,
    string CategoryName,
    string Name,
    string? Description,
    bool IsActive,
    int ProductCount);

public record CreateSubCategoryRequest(
    int CategoryId,
    string Name,
    string? Description);

public record UpdateSubCategoryRequest(
    string Name,
    string? Description,
    bool IsActive);
