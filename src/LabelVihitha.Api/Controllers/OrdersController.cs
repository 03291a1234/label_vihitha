using LabelVihitha.Application.Common.Models;
using LabelVihitha.Application.Features.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private const string ManageRoles = "Owner,Staff";
    private readonly IOrderService _service;

    public OrdersController(IOrderService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<PagedResult<OrderListItemDto>>> Get(
        [FromQuery] OrderQuery query, CancellationToken ct)
        => Ok(await _service.GetAsync(query, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> GetById(int id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    [HttpPost]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<OrderDto>> Create(CreateOrderRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}/status")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<OrderDto>> UpdateStatus(int id, UpdateOrderStatusRequest request, CancellationToken ct)
        => Ok(await _service.UpdateStatusAsync(id, request, ct));

    // ---- line items (only while Pending) ----

    [HttpPost("{id:int}/items")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<OrderDto>> AddItem(int id, CreateOrderItemRequest request, CancellationToken ct)
        => Ok(await _service.AddItemAsync(id, request, ct));

    [HttpPut("{id:int}/items/{itemId:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<OrderDto>> UpdateItem(int id, int itemId, UpdateOrderItemRequest request, CancellationToken ct)
        => Ok(await _service.UpdateItemAsync(id, itemId, request, ct));

    [HttpDelete("{id:int}/items/{itemId:int}")]
    [Authorize(Roles = ManageRoles)]
    public async Task<ActionResult<OrderDto>> RemoveItem(int id, int itemId, CancellationToken ct)
        => Ok(await _service.RemoveItemAsync(id, itemId, ct));
}
