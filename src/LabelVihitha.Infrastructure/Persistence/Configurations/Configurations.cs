using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LabelVihitha.Infrastructure.Persistence.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.Property(x => x.Name).IsRequired().HasMaxLength(100);
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasIndex(x => x.Name);
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> b)
    {
        b.Property(x => x.SKU).IsRequired().HasMaxLength(50);
        b.Property(x => x.Name).IsRequired().HasMaxLength(200);
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.Size).HasMaxLength(50);
        b.Property(x => x.Color).HasMaxLength(50);
        b.Property(x => x.Material).HasMaxLength(100);
        b.Property(x => x.ImageUrl).HasMaxLength(500);

        // Concurrency token to prevent overselling.
        b.Property(x => x.RowVersion).IsRowVersion();

        // Unique SKU among non-deleted products (filtered index).
        b.HasIndex(x => x.SKU).IsUnique().HasFilter("[IsDeleted] = 0");

        b.HasOne(x => x.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.SubCategory)
            .WithMany(s => s.Products)
            .HasForeignKey(x => x.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.Inventory)
            .WithMany(i => i.Products)
            .HasForeignKey(x => x.InventoryId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.Vendor)
            .WithMany(v => v.Products)
            .HasForeignKey(x => x.VendorId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.PaidByOwner)
            .WithMany()
            .HasForeignKey(x => x.PaidByOwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> b)
    {
        b.Property(x => x.Size).IsRequired().HasMaxLength(50);
        b.Property(x => x.CostPrice).HasPrecision(18, 2);
        b.Property(x => x.SalePrice).HasPrecision(18, 2);
        b.HasIndex(x => new { x.ProductId, x.Size }).IsUnique().HasFilter("[IsDeleted] = 0");

        b.HasOne(x => x.Product)
            .WithMany(p => p.Variants)
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class ProductCostComponentConfiguration : IEntityTypeConfiguration<ProductCostComponent>
{
    public void Configure(EntityTypeBuilder<ProductCostComponent> b)
    {
        b.Property(x => x.Label).IsRequired().HasMaxLength(80);
        b.Property(x => x.Amount).HasPrecision(18, 2);

        b.HasOne(x => x.Product)
            .WithMany(p => p.CostComponents)
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Vendor)
            .WithMany()
            .HasForeignKey(x => x.VendorId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class VendorConfiguration : IEntityTypeConfiguration<Vendor>
{
    public void Configure(EntityTypeBuilder<Vendor> b)
    {
        b.Property(x => x.Name).IsRequired().HasMaxLength(100);
        b.Property(x => x.ContactPerson).HasMaxLength(100);
        b.Property(x => x.Phone).HasMaxLength(30);
        b.Property(x => x.Email).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => x.Name).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class InventoryConfiguration : IEntityTypeConfiguration<Inventory>
{
    public void Configure(EntityTypeBuilder<Inventory> b)
    {
        b.Property(x => x.Name).IsRequired().HasMaxLength(100);
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasIndex(x => x.Name).IsUnique().HasFilter("[IsDeleted] = 0");

        b.HasOne(x => x.PaidByOwner)
            .WithMany()
            .HasForeignKey(x => x.PaidByOwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class InventoryBillConfiguration : IEntityTypeConfiguration<InventoryBill>
{
    public void Configure(EntityTypeBuilder<InventoryBill> b)
    {
        b.Property(x => x.FileUrl).IsRequired().HasMaxLength(500);
        b.Property(x => x.FileName).HasMaxLength(200);
        b.Property(x => x.Note).HasMaxLength(500);
        b.Property(x => x.Amount).HasPrecision(18, 2);

        b.HasOne(x => x.Inventory)
            .WithMany(i => i.Bills)
            .HasForeignKey(x => x.InventoryId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Vendor)
            .WithMany()
            .HasForeignKey(x => x.VendorId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class SubCategoryConfiguration : IEntityTypeConfiguration<SubCategory>
{
    public void Configure(EntityTypeBuilder<SubCategory> b)
    {
        b.Property(x => x.Name).IsRequired().HasMaxLength(100);
        b.Property(x => x.Description).HasMaxLength(500);
        b.Property(x => x.Sizes).HasMaxLength(500);

        // Unique subcategory name within a category (among non-deleted rows).
        b.HasIndex(x => new { x.CategoryId, x.Name }).IsUnique().HasFilter("[IsDeleted] = 0");

        b.HasOne(x => x.Category)
            .WithMany(c => c.SubCategories)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> b)
    {
        b.Property(x => x.Name).IsRequired().HasMaxLength(200);
        b.Property(x => x.Phone).HasMaxLength(30);
        b.Property(x => x.Email).HasMaxLength(200);
        b.Property(x => x.Address).HasMaxLength(500);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.Property(x => x.OrderNumber).IsRequired().HasMaxLength(30);
        b.HasIndex(x => x.OrderNumber).IsUnique();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.Property(x => x.CreatedBy).HasMaxLength(100);
        b.Property(x => x.PromoCode).HasMaxLength(40);

        b.HasOne(x => x.Customer)
            .WithMany(c => c.Orders)
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> b)
    {
        b.HasOne(x => x.Order)
            .WithMany(o => o.Items)
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Product)
            .WithMany(p => p.OrderItems)
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Property(x => x.Size).HasMaxLength(50);
        b.HasOne(x => x.ProductVariant)
            .WithMany()
            .HasForeignKey(x => x.ProductVariantId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class OrderChargeConfiguration : IEntityTypeConfiguration<OrderCharge>
{
    public void Configure(EntityTypeBuilder<OrderCharge> b)
    {
        b.Property(x => x.Label).IsRequired().HasMaxLength(80);
        b.Property(x => x.Amount).HasPrecision(18, 2);

        b.HasOne(x => x.Order)
            .WithMany(o => o.Charges)
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> b)
    {
        b.Property(x => x.InvoiceNumber).IsRequired().HasMaxLength(30);
        b.HasIndex(x => x.InvoiceNumber).IsUnique();
        b.Property(x => x.PaymentMethod).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.PaymentStatus).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.PaymentReference).HasMaxLength(100);
        b.Property(x => x.Notes).HasMaxLength(2000);

        b.HasOne(x => x.Order)
            .WithOne(o => o.Invoice)
            .HasForeignKey<Invoice>(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.Property(x => x.Method).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.ReferenceNumber).HasMaxLength(100);
        b.Property(x => x.RecordedBy).HasMaxLength(100);

        b.HasOne(x => x.Invoice)
            .WithMany(i => i.Payments)
            .HasForeignKey(x => x.InvoiceId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class OrderFollowUpConfiguration : IEntityTypeConfiguration<OrderFollowUp>
{
    public void Configure(EntityTypeBuilder<OrderFollowUp> b)
    {
        b.Property(x => x.Note).IsRequired().HasMaxLength(1000);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.CreatedBy).HasMaxLength(100);
        b.Property(x => x.ResolutionNote).HasMaxLength(1000);

        b.HasOne(x => x.Order)
            .WithMany(o => o.FollowUps)
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // Restrict here avoids a second cascade path to OrderFollowUp (via OrderItem).
        b.HasOne(x => x.OrderItem)
            .WithMany(i => i.FollowUps)
            .HasForeignKey(x => x.OrderItemId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.Property(x => x.EntityName).IsRequired().HasMaxLength(100);
        b.Property(x => x.EntityId).HasMaxLength(50);
        b.Property(x => x.Action).HasMaxLength(20);
        b.Property(x => x.ChangedBy).HasMaxLength(100);
    }
}

public class ExpenseCategoryConfiguration : IEntityTypeConfiguration<ExpenseCategory>
{
    public void Configure(EntityTypeBuilder<ExpenseCategory> b)
    {
        b.Property(x => x.Name).IsRequired().HasMaxLength(100);
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasIndex(x => x.Name).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> b)
    {
        b.Property(x => x.Description).HasMaxLength(300);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.ReceiptUrl).HasMaxLength(500);
        b.HasIndex(x => x.Date);

        b.HasOne(x => x.ExpenseCategory)
            .WithMany(c => c.Expenses)
            .HasForeignKey(x => x.ExpenseCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.PaidByOwner)
            .WithMany()
            .HasForeignKey(x => x.PaidByOwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.Inventory)
            .WithMany()
            .HasForeignKey(x => x.InventoryId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class PromoCodeConfiguration : IEntityTypeConfiguration<PromoCode>
{
    public void Configure(EntityTypeBuilder<PromoCode> b)
    {
        b.Property(x => x.Code).IsRequired().HasMaxLength(40);
        b.Property(x => x.Description).HasMaxLength(200);
        b.Property(x => x.Value).HasPrecision(18, 2);
        b.Property(x => x.MinOrderAmount).HasPrecision(18, 2);
        // Unique code among non-deleted promo codes (filtered index).
        b.HasIndex(x => x.Code).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class OwnerConfiguration : IEntityTypeConfiguration<Owner>
{
    public void Configure(EntityTypeBuilder<Owner> b)
    {
        b.Property(x => x.Name).IsRequired().HasMaxLength(100);
        b.Property(x => x.Email).HasMaxLength(200);
        b.Property(x => x.Phone).HasMaxLength(30);
        b.Property(x => x.Notes).HasMaxLength(1000);
        // Percentages carry two decimals like money (decimal(18,2) via the global convention).
        b.HasIndex(x => x.Name).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class OwnerTransactionConfiguration : IEntityTypeConfiguration<OwnerTransaction>
{
    public void Configure(EntityTypeBuilder<OwnerTransaction> b)
    {
        b.Property(x => x.Notes).HasMaxLength(500);
        b.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
        b.HasIndex(x => x.Date);

        b.HasOne(x => x.Owner)
            .WithMany(o => o.Transactions)
            .HasForeignKey(x => x.OwnerId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class CashAccountConfiguration : IEntityTypeConfiguration<CashAccount>
{
    public void Configure(EntityTypeBuilder<CashAccount> b)
    {
        b.Property(x => x.Name).IsRequired().HasMaxLength(120);
        b.HasOne(x => x.Owner)
            .WithMany()
            .HasForeignKey(x => x.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public class CashMovementConfiguration : IEntityTypeConfiguration<CashMovement>
{
    public void Configure(EntityTypeBuilder<CashMovement> b)
    {
        b.Property(x => x.Note).HasMaxLength(500);
        b.Property(x => x.Kind).HasConversion<string>().HasMaxLength(20);
        b.HasIndex(x => x.Date);

        b.HasOne(x => x.FromAccount)
            .WithMany(a => a.MovementsFrom)
            .HasForeignKey(x => x.FromAccountId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ToAccount)
            .WithMany(a => a.MovementsTo)
            .HasForeignKey(x => x.ToAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasQueryFilter(x => !x.IsDeleted);
    }
}
