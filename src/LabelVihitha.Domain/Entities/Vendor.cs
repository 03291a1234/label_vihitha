using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// A supplier / store the boutique buys stock from (e.g. "Shanthi NX",
/// "Samra Fashions"). Products optionally record which vendor they came from,
/// so purchasing and cost can be tracked per source.
/// </summary>
public class Vendor : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }

    /// <summary>Free-form notes — location, pricing rules, courier terms, etc.</summary>
    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<Product> Products { get; set; } = new List<Product>();
}
