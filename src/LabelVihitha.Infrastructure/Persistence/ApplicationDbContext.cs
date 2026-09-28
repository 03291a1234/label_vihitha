using System.Reflection;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Common;
using LabelVihitha.Domain.Entities;
using LabelVihitha.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace LabelVihitha.Infrastructure.Persistence;

public class ApplicationDbContext
    : IdentityDbContext<ApplicationUser>, IApplicationDbContext
{
    /// <summary>The system is single-tenant by decision (see docs/adr/0001-single-tenant.md).
    /// TenantId is a deliberate forward-compatibility seam stamped to this fixed value, not an
    /// enforced isolation boundary — there is intentionally no tenant query filter.</summary>
    public static readonly Guid DefaultTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    private readonly ICurrentUser? _currentUser;

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options, ICurrentUser? currentUser = null)
        : base(options)
    {
        _currentUser = currentUser;
    }

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<SubCategory> SubCategories => Set<SubCategory>();
    public DbSet<Inventory> Inventories => Set<Inventory>();
    public DbSet<InventoryBill> InventoryBills => Set<InventoryBill>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductCostComponent> ProductCostComponents => Set<ProductCostComponent>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderCharge> OrderCharges => Set<OrderCharge>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<OrderFollowUp> OrderFollowUps => Set<OrderFollowUp>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<Owner> Owners => Set<Owner>();
    public DbSet<OwnerTransaction> OwnerTransactions => Set<OwnerTransaction>();
    public DbSet<CashAccount> CashAccounts => Set<CashAccount>();
    public DbSet<CashMovement> CashMovements => Set<CashMovement>();
    public DbSet<InventoryShipping> InventoryShippings => Set<InventoryShipping>();
    public DbSet<PromoCode> PromoCodes => Set<PromoCode>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());

        // Convention: all decimal columns are money → decimal(18,2).
        foreach (var property in builder.Model.GetEntityTypes()
                     .SelectMany(t => t.GetProperties())
                     .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
        {
            property.SetPrecision(18);
            property.SetScale(2);
        }

        // Convention: DateTime columns are UTC instants — mark them Kind=Utc on read so they
        // serialize with a trailing 'Z' and the client renders them in the viewer's local zone.
        // Date-only columns (a user-picked calendar date, timezone-independent) are excluded so
        // they don't shift a day on display.
        var dateOnlyColumns = new HashSet<string>
        {
            $"{nameof(Expense)}.{nameof(Expense.Date)}",
            $"{nameof(CashMovement)}.{nameof(CashMovement.Date)}",
            $"{nameof(OwnerTransaction)}.{nameof(OwnerTransaction.Date)}",
            $"{nameof(InventoryBill)}.{nameof(InventoryBill.BillDate)}",
        };
        var utc = new ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : DateTime.SpecifyKind(v, DateTimeKind.Utc),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
        var utcNullable = new ValueConverter<DateTime?, DateTime?>(
            v => v.HasValue ? (v.Value.Kind == DateTimeKind.Local ? v.Value.ToUniversalTime() : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)) : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (dateOnlyColumns.Contains($"{entityType.ClrType.Name}.{property.Name}")) continue;
                if (property.ClrType == typeof(DateTime)) property.SetValueConverter(utc);
                else if (property.ClrType == typeof(DateTime?)) property.SetValueConverter(utcNullable);
            }
        }
    }

    public override int SaveChanges()
        => SaveChangesAsync(CancellationToken.None).GetAwaiter().GetResult();

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    if (entry.Entity.TenantId == Guid.Empty)
                        entry.Entity.TenantId = DefaultTenantId;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    break;
            }
        }

        // Capture audit rows BEFORE saving (to read original values); resolve DB-generated Ids after.
        var pending = CaptureAudits(now);
        var result = await base.SaveChangesAsync(cancellationToken);

        if (pending.Count > 0)
        {
            foreach (var (log, entry) in pending)
                log.EntityId = entry.Entity.Id.ToString();
            AuditLogs.AddRange(pending.Select(p => p.Log));
            // AuditLog is not a BaseEntity, so this second save does not re-audit itself.
            await base.SaveChangesAsync(cancellationToken);
        }
        return result;
    }

    /// <summary>Property names never worth recording in the change trail.</summary>
    private static readonly HashSet<string> AuditIgnore = new()
    {
        nameof(BaseEntity.Id), nameof(BaseEntity.CreatedAt), nameof(BaseEntity.UpdatedAt),
        nameof(BaseEntity.TenantId), "RowVersion"
    };

    private List<(AuditLog Log, Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<BaseEntity> Entry)> CaptureAudits(DateTime now)
    {
        var user = _currentUser?.UserName ?? _currentUser?.UserId;
        var captured = new List<(AuditLog, Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<BaseEntity>)>();

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
                continue;

            var action = entry.State switch
            {
                EntityState.Added => "Create",
                EntityState.Deleted => "Delete",
                _ => entry.Entity.IsDeleted ? "Delete" : "Update"
            };

            var oldValues = new Dictionary<string, object?>();
            var newValues = new Dictionary<string, object?>();
            foreach (var p in entry.Properties)
            {
                var name = p.Metadata.Name;
                if (AuditIgnore.Contains(name)) continue;
                switch (entry.State)
                {
                    case EntityState.Added:
                        newValues[name] = p.CurrentValue;
                        break;
                    case EntityState.Deleted:
                        oldValues[name] = p.OriginalValue;
                        break;
                    default: // Modified — record only what actually changed
                        if (p.IsModified && !Equals(p.OriginalValue, p.CurrentValue))
                        {
                            oldValues[name] = p.OriginalValue;
                            newValues[name] = p.CurrentValue;
                        }
                        break;
                }
            }

            // A "modified" entry whose only change was the audit stamps has nothing meaningful to log.
            if (action == "Update" && newValues.Count == 0) continue;

            captured.Add((new AuditLog
            {
                EntityName = entry.Entity.GetType().Name,
                EntityId = entry.Entity.Id.ToString(),
                Action = action,
                ChangedBy = user,
                ChangedAt = now,
                OldValues = oldValues.Count > 0 ? System.Text.Json.JsonSerializer.Serialize(oldValues) : null,
                NewValues = newValues.Count > 0 ? System.Text.Json.JsonSerializer.Serialize(newValues) : null
            }, entry));
        }
        return captured;
    }
}
