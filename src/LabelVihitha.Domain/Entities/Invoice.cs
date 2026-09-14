using LabelVihitha.Domain.Common;
using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Domain.Entities;

public class Invoice : BaseEntity
{
    public string InvoiceNumber { get; set; } = string.Empty;

    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public DateTime InvoiceDate { get; set; } = DateTime.UtcNow;
    public PaymentMethod PaymentMethod { get; set; }

    /// <summary>Zelle confirmation #, nullable for cash.</summary>
    public string? PaymentReference { get; set; }

    public decimal AmountDue { get; set; }
    public decimal AmountPaid { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Unpaid;
    public DateTime? PaidDate { get; set; }
    public string? Notes { get; set; }

    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
