using LabelVihitha.Application.Common.Models;

namespace LabelVihitha.Application.Features.Products;

public interface IProductService
{
    Task<PagedResult<ProductDto>> GetAsync(ProductQuery query, CancellationToken ct = default);
    Task<ProductTotalsDto> GetTotalsAsync(ProductQuery query, CancellationToken ct = default);
    Task<ProductFilterOptionsDto> GetFilterOptionsAsync(ProductQuery query, CancellationToken ct = default);
    Task<InventorySummary> GetInventorySummaryAsync(ProductQuery? query = null, CancellationToken ct = default);
    Task<ProductDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<string> NextSkuAsync(int? categoryId, int? subCategoryId, int? vendorId, CancellationToken ct = default);
    Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct = default);
    Task<ProductDto> UpdateAsync(int id, UpdateProductRequest request, CancellationToken ct = default);
    Task<BulkSetPaidByResult> BulkSetPaidByOwnerAsync(BulkSetPaidByRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
