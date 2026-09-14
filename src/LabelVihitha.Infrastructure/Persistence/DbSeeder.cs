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

    // Shape of the embedded seed-catalog.json (generated from the boutique's Excel inventory).
    private sealed record SeedCatalog(List<SeedCategory> Categories, List<SeedProduct> Products);
    private sealed record SeedCategory(string Name, string? Description, decimal? DefaultOriginalPrice, decimal? DefaultSalePrice);
    private sealed record SeedProduct(string Category, string Sku, string Name, string? Description,
        decimal OriginalPrice, decimal SalePrice, int QuantityOnHand, int ReorderThreshold);

    private static async Task SeedCatalogAsync(ApplicationDbContext db, ILogger logger)
    {
        if (await db.Categories.AnyAsync())
            return;

        var catalog = LoadCatalog();
        if (catalog is null)
        {
            logger.LogWarning("Seed catalog not found; skipping catalog seed.");
            return;
        }

        var categories = catalog.Categories.Select(c => new Category
        {
            Name = c.Name,
            Description = c.Description,
            DefaultOriginalPrice = c.DefaultOriginalPrice,
            DefaultSalePrice = c.DefaultSalePrice
        }).ToList();
        db.Categories.AddRange(categories);
        await db.SaveChangesAsync();

        Category Cat(string name) => categories.First(c => c.Name == name);

        var products = catalog.Products.Select(p => new Product
        {
            Category = Cat(p.Category),
            SKU = p.Sku,
            Name = p.Name,
            Description = p.Description,
            OriginalPrice = p.OriginalPrice,
            SalePrice = p.SalePrice,
            QuantityOnHand = p.QuantityOnHand,
            ReorderThreshold = p.ReorderThreshold
        }).ToList();
        db.Products.AddRange(products);
        await db.SaveChangesAsync();

        logger.LogInformation("Seeded {Categories} categories and {Products} products from the boutique inventory.",
            categories.Count, products.Count);
    }

    private static SeedCatalog? LoadCatalog()
    {
        var assembly = typeof(DbSeeder).Assembly;
        var resource = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("seed-catalog.json", StringComparison.OrdinalIgnoreCase));
        if (resource is null) return null;

        using var stream = assembly.GetManifestResourceStream(resource)!;
        return System.Text.Json.JsonSerializer.Deserialize<SeedCatalog>(stream,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }
}
