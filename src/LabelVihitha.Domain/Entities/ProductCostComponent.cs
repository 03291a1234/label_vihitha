using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// One per-unit cost line of a product's landed cost — e.g. "Cloth" bought from one vendor
/// and "Stitching" done by another. A product's unit cost (<see cref="Product.OriginalPrice"/>)
/// is the sum of its components when any exist; products without components keep a directly
/// entered cost. Amounts are per unit, in USD (the canonical currency).
/// </summary>
public class ProductCostComponent : BaseEntity
{
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    /// <summary>What this cost is for, e.g. "Cloth", "Stitching", "Embroidery".</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>The vendor paid for this component (optional).</summary>
    public int? VendorId { get; set; }
    public Vendor? Vendor { get; set; }

    /// <summary>Per-unit cost of this component, in USD.</summary>
    public decimal Amount { get; set; }
}
