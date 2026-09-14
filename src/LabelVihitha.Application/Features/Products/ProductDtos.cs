namespace LabelVihitha.Application.Features.Products;

public record ProductDto(
    int Id,
    int CategoryId,
    string CategoryName,
    int? SubCategoryId,
    string? SubCategoryName,
    int? InventoryId,
    string? InventoryName,
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
    int? InventoryId,
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
    int? InventoryId,
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

// ---- Inventory count summary (by category → subcategory) ----
public record SubCategoryCount(int? SubCategoryId, string SubCategoryName, int ProductCount, int TotalUnits);
public record CategoryCount(int CategoryId, string CategoryName, int ProductCount, int TotalUnits,
    IReadOnlyList<SubCategoryCount> SubCategories);
public record InventorySummary(int TotalProducts, int TotalUnits, IReadOnlyList<CategoryCount> Categories);

public record ProductQuery(
    int? CategoryId = null,
    int? SubCategoryId = null,
    int? InventoryId = null,
    bool? IsActive = null,
    bool LowStockOnly = false,
    string? Search = null,
    string? SortBy = null,
    string? SortDir = null,
    int Page = 1,
    int PageSize = 25);
