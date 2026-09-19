using LabelVihitha.Domain.Common;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// An additional service / charge on an order that is not a stock product —
/// e.g. stitching, alteration, blouse fall &amp; pico, shipping, gift wrap.
/// Added to the order's grand total (and therefore the invoice).
/// </summary>
public class OrderCharge : BaseEntity
{
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    /// <summary>What the charge is for, e.g. "Stitching" or "Shipping".</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>Amount in USD (the store's base currency).</summary>
    public decimal Amount { get; set; }
}
