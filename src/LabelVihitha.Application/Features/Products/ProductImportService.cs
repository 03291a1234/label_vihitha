using LabelVihitha.Application.Common;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace LabelVihitha.Application.Features.Products;

public class ProductImportService : IProductImportService
{
    private readonly decimal InrPerUsd;
    private readonly IApplicationDbContext _db;
    public ProductImportService(IApplicationDbContext db, IOptions<CurrencySettings> currency)
    {
        _db = db;
        InrPerUsd = currency.Value.InrPerUsd;
    }

    public async Task<ProductImportResult> ImportAsync(IReadOnlyList<ProductImportRow> rows, CancellationToken ct = default)
    {
        var errors = new List<string>();
        var createdVendors = new List<string>();
        var createdInventories = new List<string>();
        var createdCategories = new List<string>();
        var createdSubs = new List<string>();

        static string Key(string s) => s.Trim().ToLowerInvariant();

        // ---- Phase 1: resolve/create categories, vendors, inventories ----
        var categories = (await _db.Categories.Where(c => !c.IsDeleted).ToListAsync(ct))
            .GroupBy(c => Key(c.Name)).ToDictionary(g => g.Key, g => g.First());
        var vendors = (await _db.Vendors.Where(v => !v.IsDeleted).ToListAsync(ct))
            .GroupBy(v => Key(v.Name)).ToDictionary(g => g.Key, g => g.First());
        var inventories = (await _db.Inventories.Where(i => !i.IsDeleted).ToListAsync(ct))
            .GroupBy(i => Key(i.Name)).ToDictionary(g => g.Key, g => g.First());
        // Owners are never auto-created (they carry profit shares); resolve by name only.
        var owners = (await _db.Owners.Where(o => !o.IsDeleted).ToListAsync(ct))
            .GroupBy(o => Key(o.Name)).ToDictionary(g => g.Key, g => g.First());

        foreach (var name in Distinct(rows.Select(r => r.Category)))
            if (!categories.ContainsKey(Key(name)))
            {
                var e = new Category { Name = name, IsActive = true };
                _db.Categories.Add(e); categories[Key(name)] = e; createdCategories.Add(name);
            }
        foreach (var name in Distinct(rows.Select(r => r.Vendor)))
            if (!vendors.ContainsKey(Key(name)))
            {
                var e = new Vendor { Name = name, IsActive = true };
                _db.Vendors.Add(e); vendors[Key(name)] = e; createdVendors.Add(name);
            }
        foreach (var name in Distinct(rows.Select(r => r.Inventory)))
            if (!inventories.ContainsKey(Key(name)))
            {
                var e = new Inventory { Name = name, IsActive = true };
                _db.Inventories.Add(e); inventories[Key(name)] = e; createdInventories.Add(name);
            }
        await _db.SaveChangesAsync(ct); // assign Ids

        // ---- Phase 2: resolve/create subcategories (need category Ids) ----
        var subs = (await _db.SubCategories.Where(s => !s.IsDeleted).ToListAsync(ct))
            .GroupBy(s => $"{s.CategoryId}::{Key(s.Name)}").ToDictionary(g => g.Key, g => g.First());
        foreach (var r in rows)
        {
            if (string.IsNullOrWhiteSpace(r.SubCategory) || string.IsNullOrWhiteSpace(r.Category)) continue;
            if (!categories.TryGetValue(Key(r.Category), out var cat)) continue;
            var sk = $"{cat.Id}::{Key(r.SubCategory)}";
            if (!subs.ContainsKey(sk))
            {
                var e = new SubCategory { Category = cat, Name = r.SubCategory.Trim(), IsActive = true };
                _db.SubCategories.Add(e); subs[sk] = e; createdSubs.Add($"{cat.Name} > {r.SubCategory.Trim()}");
            }
        }
        await _db.SaveChangesAsync(ct);

        // ---- Phase 3: build products, grouped by SKU (each row = a size variant) ----
        var existingSkus = (await _db.Products.Where(p => !p.IsDeleted).Select(p => p.SKU).ToListAsync(ct))
            .Select(Key).ToHashSet();
        var newSkus = new HashSet<string>();
        int productsCreated = 0, variantsCreated = 0, rowsProcessed = 0;

        // Auto-generate a SKU for any row that has a Product Name but no SKU (each becomes its own product).
        // Seed a per-prefix counter from existing SKUs so the series continues cleanly.
        var rx = new System.Text.RegularExpressions.Regex(@"-(\d+)$");
        var seq = new Dictionary<string, int>();
        // Reserve SKUs the user typed so an auto-generated one never collides with them.
        var reservedSkus = rows.Where(r => !string.IsNullOrWhiteSpace(r.Sku)).Select(r => Key(r.Sku!)).ToHashSet();
        string GenSku(string? vendorName)
        {
            var prefix = CodeFrom(vendorName);
            if (!seq.TryGetValue(prefix, out var n))
                n = existingSkus
                    .Where(s => s.StartsWith(prefix.ToLowerInvariant() + "-"))
                    .Select(s => rx.Match(s)).Where(m => m.Success)
                    .Select(m => int.TryParse(m.Groups[1].Value, out var x) ? x : 0)
                    .DefaultIfEmpty(0).Max();
            string sku;
            do { n++; sku = $"{prefix}-{n:D4}"; } while (existingSkus.Contains(Key(sku)) || reservedSkus.Contains(Key(sku)));
            seq[prefix] = n;
            reservedSkus.Add(Key(sku));
            return sku;
        }

        var effectiveRows = rows.Select(r =>
            string.IsNullOrWhiteSpace(r.Sku) && !string.IsNullOrWhiteSpace(r.Name)
                ? r with { Sku = GenSku(r.Vendor) }
                : r).ToList();

        foreach (var r in effectiveRows.Where(r => string.IsNullOrWhiteSpace(r.Sku) && !string.IsNullOrWhiteSpace(r.Category)))
            errors.Add($"Row {r.RowNumber}: has a Category but no Product Name to auto-name it — skipped.");

        var groups = effectiveRows.Where(r => !string.IsNullOrWhiteSpace(r.Sku))
            .GroupBy(r => r.Sku!.Trim(), StringComparer.OrdinalIgnoreCase);

        foreach (var g in groups)
        {
            var sku = g.Key;
            var head = g.First();
            rowsProcessed += g.Count();

            if (string.IsNullOrWhiteSpace(head.Name)) { errors.Add($"SKU '{sku}': missing Product Name — skipped."); continue; }
            if (string.IsNullOrWhiteSpace(head.Category) || !categories.TryGetValue(Key(head.Category), out var category))
            { errors.Add($"SKU '{sku}': missing/unknown Category — skipped."); continue; }
            if (existingSkus.Contains(Key(sku)) || !newSkus.Add(Key(sku)))
            { errors.Add($"SKU '{sku}': already exists — skipped."); continue; }

            SubCategory? sub = null;
            if (!string.IsNullOrWhiteSpace(head.SubCategory))
                subs.TryGetValue($"{category.Id}::{Key(head.SubCategory)}", out sub);

            Vendor? vendor = !string.IsNullOrWhiteSpace(head.Vendor) && vendors.TryGetValue(Key(head.Vendor), out var v) ? v : null;
            Inventory? inv = !string.IsNullOrWhiteSpace(head.Inventory) && inventories.TryGetValue(Key(head.Inventory), out var i) ? i : null;

            Owner? paidBy = null;
            if (!string.IsNullOrWhiteSpace(head.PaidByOwner))
            {
                if (owners.TryGetValue(Key(head.PaidByOwner), out var o)) paidBy = o;
                else errors.Add($"SKU '{sku}': Paid-by owner '{head.PaidByOwner.Trim()}' not found — imported without an owner.");
            }

            // Variants: one per row, merged by size.
            var variants = g
                .Select(x => (Size: string.IsNullOrWhiteSpace(x.Size) ? "One Size" : x.Size!.Trim(),
                              Qty: x.Qty < 0 ? 0 : x.Qty))
                .GroupBy(x => x.Size, StringComparer.OrdinalIgnoreCase)
                .Select(gr => (Size: gr.First().Size, Qty: gr.Sum(x => x.Qty)))
                .ToList();
            var total = variants.Sum(x => x.Qty);
            var sizeSummary = variants.Where(x => !x.Size.Equals("One Size", StringComparison.OrdinalIgnoreCase))
                .Select(x => x.Size).ToList();

            var (costUsd, saleUsd) = ResolvePrice(head);

            var product = new Product
            {
                Category = category,
                SubCategory = sub,
                Vendor = vendor,
                Inventory = inv,
                PaidByOwner = paidBy,
                SKU = sku,
                Name = head.Name!.Trim(),
                Description = Trim(head.Description),
                Color = Trim(head.Color),
                Material = Trim(head.Material),
                OriginalPrice = costUsd,
                SalePrice = saleUsd,
                ReorderThreshold = head.ReorderThreshold ?? 0,
                QuantityOnHand = total,
                Size = sizeSummary.Count == 0 ? null : string.Join(", ", sizeSummary),
                IsActive = true,
                Variants = variants.Select(x => new ProductVariant
                    { Size = x.Size, QuantityOnHand = x.Qty, CostPrice = costUsd, SalePrice = saleUsd }).ToList()
            };
            _db.Products.Add(product);
            productsCreated++;
            variantsCreated += variants.Count;
        }

        await _db.SaveChangesAsync(ct);

        return new ProductImportResult(productsCreated, variantsCreated, rowsProcessed,
            createdVendors, createdInventories, createdCategories, createdSubs, errors);
    }

    private static IEnumerable<string> Distinct(IEnumerable<string?> names) =>
        names.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n!.Trim())
             .GroupBy(n => n.ToLowerInvariant()).Select(g => g.First());

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    /// <summary>Effective per-unit cost &amp; sale in USD. Uses explicit Cost/Sale when present; otherwise
    /// derives them from Rate + GST − discount (cost) and cost × markup, rounded (sale).</summary>
    private (decimal cost, decimal sale) ResolvePrice(ProductImportRow h)
    {
        decimal? costInr = h.CostInr;
        if (costInr is null && h.RateInr is decimal rate)
        {
            var gst = 1 + (h.GstPct ?? 0) / 100m;
            var disc = 1 - (h.DiscountPct ?? 0) / 100m;
            costInr = Math.Round(rate * gst * disc, 2);
        }
        var costUsd = costInr is decimal ci ? Math.Round(ci / InrPerUsd, 2) : 0m;

        decimal? saleUsd = h.SaleUsd;
        if (saleUsd is null && costInr is decimal cin)
        {
            var saleInr = cin * (1 + (h.MarkupPct ?? 0) / 100m);
            var round = h.RoundInr ?? 0m;
            if (round > 0) saleInr = Math.Round(saleInr / round, 0, MidpointRounding.AwayFromZero) * round;
            saleUsd = Math.Round(saleInr / InrPerUsd, 2);
        }
        return (costUsd, saleUsd ?? costUsd);
    }

    /// <summary>A 3-letter uppercase SKU prefix from a vendor/product name.</summary>
    private static string CodeFrom(string? name)
    {
        var letters = new string((name ?? string.Empty).Where(char.IsLetter).ToArray()).ToUpperInvariant();
        return letters.Length >= 3 ? letters[..3] : letters.PadRight(3, 'X');
    }
}
