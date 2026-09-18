using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace LabelVihitha.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class;

    DbSet<Category> Categories { get; }
    DbSet<SubCategory> SubCategories { get; }
    DbSet<Inventory> Inventories { get; }
    DbSet<Vendor> Vendors { get; }
    DbSet<Product> Products { get; }
    DbSet<ProductVariant> ProductVariants { get; }
    DbSet<ProductCostComponent> ProductCostComponents { get; }
    DbSet<Customer> Customers { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<Invoice> Invoices { get; }
    DbSet<Payment> Payments { get; }
    DbSet<OrderFollowUp> OrderFollowUps { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<ExpenseCategory> ExpenseCategories { get; }
    DbSet<Expense> Expenses { get; }
    DbSet<Owner> Owners { get; }
    DbSet<OwnerTransaction> OwnerTransactions { get; }
    DbSet<PromoCode> PromoCodes { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
