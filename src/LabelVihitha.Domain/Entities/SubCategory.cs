using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// A finer grouping under a <see cref="Category"/> (e.g. Sarees → Banarasi, Bandhani, Organza).
/// A product may optionally belong to one subcategory of its category.
/// </summary>
public class SubCategory : BaseEntity
{
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>Optional cover image for the sub-collection (shown on the storefront).</summary>
    public string? ImageUrl { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>Comma-separated size options offered to products in this subcategory (e.g. "2.4,2.6,2.8").</summary>
    public string? Sizes { get; set; }

    public ICollection<Product> Products { get; set; } = new List<Product>();
}
