using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// A company operating expense (shipping, packaging, fixtures, ...). Amounts are stored
/// in the canonical currency (USD) so they net directly against sales in the P&amp;L; the
/// UI shows an INR equivalent for convenience.
/// </summary>
public class Expense : BaseEntity
{
    public int ExpenseCategoryId { get; set; }
    public ExpenseCategory ExpenseCategory { get; set; } = null!;

    /// <summary>Date the cost was incurred.</summary>
    public DateTime Date { get; set; }

    /// <summary>Amount in USD (canonical currency).</summary>
    public decimal Amount { get; set; }

    public string? Description { get; set; }
    public string? Notes { get; set; }

    /// <summary>Optional owner who paid this expense out of pocket.</summary>
    public int? PaidByOwnerId { get; set; }
    public Owner? PaidByOwner { get; set; }

    /// <summary>Optional inventory this cost belongs to (e.g. stitching for a specific batch).
    /// When set, it's charged directly to that inventory's P&amp;L instead of being spread by sales.</summary>
    public int? InventoryId { get; set; }
    public Inventory? Inventory { get; set; }

    /// <summary>Optional uploaded receipt (image or PDF), stored as a served URL path.</summary>
    public string? ReceiptUrl { get; set; }
}
