using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// A sold line. Prices are SNAPSHOTTED at time of sale (not references to the live
/// Product) so margin-by-date analytics remain correct after product prices change.
/// </summary>
public class OrderItem : BaseEntity
{
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public int Quantity { get; set; }

    /// <summary>Snapshot — cost basis at time of sale (for margin calc).</summary>
    public decimal OriginalPriceAtSale { get; set; }

    /// <summary>Snapshot — listed price at time of sale.</summary>
    public decimal SalePriceAtSale { get; set; }

    /// <summary>Actual price paid per unit — supports negotiation/discount.</summary>
    public decimal FinalPriceAtSale { get; set; }

    /// <summary>SalePriceAtSale − FinalPriceAtSale, stored explicitly for reporting.</summary>
    public decimal DiscountAmount { get; set; }

    /// <summary>FinalPriceAtSale * Quantity.</summary>
    public decimal LineTotal { get; set; }

    public ICollection<OrderFollowUp> FollowUps { get; set; } = new List<OrderFollowUp>();
}
