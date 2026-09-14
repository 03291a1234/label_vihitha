using LabelVihitha.Domain.Common;
using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Domain.Entities;

/// <summary>Supports partial/split payments against an invoice.</summary>
public class Payment : BaseEntity
{
    public int InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;

    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
    public string? ReferenceNumber { get; set; }
    public string? RecordedBy { get; set; }
}
