namespace LabelVihitha.Application.Common;

/// <summary>App-wide currency configuration. Amounts are stored in USD; INR is a display/entry
/// convenience converted at this rate. Bound from the "Currency" config section.</summary>
public class CurrencySettings
{
    public const string SectionName = "Currency";

    /// <summary>Indian rupees per US dollar used for display/entry conversion (default 95).</summary>
    public decimal InrPerUsd { get; set; } = 95m;
}
