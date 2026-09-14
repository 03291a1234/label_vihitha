using LabelVihitha.Application.Common.Models;

namespace LabelVihitha.Application.Features.FollowUps;

public interface IFollowUpService
{
    Task<IReadOnlyList<FollowUpDto>> GetForOrderAsync(int orderId, CancellationToken ct = default);
    Task<FollowUpDto> CreateAsync(int orderId, CreateFollowUpRequest request, CancellationToken ct = default);
    Task<FollowUpDto> UpdateAsync(int id, UpdateFollowUpRequest request, CancellationToken ct = default);

    /// <summary>Dashboard: open/overdue follow-ups across all orders, filterable.</summary>
    Task<PagedResult<FollowUpDto>> GetDashboardAsync(FollowUpQuery query, CancellationToken ct = default);
}
