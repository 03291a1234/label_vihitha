using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// Per-size stock for a product (e.g. M-1, L-1, XXL-1). A product's total
/// <see cref="Entities.Product.QuantityOnHand"/> is kept in sync as the sum of its
/// variants; sales draw down a specific variant.
/// </summary>
public class ProductVariant : BaseEntity
{
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    /// <summary>Size label (e.g. "S", "M", "2*6"). "One Size" for unsized products.</summary>
    public string Size { get; set; } = string.Empty;

    public int QuantityOnHand { get; set; }
}
