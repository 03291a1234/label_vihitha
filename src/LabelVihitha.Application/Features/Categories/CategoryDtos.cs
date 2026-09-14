namespace LabelVihitha.Application.Features.Categories;

public record CategoryDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    decimal? DefaultOriginalPrice,
    decimal? DefaultSalePrice,
    int ProductCount);

public record CreateCategoryRequest(
    string Name,
    string? Description,
    decimal? DefaultOriginalPrice,
    decimal? DefaultSalePrice);

public record UpdateCategoryRequest(
    string Name,
    string? Description,
    bool IsActive,
    decimal? DefaultOriginalPrice,
    decimal? DefaultSalePrice);
