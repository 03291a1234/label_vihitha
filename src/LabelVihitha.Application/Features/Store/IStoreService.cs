namespace LabelVihitha.Application.Features.Store;

public interface IStoreService
{
    Task<IReadOnlyList<StoreProductDto>> GetProductsAsync(string? search, int? categoryId, CancellationToken ct = default);
    Task<StoreCheckoutResult> CheckoutAsync(StoreCheckoutRequest request, CancellationToken ct = default);
}
