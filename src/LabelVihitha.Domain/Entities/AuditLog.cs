namespace LabelVihitha.Domain.Entities;

/// <summary>Change trail for a financial system. Not a BaseEntity (never soft-deleted/tenant-scoped edited).</summary>
public class AuditLog
{
    public int Id { get; set; }
    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; // Create/Update/Delete
    public string? ChangedBy { get; set; }
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string? OldValues { get; set; } // JSON
    public string? NewValues { get; set; } // JSON
}
