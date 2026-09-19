using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// A supplier bill / invoice document attached to an <see cref="Inventory"/> batch —
/// the paper trail for what was actually paid to acquire that inventory. The optional
/// <see cref="Amount"/> (USD) lets the finance view reconcile recorded spend against
/// product cost. The file itself lives under /uploads/bills (image or PDF).
/// </summary>
public class InventoryBill : BaseEntity
{
    public int InventoryId { get; set; }
    public Inventory Inventory { get; set; } = null!;

    /// <summary>Root-relative URL of the uploaded file, e.g. /uploads/bills/ab12.pdf.</summary>
    public string FileUrl { get; set; } = string.Empty;

    /// <summary>Original display name shown in the UI.</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>Bill amount in USD (optional — some bills are informational only).</summary>
    public decimal? Amount { get; set; }

    /// <summary>Date on the bill (optional).</summary>
    public DateTime? BillDate { get; set; }

    public string? Note { get; set; }
}
