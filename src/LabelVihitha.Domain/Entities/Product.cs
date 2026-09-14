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

    public int QuantityOnHand { get; set; }
    public int ReorderThreshold { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Concurrency token — prevents overselling from concurrent orders.</summary>
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
