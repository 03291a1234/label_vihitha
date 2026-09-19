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

    /// <summary>
    /// Per-size cost price (USD). Null → inherit the product's OriginalPrice.
    /// Lets accessories like bangles carry a different cost per size (2*8, 2*6, 2*4).
    /// </summary>
    public decimal? CostPrice { get; set; }

    /// <summary>Per-size sale price (USD). Null → inherit the product's SalePrice.</summary>
    public decimal? SalePrice { get; set; }
}
