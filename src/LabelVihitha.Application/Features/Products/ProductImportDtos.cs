namespace LabelVihitha.Application.Features.Products;

/// <summary>One parsed spreadsheet row (a single size line of a product).</summary>
public record ProductImportRow(
    int RowNumber,
    string? Vendor,
    string? Inventory,
    string? Category,
    string? SubCategory,
    string? Sku,
    string? Name,
    string? Size,
    int Qty,
    decimal? CostInr,
    decimal? SaleUsd,
    int? ReorderThreshold,
    string? Color,
    string? Material,
    string? Description,
    string? PaidByOwner = null,
    // Optional pricing helpers: when Cost/Sale are blank, they are derived from these.
    decimal? RateInr = null,
    decimal? GstPct = null,
    decimal? DiscountPct = null,
    decimal? MarkupPct = null,
    decimal? RoundInr = null);

public record ProductImportResult(
    int ProductsCreated,
    int VariantsCreated,
    int RowsProcessed,
    IReadOnlyList<string> CreatedVendors,
    IReadOnlyList<string> CreatedInventories,
    IReadOnlyList<string> CreatedCategories,
    IReadOnlyList<string> CreatedSubCategories,
    IReadOnlyList<string> Errors);
