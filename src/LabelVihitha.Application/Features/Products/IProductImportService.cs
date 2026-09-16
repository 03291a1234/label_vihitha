namespace LabelVihitha.Application.Features.Products;

public interface IProductImportService
{
    /// <summary>Bulk-create products (with size variants) from parsed spreadsheet rows,
    /// auto-creating any missing vendor / inventory / category / subcategory by name.</summary>
    Task<ProductImportResult> ImportAsync(IReadOnlyList<ProductImportRow> rows, CancellationToken ct = default);
}
