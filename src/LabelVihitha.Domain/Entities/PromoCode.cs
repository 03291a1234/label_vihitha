using LabelVihitha.Domain.Common;
using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Domain.Entities;

/// <summary>
/// A discount code that can be applied at checkout — e.g. a festival/special-day offer.
/// Percentage or fixed amount off the order subtotal, optionally windowed by date, with an
/// optional minimum order and a usage cap.
/// </summary>
public class PromoCode : BaseEntity
{
    /// <summary>The code customers type at checkout (stored upper-cased, unique).</summary>
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }

    public PromoDiscountType DiscountType { get; set; }
    /// <summary>Percent (0–100) for Percentage, or a flat USD amount for FixedAmount.</summary>
    public decimal Value { get; set; }

    /// <summary>Optional minimum order subtotal (USD) for the code to apply.</summary>
    public decimal? MinOrderAmount { get; set; }

    /// <summary>Optional validity window (UTC). Null = no bound on that side.</summary>
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidTo { get; set; }

    /// <summary>Optional cap on how many times the code can be used in total.</summary>
    public int? MaxUses { get; set; }
    public int TimesUsed { get; set; }

    public bool IsActive { get; set; } = true;
}
