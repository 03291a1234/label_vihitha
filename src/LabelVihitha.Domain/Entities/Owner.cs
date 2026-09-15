using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// A business owner / partner in the boutique (distinct from an <c>ApplicationUser</c> login
/// or the "Owner" login role). Carries the share of net profit this partner is entitled to
/// and anchors their capital ledger (<see cref="OwnerTransaction"/>).
/// </summary>
public class Owner : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Notes { get; set; }

    /// <summary>Percentage (0–100) of net profit allocated to this owner.</summary>
    public decimal ProfitSharePercent { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<OwnerTransaction> Transactions { get; set; } = new List<OwnerTransaction>();
}
