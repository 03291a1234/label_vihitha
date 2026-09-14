namespace LabelVihitha.Domain.Common;

/// <summary>
/// Base for all persisted entities. Carries audit timestamps, a soft-delete flag,
/// and a TenantId placeholder so the schema is SaaS-ready without a later retrofit
/// (single boutique for now — TenantId defaults to the seeded default tenant).
/// </summary>
public abstract class BaseEntity
{
    public int Id { get; set; }

    /// <summary>Placeholder for future multi-tenancy. Single boutique today.</summary>
    public Guid TenantId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    /// <summary>Soft delete flag — historical orders must keep referencing old rows.</summary>
    public bool IsDeleted { get; set; }
}
