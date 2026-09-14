namespace LabelVihitha.Application.Features.Products;

public record ProductDto(
    int Id,
    int CategoryId,
    string CategoryName,
    int? SubCategoryId,
    string? SubCategoryName,
    string SKU,
    string Name,
    string? Description,
    string? Size,
    string? Color,
    string? Material,
    decimal OriginalPrice,
    decimal SalePrice,
    int QuantityOnHand,
    int ReorderThreshold,
    bool IsLowStock,
    string? ImageUrl,
    bool IsActive,
    string RowVersion);

public record CreateProductRequest(
    int CategoryId,
    int? SubCategoryId,
    string SKU,
    string Name,
    string? Description,
    string? Size,
    string? Color,
    string? Material,
    decimal? OriginalPrice,   // nullable → inherit category default when omitted
    decimal? SalePrice,
    int QuantityOnHand,
    int ReorderThreshold,
    string? ImageUrl);

public record UpdateProductRequest(
    int CategoryId,
    int? SubCategoryId,
    string SKU,
    string Name,
    string? Description,
    string? Size,
    string? Color,
    string? Material,
    decimal OriginalPrice,
    decimal SalePrice,
    int QuantityOnHand,
    int ReorderThreshold,
    string? ImageUrl,
    bool IsActive,
    string RowVersion);   // base64 concurrency token

public record ProductQuery(
    int? CategoryId = null,
    int? SubCategoryId = null,
    bool? IsActive = null,
    bool LowStockOnly = false,
    string? Search = null,
    int Page = 1,
    int PageSize = 25);
