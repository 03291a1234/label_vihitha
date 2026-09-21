namespace LabelVihitha.Domain.Enums;

/// <summary>How a cash movement affects accounts. A Transfer moves money between two accounts;
/// CashIn/Opening credit one account; CashOut debits one account.</summary>
public enum CashMovementKind
{
    Transfer,
    CashIn,
    CashOut,
    Opening
}
