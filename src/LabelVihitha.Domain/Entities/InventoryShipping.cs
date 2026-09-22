using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// A shipping cost applied to an inventory batch and capitalised into its products' per-unit cost.
/// The exact per-unit amount and the products it touched are recorded so it can be edited or removed
/// later (reversed precisely from those products' cost).
/// </summary>
public class InventoryShipping : BaseEntity
{
    public int InventoryId { get; set; }
    public Inventory Inventory { get; set; } = null!;

    /// <summary>Optional: shipping applied only to products in this category (null = whole batch).</summary>
    public int? CategoryId { get; set; }
    public Category? Category { get; set; }

    /// <summary>Total shipping in USD.</summary>
    public decimal AmountUsd { get; set; }

    /// <summary>Per-unit share added to each affected product's cost.</summary>
    public decimal PerUnitUsd { get; set; }

    /// <summary>Units the amount was split across when applied.</summary>
    public int UnitsCovered { get; set; }

    /// <summary>Markup used to re-price affected products (sale = cost × (1 + markup/100)).</summary>
    public decimal MarkupPercent { get; set; }

    /// <summary>IDs of the products the per-unit share was added to (so removal reverses exactly those).</summary>
    public List<int> ProductIds { get; set; } = new();

    public string? Note { get; set; }
}
