using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// Product category (Sarees, Kurtis, ...). Groups products and subcategories.
/// </summary>
public class Category : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>Optional cover image for the collection (shown on the storefront landing).</summary>
    public string? ImageUrl { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<Product> Products { get; set; } = new List<Product>();
    public ICollection<SubCategory> SubCategories { get; set; } = new List<SubCategory>();
}
