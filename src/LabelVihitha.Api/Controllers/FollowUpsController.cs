using LabelVihitha.Application.Common.Models;
using LabelVihitha.Application.Features.FollowUps;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Order-scoped follow-up routes: /api/orders/{orderId}/follow-ups</summary>
[ApiController]
[Authorize]
[Route("api/orders/{orderId:int}/follow-ups")]
public class OrderFollowUpsController : ControllerBase
{
    private const string ManageRoles = "Admin,Owner";
    private readonly IFollowUpService _service;

    public OrderFollowUpsController(IFollowUpService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FollowUpDto>>> GetForOrder(int orderId, CancellationToken ct)
        => Ok(await _service.GetForOrderAsync(orderId, ct));

    [HttpPost]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<FollowUpDto>> Create(int orderId, CreateFollowUpRequest request, CancellationToken ct)
        => Ok(await _service.CreateAsync(orderId, request, ct));
}

/// <summary>Cross-order follow-up dashboard: /api/follow-ups</summary>
[ApiController]
[Authorize]
[Route("api/follow-ups")]
public class FollowUpsController : ControllerBase
{
    private const string ManageRoles = "Admin,Owner";
    private readonly IFollowUpService _service;

    public FollowUpsController(IFollowUpService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<PagedResult<FollowUpDto>>> GetDashboard(
        [FromQuery] FollowUpQuery query, CancellationToken ct)
        => Ok(await _service.GetDashboardAsync(query, ct));

    [HttpPut("{id:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<FollowUpDto>> Update(int id, UpdateFollowUpRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));
}
