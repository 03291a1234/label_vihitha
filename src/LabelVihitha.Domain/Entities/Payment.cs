using LabelVihitha.Domain.Common;
using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Domain.Entities;

/// <summary>Supports partial/split payments against an invoice.</summary>
public class Payment : BaseEntity
{
    public int InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;

    /// <summary>Positive for a payment received; a refund is recorded as a negative amount.</summary>
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
    public string? ReferenceNumber { get; set; }
    public string? RecordedBy { get; set; }

    /// <summary>True when this row is a refund (money returned to the customer).</summary>
    public bool IsRefund { get; set; }

    /// <summary>Free-text reason, used mainly for refunds/returns.</summary>
    public string? Notes { get; set; }
}
