using LabelVihitha.Application.Features.Store;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Public storefront — anonymous browsing and guest checkout.</summary>
[ApiController]
[AllowAnonymous]
[Route("api/store")]
public class StoreController : ControllerBase
{
    private readonly IStoreService _store;

    public StoreController(IStoreService store) => _store = store;

    [HttpGet("products")]
    public async Task<ActionResult<IReadOnlyList<StoreProductDto>>> Products(
        [FromQuery] string? search, [FromQuery] int? categoryId, CancellationToken ct)
        => Ok(await _store.GetProductsAsync(search, categoryId, ct));

    [HttpPost("checkout")]
    public async Task<ActionResult<StoreCheckoutResult>> Checkout(StoreCheckoutRequest request, CancellationToken ct)
        => Ok(await _store.CheckoutAsync(request, ct));
}
