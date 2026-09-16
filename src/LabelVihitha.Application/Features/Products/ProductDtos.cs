namespace LabelVihitha.Application.Features.Products;

public record ProductVariantDto(int Id, string Size, int QuantityOnHand);
public record ProductVariantInput(string Size, int QuantityOnHand);

public record ProductDto(
    int Id,
    int CategoryId,
    string CategoryName,
    int? SubCategoryId,
    string? SubCategoryName,
    int? InventoryId,
    string? InventoryName,
    int? VendorId,
    string? VendorName,
    int? PaidByOwnerId,
    string? PaidByOwnerName,
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
    IReadOnlyList<ProductVariantDto> Variants,
    string RowVersion);

public record CreateProductRequest(
    int CategoryId,
    int? SubCategoryId,
    int? InventoryId,
    int? VendorId,
    int? PaidByOwnerId,
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
    string? ImageUrl,
    IReadOnlyList<ProductVariantInput>? Variants = null,   // authoritative per-size stock when provided
    // When true and a PaidByOwner + cost are set, also post that owner a capital Contribution
    // equal to the total cost (use when they paid out-of-pocket, not from the shared account).
    bool RecordOwnerContribution = false);

public record UpdateProductRequest(
    int CategoryId,
    int? SubCategoryId,
    int? InventoryId,
    int? VendorId,
    int? PaidByOwnerId,
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
    string RowVersion,   // base64 concurrency token
    IReadOnlyList<ProductVariantInput>? Variants = null);   // authoritative per-size stock when provided

// ---- Bulk "set paid-by owner" over a filtered set of products ----
public record BulkSetPaidByRequest(
    int? CategoryId,
    int? SubCategoryId,
    int? InventoryId,
    int? VendorId,
    bool LowStockOnly,
    string? Search,
    int? PaidByOwnerId,                        // null clears the per-product override
    bool RecordOwnerContribution = false);     // when set + owner, post ONE contribution = total cost

public record BulkSetPaidByResult(int ProductsUpdated, decimal TotalCost, bool ContributionPosted);

// ---- Inventory count summary (by category → subcategory) ----
public record SubCategoryCount(int? SubCategoryId, string SubCategoryName, int ProductCount, int TotalUnits);
public record CategoryCount(int CategoryId, string CategoryName, int ProductCount, int TotalUnits,
    IReadOnlyList<SubCategoryCount> SubCategories);
public record InventorySummary(int TotalProducts, int TotalUnits, IReadOnlyList<CategoryCount> Categories);

public record ProductQuery(
    int? CategoryId = null,
    int? SubCategoryId = null,
    int? InventoryId = null,
    int? VendorId = null,
    bool? IsActive = null,
    bool LowStockOnly = false,
    string? Search = null,
    string? SortBy = null,
    string? SortDir = null,
    int Page = 1,
    int PageSize = 25);
