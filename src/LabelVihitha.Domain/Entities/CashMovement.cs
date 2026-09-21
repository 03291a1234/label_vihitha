using LabelVihitha.Domain.Common;
using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// One movement of cash between locations. A Transfer sets both From and To; CashIn/Opening set
/// only To (money arriving); CashOut sets only From (money leaving). Amounts are positive USD.
/// An account's balance = sum of amounts arriving (To) minus sum of amounts leaving (From).
/// </summary>
public class CashMovement : BaseEntity
{
    public DateTime Date { get; set; }
    public CashMovementKind Kind { get; set; }
    public decimal Amount { get; set; }

    public int? FromAccountId { get; set; }
    public CashAccount? FromAccount { get; set; }

    public int? ToAccountId { get; set; }
    public CashAccount? ToAccount { get; set; }

    public string? Note { get; set; }
}
