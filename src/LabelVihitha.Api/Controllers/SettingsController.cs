using LabelVihitha.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace LabelVihitha.Api.Controllers;

/// <summary>Public, read-only client settings (currency rate, etc.) so the UI has one source of truth.</summary>
[ApiController]
[Route("api/settings")]
[AllowAnonymous]
public class SettingsController : ControllerBase
{
    private readonly CurrencySettings _currency;
    public SettingsController(IOptions<CurrencySettings> currency) => _currency = currency.Value;

    [HttpGet]
    public ActionResult<ClientSettings> Get() => Ok(new ClientSettings(_currency.InrPerUsd));

    public record ClientSettings(decimal InrPerUsd);
}
