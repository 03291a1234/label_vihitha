using LabelVihitha.Application.Features.Promotions;
using LabelVihitha.Application.Features.Store;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace LabelVihitha.Api.Controllers;

/// <summary>Public storefront — anonymous browsing and guest checkout. Rate-limited to curb abuse.</summary>
[ApiController]
[AllowAnonymous]
[EnableRateLimiting("public")]
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
    {
        // A manual (ad-hoc) discount is a staff privilege — honour it only when an authenticated
        // Owner/Admin token is present; a public/guest checkout can never apply one.
        var isStaff = User.Identity?.IsAuthenticated == true && (User.IsInRole("Owner") || User.IsInRole("Admin"));
        if (!isStaff && request.ManualDiscount != 0m)
            request = request with { ManualDiscount = 0m };
        return Ok(await _store.CheckoutAsync(request, ct));
    }

    [HttpPost("validate-promo")]
    public async Task<ActionResult<PromoValidationResult>> ValidatePromo(StorePromoRequest request, CancellationToken ct)
        => Ok(await _store.ValidatePromoAsync(request, ct));
}
