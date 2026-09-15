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
}
