using LabelVihitha.Application.Features.Audit;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Read-only change trail. Admin/Owner only — it can expose old/new field values.</summary>
[ApiController]
[Authorize(Roles = "Admin,Owner")]
[Route("api/audit")]
public class AuditController : ControllerBase
{
    private readonly IAuditService _audit;
    public AuditController(IAuditService audit) => _audit = audit;

    [HttpGet]
    public async Task<ActionResult<AuditPage>> Query(
        [FromQuery] string? entity, [FromQuery] string? action,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
        => Ok(await _audit.QueryAsync(entity, action, from, to, page, pageSize, ct));

    [HttpGet("entities")]
    public async Task<ActionResult<IReadOnlyList<string>>> Entities(CancellationToken ct)
        => Ok(await _audit.EntityNamesAsync(ct));
}
