using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// A place cash physically sits — e.g. the common India account (managed by a partner) or an
/// individual owner's holdings. Balances are derived from <see cref="CashMovement"/> rows.
/// This tracks WHERE the business's cash is, separate from the pooled P&amp;L cash figure.
/// </summary>
public class CashAccount : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    /// <summary>True for a shared/common account; false for an individual owner's holdings.</summary>
    public bool IsCommon { get; set; }

    /// <summary>Optional link to the owner who holds/manages this account.</summary>
    public int? OwnerId { get; set; }
    public Owner? Owner { get; set; }

    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    public ICollection<CashMovement> MovementsFrom { get; set; } = new List<CashMovement>();
    public ICollection<CashMovement> MovementsTo { get; set; } = new List<CashMovement>();
}
