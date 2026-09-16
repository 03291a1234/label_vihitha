using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Common.Models;
using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Products;

public class ProductService : IProductService
{
    private readonly IApplicationDbContext _db;

    public ProductService(IApplicationDbContext db) => _db = db;

    public async Task<PagedResult<ProductDto>> GetAsync(ProductQuery query, CancellationToken ct = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize is < 1 or > 200 ? 25 : query.PageSize;

        var q = _db.Products.AsNoTracking().Where(p => !p.IsDeleted);

        if (query.CategoryId is int cid)
            q = q.Where(p => p.CategoryId == cid);
        if (query.SubCategoryId is int scid)
            q = q.Where(p => p.SubCategoryId == scid);
        if (query.InventoryId is int invId)
            q = q.Where(p => p.InventoryId == invId);
        if (query.VendorId is int venId)
            q = q.Where(p => p.VendorId == venId);
        if (query.IsActive is bool active)
            q = q.Where(p => p.IsActive == active);
        if (query.LowStockOnly)
            q = q.Where(p => p.QuantityOnHand <= p.ReorderThreshold);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            q = q.Where(p => p.Name.Contains(term) || p.SKU.Contains(term));
        }

        var total = await q.CountAsync(ct);
        var ordered = ApplySort(q.Include(p => p.Category).Include(p => p.SubCategory).Include(p => p.Inventory).Include(p => p.Vendor).Include(p => p.Variants), query.SortBy, query.SortDir);
        var entities = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<ProductDto>
        {
            Items = entities.Select(MapToDto).ToList(),
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<InventorySummary> GetInventorySummaryAsync(CancellationToken ct = default)
    {
        // Flat rows (a translatable join), then group in memory by category → subcategory.
        var rows = await _db.Products.AsNoTracking()
            .Where(p => !p.IsDeleted)
            .Select(p => new
            {
                p.CategoryId,
                CategoryName = p.Category.Name,
                p.SubCategoryId,
                SubCategoryName = p.SubCategory != null ? p.SubCategory.Name : null,
                p.QuantityOnHand
            })
            .ToListAsync(ct);

        var categories = rows
            .GroupBy(r => new { r.CategoryId, r.CategoryName })
            .Select(cg => new CategoryCount(
                cg.Key.CategoryId, cg.Key.CategoryName, cg.Count(), cg.Sum(x => x.QuantityOnHand),
                cg.GroupBy(x => new { x.SubCategoryId, x.SubCategoryName })
                    .Select(sg => new SubCategoryCount(
                        sg.Key.SubCategoryId,
                        sg.Key.SubCategoryName ?? "Unassigned",
                        sg.Count(), sg.Sum(x => x.QuantityOnHand)))
                    .OrderByDescending(s => s.ProductCount).ThenBy(s => s.SubCategoryName)
                    .ToList()))
            .OrderBy(c => c.CategoryName)
            .ToList();

        return new InventorySummary(rows.Count, rows.Sum(r => r.QuantityOnHand), categories);
    }

    public async Task<ProductDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.Products.AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.SubCategory)
            .Include(p => p.Inventory)
            .Include(p => p.Vendor)
            .Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct);
        return entity is null ? throw new NotFoundException(nameof(Product), id) : MapToDto(entity);
    }

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct = default)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == request.CategoryId && !c.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Category), request.CategoryId);

        await EnsureSkuUniqueAsync(request.SKU, null, ct);
        await EnsureSubCategoryValidAsync(request.CategoryId, request.SubCategoryId, ct);
        await EnsureInventoryValidAsync(request.InventoryId, ct);
        await EnsureVendorValidAsync(request.VendorId, ct);

        var entity = new Product
        {
            CategoryId = request.CategoryId,
            SubCategoryId = request.SubCategoryId,
            InventoryId = request.InventoryId,
            VendorId = request.VendorId,
            SKU = request.SKU.Trim(),
            Name = request.Name.Trim(),
            Description = request.Description,
            Color = request.Color,
            Material = request.Material,
            OriginalPrice = request.OriginalPrice ?? 0m,
            SalePrice = request.SalePrice ?? 0m,
            ReorderThreshold = request.ReorderThreshold,
            ImageUrl = request.ImageUrl,
            IsActive = true
        };

        var variants = NormalizeVariants(request.Variants, request.Size, request.QuantityOnHand);
        entity.Variants = variants.Select(v => new ProductVariant { Size = v.Size, QuantityOnHand = v.Qty }).ToList();
        entity.QuantityOnHand = variants.Sum(v => v.Qty);
        entity.Size = JoinSizes(variants);

        _db.Products.Add(entity);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(entity.Id, ct);
    }

    public async Task<ProductDto> UpdateAsync(int id, UpdateProductRequest request, CancellationToken ct = default)
    {
        var entity = await _db.Products.Include(p => p.Variants).FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Product), id);

        if (!await _db.Categories.AnyAsync(c => c.Id == request.CategoryId && !c.IsDeleted, ct))
            throw new NotFoundException(nameof(Category), request.CategoryId);

        await EnsureSkuUniqueAsync(request.SKU, id, ct);
        await EnsureSubCategoryValidAsync(request.CategoryId, request.SubCategoryId, ct);
        await EnsureInventoryValidAsync(request.InventoryId, ct);
        await EnsureVendorValidAsync(request.VendorId, ct);

        entity.CategoryId = request.CategoryId;
        entity.SubCategoryId = request.SubCategoryId;
        entity.InventoryId = request.InventoryId;
        entity.VendorId = request.VendorId;
        entity.SKU = request.SKU.Trim();
        entity.Name = request.Name.Trim();
        entity.Description = request.Description;
        entity.Color = request.Color;
        entity.Material = request.Material;
        entity.OriginalPrice = request.OriginalPrice;
        entity.SalePrice = request.SalePrice;
        entity.ReorderThreshold = request.ReorderThreshold;
        entity.ImageUrl = request.ImageUrl;
        entity.IsActive = request.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;

        SyncVariants(entity, NormalizeVariants(request.Variants, request.Size, request.QuantityOnHand));

        // Optimistic concurrency — reject if the row changed since the client read it.
        if (!string.IsNullOrEmpty(request.RowVersion))
        {
            try
            {
                _db.Entry(entity).Property(p => p.RowVersion).OriginalValue =
                    Convert.FromBase64String(request.RowVersion);
            }
            catch (FormatException)
            {
                throw new ConflictException("Invalid RowVersion token.");
            }
        }

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException(
                "This product was modified by someone else. Reload and try again.");
        }

        return await GetByIdAsync(entity.Id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.Products.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Product), id);

        entity.IsDeleted = true;
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private static IQueryable<Product> ApplySort(IQueryable<Product> q, string? sortBy, string? dir)
    {
        var desc = string.Equals(dir, "desc", StringComparison.OrdinalIgnoreCase);
        return sortBy?.ToLowerInvariant() switch
        {
            "sku" => desc ? q.OrderByDescending(p => p.SKU) : q.OrderBy(p => p.SKU),
            "originalprice" => desc ? q.OrderByDescending(p => p.OriginalPrice) : q.OrderBy(p => p.OriginalPrice),
            "saleprice" => desc ? q.OrderByDescending(p => p.SalePrice) : q.OrderBy(p => p.SalePrice),
            "quantityonhand" => desc ? q.OrderByDescending(p => p.QuantityOnHand) : q.OrderBy(p => p.QuantityOnHand),
            "name" => desc ? q.OrderByDescending(p => p.Name) : q.OrderBy(p => p.Name),
            _ => q.OrderBy(p => p.Name)
        };
    }

    /// <summary>A chosen subcategory (if any) must exist and belong to the product's category.</summary>
    private async Task EnsureSubCategoryValidAsync(int categoryId, int? subCategoryId, CancellationToken ct)
    {
        if (subCategoryId is not int scid) return;
        var ok = await _db.SubCategories.AnyAsync(
            s => s.Id == scid && s.CategoryId == categoryId && !s.IsDeleted, ct);
        if (!ok)
            throw new ConflictException("The selected subcategory does not belong to the chosen category.");
    }

    /// <summary>A chosen inventory (if any) must exist.</summary>
    private async Task EnsureInventoryValidAsync(int? inventoryId, CancellationToken ct)
    {
        if (inventoryId is not int id) return;
        if (!await _db.Inventories.AnyAsync(i => i.Id == id && !i.IsDeleted, ct))
            throw new NotFoundException(nameof(Inventory), id);
    }

    /// <summary>A chosen vendor (if any) must exist.</summary>
    private async Task EnsureVendorValidAsync(int? vendorId, CancellationToken ct)
    {
        if (vendorId is not int id) return;
        if (!await _db.Vendors.AnyAsync(v => v.Id == id && !v.IsDeleted, ct))
            throw new NotFoundException(nameof(Vendor), id);
    }

    private async Task EnsureSkuUniqueAsync(string sku, int? excludeId, CancellationToken ct)
    {
        var normalized = sku.Trim();
        var exists = await _db.Products.AnyAsync(
            p => !p.IsDeleted && p.SKU == normalized && (excludeId == null || p.Id != excludeId), ct);
        if (exists)
            throw new ConflictException($"A product with SKU '{normalized}' already exists.");
    }

    // In-memory mapping (never used inside an EF expression tree — Category must be loaded).
    private static ProductDto MapToDto(Product p) => new(
        p.Id,
        p.CategoryId,
        p.Category?.Name ?? string.Empty,
        p.SubCategoryId,
        p.SubCategory?.Name,
        p.InventoryId,
        p.Inventory?.Name,
        p.VendorId,
        p.Vendor?.Name,
        p.SKU,
        p.Name,
        p.Description,
        p.Size,
        p.Color,
        p.Material,
        p.OriginalPrice,
        p.SalePrice,
        p.QuantityOnHand,
        p.ReorderThreshold,
        p.QuantityOnHand <= p.ReorderThreshold,
        p.ImageUrl,
        p.IsActive,
        (p.Variants ?? new List<ProductVariant>())
            .Where(v => !v.IsDeleted)
            .OrderBy(v => v.Id)
            .Select(v => new ProductVariantDto(v.Id, v.Size, v.QuantityOnHand))
            .ToList(),
        Convert.ToBase64String(p.RowVersion));

    // ---- Variant helpers ----

    /// <summary>Normalize variant input (trim, drop blanks, merge duplicate sizes). Falls back
    /// to a single variant from the legacy Size+Quantity fields when no variants are supplied.</summary>
    private static List<(string Size, int Qty)> NormalizeVariants(
        IReadOnlyList<ProductVariantInput>? inputs, string? legacySize, int legacyQty)
    {
        var source = (inputs != null && inputs.Count > 0)
            ? inputs
            : new[] { new ProductVariantInput(string.IsNullOrWhiteSpace(legacySize) ? "One Size" : legacySize!, legacyQty) };

        return source
            .Select(v => (Size: string.IsNullOrWhiteSpace(v.Size) ? "One Size" : v.Size.Trim(),
                          Qty: v.QuantityOnHand < 0 ? 0 : v.QuantityOnHand))
            .GroupBy(v => v.Size, StringComparer.OrdinalIgnoreCase)
            .Select(g => (Size: g.First().Size, Qty: g.Sum(x => x.Qty)))
            .ToList();
    }

    /// <summary>Reconcile a product's variant rows with the desired set (add/update/soft-delete),
    /// then refresh the denormalized total and size summary.</summary>
    private static void SyncVariants(Product product, List<(string Size, int Qty)> desired)
    {
        var existing = product.Variants.Where(v => !v.IsDeleted).ToList();
        foreach (var d in desired)
        {
            var match = existing.FirstOrDefault(e => string.Equals(e.Size, d.Size, StringComparison.OrdinalIgnoreCase));
            if (match != null) match.QuantityOnHand = d.Qty;
            else product.Variants.Add(new ProductVariant { Size = d.Size, QuantityOnHand = d.Qty });
        }
        foreach (var e in existing)
            if (!desired.Any(d => string.Equals(d.Size, e.Size, StringComparison.OrdinalIgnoreCase)))
                e.IsDeleted = true;

        product.QuantityOnHand = desired.Sum(d => d.Qty);
        product.Size = JoinSizes(desired);
    }

    /// <summary>A comma summary of sizes for display; null when the product is effectively unsized.</summary>
    private static string? JoinSizes(List<(string Size, int Qty)> variants)
    {
        var sizes = variants.Select(v => v.Size).Where(s => !string.Equals(s, "One Size", StringComparison.OrdinalIgnoreCase)).ToList();
        return sizes.Count == 0 ? null : string.Join(", ", sizes);
    }
}
