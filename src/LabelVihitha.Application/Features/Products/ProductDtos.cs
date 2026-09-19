namespace LabelVihitha.Application.Features.Products;

public record ProductVariantDto(int Id, string Size, int QuantityOnHand, decimal? CostPrice, decimal? SalePrice);
public record ProductVariantInput(string Size, int QuantityOnHand, decimal? CostPrice = null, decimal? SalePrice = null);

public record ProductCostComponentDto(int Id, string Label, int? VendorId, string? VendorName, decimal Amount);
public record ProductCostComponentInput(string Label, int? VendorId, decimal Amount);

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
    int UnitsSold,
    int ReorderThreshold,
    bool IsLowStock,
    string? ImageUrl,
    bool IsActive,
    IReadOnlyList<ProductVariantDto> Variants,
    IReadOnlyList<ProductCostComponentDto> CostComponents,
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
    // Optional per-unit cost lines by vendor (cloth, stitching, …). When provided & non-empty,
    // OriginalPrice is set to their sum and the direct OriginalPrice value is ignored.
    IReadOnlyList<ProductCostComponentInput>? CostComponents = null,
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
    IReadOnlyList<ProductVariantInput>? Variants = null,   // authoritative per-size stock when provided
    IReadOnlyList<ProductCostComponentInput>? CostComponents = null);   // per-unit cost lines by vendor; sum = OriginalPrice

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

// ---- Aggregate totals for a filtered product view (values at current prices, in USD) ----
public record ProductTotalsDto(int ProductCount, int TotalUnits, decimal TotalCostUsd, decimal TotalSaleUsd);

// ---- Faceted filter options: the values still available given the other active filters ----
public record FilterOptionDto(int Id, string Name);
public record ProductFilterOptionsDto(
    IReadOnlyList<FilterOptionDto> Categories,
    IReadOnlyList<FilterOptionDto> SubCategories,
    IReadOnlyList<FilterOptionDto> Inventories,
    IReadOnlyList<FilterOptionDto> Vendors);

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
