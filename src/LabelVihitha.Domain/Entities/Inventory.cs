using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// A named inventory / collection (e.g. "Inventory 1", "Diwali 2026") that groups
/// a set of products — typically a batch or shipment of sarees/dresses. Orthogonal
/// to Category/SubCategory: a product can belong to one inventory and one category.
/// </summary>
public class Inventory : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>When false, this batch's products are hidden from the customer-facing storefront
    /// (they stay fully usable in the back office). Independent of <see cref="IsActive"/>, which
    /// controls whether the inventory shows in the admin list.</summary>
    public bool IsVisibleOnStore { get; set; } = true;

    /// <summary>Which owner/partner funded this inventory/batch (whose capital it represents). Optional.</summary>
    public int? PaidByOwnerId { get; set; }
    public Owner? PaidByOwner { get; set; }

    public ICollection<Product> Products { get; set; } = new List<Product>();

    /// <summary>Supplier bills / invoices attached to this inventory batch.</summary>
    public ICollection<InventoryBill> Bills { get; set; } = new List<InventoryBill>();
}
