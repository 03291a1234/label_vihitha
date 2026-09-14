using LabelVihitha.Domain.Entities;
using LabelVihitha.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace LabelVihitha.Infrastructure.Persistence;

public static class DbSeeder
{
    /// <summary>Applies migrations and seeds roles, a default Owner, categories and products.</summary>
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;

        var db = sp.GetRequiredService<ApplicationDbContext>();
        var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("DbSeeder");

        await db.Database.MigrateAsync();

        await SeedRolesAsync(sp);
        await SeedOwnerAsync(sp);
        await SeedCatalogAsync(db, logger);
    }

    private static async Task SeedRolesAsync(IServiceProvider sp)
    {
        var roleManager = sp.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in Roles.All)
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
    }

    private static async Task SeedOwnerAsync(IServiceProvider sp)
    {
        var config = sp.GetRequiredService<IConfiguration>();
        var users = sp.GetRequiredService<UserManager<ApplicationUser>>();

        var userName = config["Seed:OwnerUserName"] ?? "owner";
        var email = config["Seed:OwnerEmail"] ?? "owner@labelvihitha.local";
        var password = config["Seed:OwnerPassword"] ?? "Owner#12345";

        if (await users.FindByNameAsync(userName) is not null)
            return;

        var owner = new ApplicationUser
        {
            UserName = userName,
            Email = email,
            EmailConfirmed = true,
            DisplayName = "Boutique Owner"
        };

        var result = await users.CreateAsync(owner, password);
        if (result.Succeeded)
            await users.AddToRoleAsync(owner, Roles.Owner);
    }

    private static async Task SeedCatalogAsync(ApplicationDbContext db, ILogger logger)
    {
        if (await db.Categories.AnyAsync())
            return;

        var categories = new List<Category>
        {
            new() { Name = "Sarees", Description = "Traditional sarees", DefaultOriginalPrice = 40m, DefaultSalePrice = 90m },
            new() { Name = "Kurtis", Description = "Kurtis and tunics", DefaultOriginalPrice = 15m, DefaultSalePrice = 35m },
            new() { Name = "Lehengas", Description = "Lehenga sets", DefaultOriginalPrice = 80m, DefaultSalePrice = 200m },
            new() { Name = "Accessories", Description = "Jewelry and accessories", DefaultOriginalPrice = 5m, DefaultSalePrice = 15m },
            new() { Name = "Blouses", Description = "Blouses and blouse pieces", DefaultOriginalPrice = 8m, DefaultSalePrice = 20m }
        };
        db.Categories.AddRange(categories);
        await db.SaveChangesAsync();

        Category Cat(string name) => categories.First(c => c.Name == name);

        var products = new List<Product>
        {
            new() { Category = Cat("Sarees"), SKU = "SAR-001", Name = "Kanchipuram Silk Saree", Color = "Maroon", OriginalPrice = 60m, SalePrice = 140m, QuantityOnHand = 8, ReorderThreshold = 2 },
            new() { Category = Cat("Sarees"), SKU = "SAR-002", Name = "Georgette Party Saree", Color = "Teal", OriginalPrice = 35m, SalePrice = 85m, QuantityOnHand = 12, ReorderThreshold = 3 },
            new() { Category = Cat("Kurtis"), SKU = "KUR-001", Name = "Cotton Straight Kurti", Color = "Yellow", Size = "M", OriginalPrice = 12m, SalePrice = 30m, QuantityOnHand = 20, ReorderThreshold = 5 },
            new() { Category = Cat("Kurtis"), SKU = "KUR-002", Name = "Anarkali Kurti", Color = "Navy", Size = "L", OriginalPrice = 18m, SalePrice = 42m, QuantityOnHand = 3, ReorderThreshold = 5 },
            new() { Category = Cat("Lehengas"), SKU = "LEH-001", Name = "Bridal Lehenga Set", Color = "Red", OriginalPrice = 120m, SalePrice = 320m, QuantityOnHand = 2, ReorderThreshold = 1 },
            new() { Category = Cat("Lehengas"), SKU = "LEH-002", Name = "Festive Lehenga", Color = "Pink", OriginalPrice = 70m, SalePrice = 180m, QuantityOnHand = 5, ReorderThreshold = 2 },
            new() { Category = Cat("Accessories"), SKU = "ACC-001", Name = "Kundan Earrings", OriginalPrice = 6m, SalePrice = 18m, QuantityOnHand = 30, ReorderThreshold = 8 },
            new() { Category = Cat("Accessories"), SKU = "ACC-002", Name = "Potli Bag", Color = "Gold", OriginalPrice = 4m, SalePrice = 14m, QuantityOnHand = 25, ReorderThreshold = 6 },
            new() { Category = Cat("Blouses"), SKU = "BLO-001", Name = "Readymade Silk Blouse", Color = "Gold", Size = "M", OriginalPrice = 9m, SalePrice = 24m, QuantityOnHand = 15, ReorderThreshold = 4 },
            new() { Category = Cat("Blouses"), SKU = "BLO-002", Name = "Embroidered Blouse Piece", Color = "Green", OriginalPrice = 7m, SalePrice = 19m, QuantityOnHand = 18, ReorderThreshold = 4 }
        };
        db.Products.AddRange(products);
        await db.SaveChangesAsync();

        logger.LogInformation("Seeded {Categories} categories and {Products} products.",
            categories.Count, products.Count);
    }
}
