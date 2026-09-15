using LabelVihitha.Domain.Common;
using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// One capital movement on an owner's equity ledger: a contribution (money put in) or a
/// withdrawal / drawing (money taken out). Amounts are in USD.
/// </summary>
public class OwnerTransaction : BaseEntity
{
    public int OwnerId { get; set; }
    public Owner Owner { get; set; } = null!;

    public DateTime Date { get; set; }
    public OwnerTransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public string? Notes { get; set; }
}
