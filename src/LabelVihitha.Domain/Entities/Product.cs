using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// Inventory item. Prices here are the *live/current* prices; the price actually
/// charged on a sale is snapshotted onto <see cref="OrderItem"/> so historical
/// analytics stay accurate after prices change.
/// </summary>
public class Product : BaseEntity
{
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    /// <summary>Optional finer grouping within the category.</summary>
    public int? SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }

    /// <summary>Optional named inventory / collection this product belongs to.</summary>
    public int? InventoryId { get; set; }
    public Inventory? Inventory { get; set; }

    /// <summary>Optional supplier this product was purchased from.</summary>
    public int? VendorId { get; set; }
    public Vendor? Vendor { get; set; }

    /// <summary>Which owner/partner funded this stock (whose capital it represents). Optional.</summary>
    public int? PaidByOwnerId { get; set; }
    public Owner? PaidByOwner { get; set; }

    public string SKU { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Optional variant attributes (a full ProductVariant table can be added later).
    public string? Size { get; set; }
    public string? Color { get; set; }
    public string? Material { get; set; }

    /// <summary>Cost/purchase price — what the boutique paid/values the item at.</summary>
    public decimal OriginalPrice { get; set; }

    /// <summary>Listed/marked price before negotiation or discount.</summary>
    public decimal SalePrice { get; set; }

    /// <summary>Total stock across all size variants (kept in sync = sum of variants).</summary>
    public int QuantityOnHand { get; set; }
    public int ReorderThreshold { get; set; }

    /// <summary>Per-size stock breakdown. Every product has at least one variant.</summary>
    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Concurrency token — prevents overselling from concurrent orders.</summary>
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
