using LabelVihitha.Domain.Common;
using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Domain.Entities;

public class Order : BaseEntity
{
    /// <summary>Human-readable, e.g. LV-2026-0001.</summary>
    public string OrderNumber { get; set; } = string.Empty;

    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public DateTime OrderDate { get; set; } = DateTime.UtcNow;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public decimal SubTotal { get; set; }

    /// <summary>Explicit discount amount (promo/negotiation reporting), not just inferred.</summary>
    public decimal DiscountTotal { get; set; }

    public decimal GrandTotal { get; set; }

    /// <summary>General free text — alteration requests, special instructions.</summary>
    public string? Notes { get; set; }

    /// <summary>Staff user id (from Identity) who created the order.</summary>
    public string? CreatedBy { get; set; }

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<OrderFollowUp> FollowUps { get; set; } = new List<OrderFollowUp>();
    public Invoice? Invoice { get; set; }
}
