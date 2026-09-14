using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// Product category (Sarees, Kurtis, ...). Carries default pricing rules that
/// new products can inherit or override.
/// </summary>
public class Category : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Default cost basis for new products in this category.</summary>
    public decimal? DefaultOriginalPrice { get; set; }

    /// <summary>Default listed/sale price for new products in this category.</summary>
    public decimal? DefaultSalePrice { get; set; }

    public ICollection<Product> Products { get; set; } = new List<Product>();
}
