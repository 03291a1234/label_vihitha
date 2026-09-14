using LabelVihitha.Domain.Common;
using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// Actionable, trackable follow-up derived from an order/invoice note (e.g. "alter hem").
/// Distinct from free-text Notes so staff can query "what's still open".
/// </summary>
public class OrderFollowUp : BaseEntity
{
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    /// <summary>Optional item-specific scope.</summary>
    public int? OrderItemId { get; set; }
    public OrderItem? OrderItem { get; set; }

    public string Note { get; set; } = string.Empty;
    public DateTime? FollowUpDate { get; set; }
    public FollowUpStatus Status { get; set; } = FollowUpStatus.Open;

    public string? CreatedBy { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolutionNote { get; set; }
}
