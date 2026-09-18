namespace LabelVihitha.Domain.Enums;

public enum OrderStatus
{
    Pending = 0,
    Confirmed = 1,
    Fulfilled = 2,
    Cancelled = 3
}

public enum PaymentMethod
{
    Zelle = 0,
    Cash = 1
    // Future: Card, Other
}

public enum PaymentStatus
{
    Unpaid = 0,
    PartiallyPaid = 1,
    Paid = 2,
    /// <summary>Placeholder for manual cash/Zelle correction — not a full returns workflow.</summary>
    Refunded = 3
}

public enum FollowUpStatus
{
    Open = 0,
    InProgress = 1,
    Resolved = 2
}

/// <summary>Owner equity movement: capital put into the business, or drawn out of it.</summary>
public enum OwnerTransactionType
{
    Contribution = 0,
    Withdrawal = 1
}

/// <summary>How a promo code reduces the order total.</summary>
public enum PromoDiscountType
{
    Percentage = 0,   // Value is a percent (0–100) off the subtotal
    FixedAmount = 1   // Value is a flat amount (USD) off the subtotal
}
