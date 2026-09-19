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

        var q = FilteredQuery(query);

        var total = await q.CountAsync(ct);
        var ordered = ApplySort(q.Include(p => p.Category).Include(p => p.SubCategory).Include(p => p.Inventory).Include(p => p.Vendor).Include(p => p.PaidByOwner).Include(p => p.Variants).Include(p => p.CostComponents).ThenInclude(c => c.Vendor), query.SortBy, query.SortDir);
        var entities = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var sold = await SoldUnitsAsync(entities.Select(e => e.Id), ct);
        return new PagedResult<ProductDto>
        {
            Items = entities.Select(e => MapToDto(e, sold.GetValueOrDefault(e.Id))).ToList(),
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };
    }

    /// <summary>Aggregate totals (count, units, cost & sale value at current prices) for the
    /// SAME filters as the product list — so a filtered view can show its overall figures.</summary>
    public async Task<ProductTotalsDto> GetTotalsAsync(ProductQuery query, CancellationToken ct = default)
    {
        var rows = await FilteredQuery(query)
            .Select(p => new
            {
                p.QuantityOnHand,
                // Variant-aware valuation: sizes with an override at their own price, the rest at the
                // product price. Split this way so each SUM references only inner columns (SQL Server
                // rejects an aggregate that mixes an outer reference with other columns).
                Cost = p.Variants.Where(v => !v.IsDeleted && v.CostPrice != null).Sum(v => (v.CostPrice ?? 0m) * v.QuantityOnHand)
                     + p.OriginalPrice * p.Variants.Where(v => !v.IsDeleted && v.CostPrice == null).Sum(v => v.QuantityOnHand),
                Sale = p.Variants.Where(v => !v.IsDeleted && v.SalePrice != null).Sum(v => (v.SalePrice ?? 0m) * v.QuantityOnHand)
                     + p.SalePrice * p.Variants.Where(v => !v.IsDeleted && v.SalePrice == null).Sum(v => v.QuantityOnHand)
            })
            .ToListAsync(ct);
        return new ProductTotalsDto(
            rows.Count,
            rows.Sum(r => r.QuantityOnHand),
            rows.Sum(r => r.Cost),
            rows.Sum(r => r.Sale));
    }

    /// <summary>Faceted filter options: for each dimension, the values still present among products
    /// matching ALL the OTHER active filters (so a filter never empties its own list, and picking
    /// one narrows the others). Category options also drop the subcategory constraint.</summary>
    public async Task<ProductFilterOptionsDto> GetFilterOptionsAsync(ProductQuery q, CancellationToken ct = default)
    {
        // Base query applying only the requested dimensions plus the always-on search/low-stock.
        IQueryable<Product> Base(bool cat, bool sub, bool inv, bool ven)
        {
            var x = _db.Products.AsNoTracking().Where(p => !p.IsDeleted);
            if (cat && q.CategoryId is int c) x = x.Where(p => p.CategoryId == c);
            if (sub && q.SubCategoryId is int s) x = x.Where(p => p.SubCategoryId == s);
            if (inv && q.InventoryId is int i) x = x.Where(p => p.InventoryId == i);
            if (ven && q.VendorId is int v) x = x.Where(p => p.VendorId == v);
            if (q.LowStockOnly) x = x.Where(p => p.QuantityOnHand <= p.ReorderThreshold);
            if (!string.IsNullOrWhiteSpace(q.Search))
            {
                var t = q.Search.Trim();
                x = x.Where(p => p.Name.Contains(t) || p.SKU.Contains(t));
            }
            return x;
        }

        // Distinct on raw columns in SQL, then map to the DTO and sort in memory (EF can't order
        // by a member of a projected record after Distinct).
        static List<FilterOptionDto> Map(IEnumerable<(int Id, string Name)> rows) =>
            rows.Select(r => new FilterOptionDto(r.Id, r.Name)).OrderBy(o => o.Name).ToList();

        var categories = Map((await Base(false, false, true, true)
            .Select(p => new { Id = p.CategoryId, p.Category.Name }).Distinct().ToListAsync(ct))
            .Select(x => (x.Id, x.Name)));
        var subCategories = Map((await Base(true, false, true, true).Where(p => p.SubCategoryId != null)
            .Select(p => new { Id = p.SubCategoryId!.Value, p.SubCategory!.Name }).Distinct().ToListAsync(ct))
            .Select(x => (x.Id, x.Name)));
        var inventories = Map((await Base(true, true, false, true).Where(p => p.InventoryId != null)
            .Select(p => new { Id = p.InventoryId!.Value, p.Inventory!.Name }).Distinct().ToListAsync(ct))
            .Select(x => (x.Id, x.Name)));
        var vendors = Map((await Base(true, true, true, false).Where(p => p.VendorId != null)
            .Select(p => new { Id = p.VendorId!.Value, p.Vendor!.Name }).Distinct().ToListAsync(ct))
            .Select(x => (x.Id, x.Name)));

        return new ProductFilterOptionsDto(categories, subCategories, inventories, vendors);
    }

    /// <summary>The product list's filter predicate, shared by the paged list and its totals.</summary>
    private IQueryable<Product> FilteredQuery(ProductQuery query)
    {
        var q = _db.Products.AsNoTracking().Where(p => !p.IsDeleted);
        if (query.CategoryId is int cid) q = q.Where(p => p.CategoryId == cid);
        if (query.SubCategoryId is int scid) q = q.Where(p => p.SubCategoryId == scid);
        if (query.InventoryId is int invId) q = q.Where(p => p.InventoryId == invId);
        if (query.VendorId is int venId) q = q.Where(p => p.VendorId == venId);
        if (query.IsActive is bool active) q = q.Where(p => p.IsActive == active);
        if (query.LowStockOnly) q = q.Where(p => p.QuantityOnHand <= p.ReorderThreshold);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            q = q.Where(p => p.Name.Contains(term) || p.SKU.Contains(term));
        }
        return q;
    }

    public async Task<InventorySummary> GetInventorySummaryAsync(ProductQuery? query = null, CancellationToken ct = default)
    {
        // Honor the same filters as the product list, so the summary describes whatever set is
        // in view (e.g. a single vendor). Flat rows, then group in memory by category → subcategory.
        var rows = await FilteredQuery(query ?? new ProductQuery())
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
            .Include(p => p.PaidByOwner)
            .Include(p => p.Variants)
            .Include(p => p.CostComponents).ThenInclude(c => c.Vendor)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct);
        if (entity is null) throw new NotFoundException(nameof(Product), id);
        var sold = await SoldUnitsAsync(new[] { id }, ct);
        return MapToDto(entity, sold.GetValueOrDefault(id));
    }

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct = default)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == request.CategoryId && !c.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Category), request.CategoryId);

        await EnsureSkuUniqueAsync(request.SKU, null, ct);
        await EnsureSubCategoryValidAsync(request.CategoryId, request.SubCategoryId, ct);
        await EnsureInventoryValidAsync(request.InventoryId, ct);
        await EnsureVendorValidAsync(request.VendorId, ct);
        await EnsureOwnerValidAsync(request.PaidByOwnerId, ct);
        await EnsureComponentVendorsValidAsync(request.CostComponents, ct);

        var components = NormalizeComponents(request.CostComponents);

        var entity = new Product
        {
            CategoryId = request.CategoryId,
            SubCategoryId = request.SubCategoryId,
            InventoryId = request.InventoryId,
            VendorId = request.VendorId,
            PaidByOwnerId = request.PaidByOwnerId,
            SKU = request.SKU.Trim(),
            Name = request.Name.Trim(),
            Description = request.Description,
            Color = request.Color,
            Material = request.Material,
            // Cost lines, when supplied, are the source of truth for the unit cost.
            OriginalPrice = components.Count > 0 ? components.Sum(c => c.Amount) : (request.OriginalPrice ?? 0m),
            SalePrice = request.SalePrice ?? 0m,
            ReorderThreshold = request.ReorderThreshold,
            ImageUrl = request.ImageUrl,
            IsActive = true
        };
        entity.CostComponents = components
            .Select(c => new ProductCostComponent { Label = c.Label, VendorId = c.VendorId, Amount = c.Amount }).ToList();

        var variants = NormalizeVariants(request.Variants, request.Size, request.QuantityOnHand);
        entity.Variants = variants.Select(v => new ProductVariant { Size = v.Size, QuantityOnHand = v.Qty, CostPrice = v.Cost, SalePrice = v.Sale }).ToList();
        entity.QuantityOnHand = variants.Sum(v => v.Qty);
        entity.Size = JoinSizes(variants);

        _db.Products.Add(entity);

        // Optionally record the funding owner's out-of-pocket purchase as a capital contribution.
        if (request.RecordOwnerContribution && request.PaidByOwnerId is int ownerId)
        {
            var totalCost = Math.Round(EffectiveCost(entity), 2);
            if (totalCost > 0)
                _db.OwnerTransactions.Add(new OwnerTransaction
                {
                    OwnerId = ownerId,
                    Date = DateTime.UtcNow,
                    Type = Domain.Enums.OwnerTransactionType.Contribution,
                    Amount = totalCost,
                    Notes = $"Inventory purchase: {entity.Name} ({entity.SKU})"
                });
        }

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(entity.Id, ct);
    }

    public async Task<ProductDto> UpdateAsync(int id, UpdateProductRequest request, CancellationToken ct = default)
    {
        var entity = await _db.Products.Include(p => p.Variants).Include(p => p.CostComponents)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Product), id);

        if (!await _db.Categories.AnyAsync(c => c.Id == request.CategoryId && !c.IsDeleted, ct))
            throw new NotFoundException(nameof(Category), request.CategoryId);

        await EnsureSkuUniqueAsync(request.SKU, id, ct);
        await EnsureSubCategoryValidAsync(request.CategoryId, request.SubCategoryId, ct);
        await EnsureInventoryValidAsync(request.InventoryId, ct);
        await EnsureVendorValidAsync(request.VendorId, ct);
        await EnsureOwnerValidAsync(request.PaidByOwnerId, ct);
        await EnsureComponentVendorsValidAsync(request.CostComponents, ct);

        var components = NormalizeComponents(request.CostComponents);

        entity.CategoryId = request.CategoryId;
        entity.SubCategoryId = request.SubCategoryId;
        entity.InventoryId = request.InventoryId;
        entity.VendorId = request.VendorId;
        entity.PaidByOwnerId = request.PaidByOwnerId;
        entity.SKU = request.SKU.Trim();
        entity.Name = request.Name.Trim();
        entity.Description = request.Description;
        entity.Color = request.Color;
        entity.Material = request.Material;
        // Cost lines, when supplied, drive the unit cost; otherwise use the direct value.
        entity.OriginalPrice = components.Count > 0 ? components.Sum(c => c.Amount) : request.OriginalPrice;
        entity.SalePrice = request.SalePrice;
        entity.ReorderThreshold = request.ReorderThreshold;
        entity.ImageUrl = request.ImageUrl;
        entity.IsActive = request.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;

        SyncVariants(entity, NormalizeVariants(request.Variants, request.Size, request.QuantityOnHand));
        SyncCostComponents(entity, components);

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

    /// <summary>Set (or clear, when owner is null) the per-product "paid by" funder on every
    /// product matching the given filters — the same filters as the product list. Optionally
    /// posts a single owner capital contribution equal to the affected stock's total cost.</summary>
    public async Task<BulkSetPaidByResult> BulkSetPaidByOwnerAsync(BulkSetPaidByRequest request, CancellationToken ct = default)
    {
        await EnsureOwnerValidAsync(request.PaidByOwnerId, ct);

        var q = _db.Products.Where(p => !p.IsDeleted);
        if (request.CategoryId is int cid) q = q.Where(p => p.CategoryId == cid);
        if (request.SubCategoryId is int scid) q = q.Where(p => p.SubCategoryId == scid);
        if (request.InventoryId is int invId) q = q.Where(p => p.InventoryId == invId);
        if (request.VendorId is int venId) q = q.Where(p => p.VendorId == venId);
        if (request.LowStockOnly) q = q.Where(p => p.QuantityOnHand <= p.ReorderThreshold);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim();
            q = q.Where(p => p.Name.Contains(term) || p.SKU.Contains(term));
        }

        var products = await q.Include(p => p.Variants).ToListAsync(ct);
        foreach (var p in products)
        {
            p.PaidByOwnerId = request.PaidByOwnerId;
            p.UpdatedAt = DateTime.UtcNow;
        }

        var totalCost = Math.Round(products.Sum(EffectiveCost), 2);
        var posted = false;
        if (request.RecordOwnerContribution && request.PaidByOwnerId is int ownerId && totalCost > 0)
        {
            _db.OwnerTransactions.Add(new OwnerTransaction
            {
                OwnerId = ownerId,
                Date = DateTime.UtcNow,
                Type = Domain.Enums.OwnerTransactionType.Contribution,
                Amount = totalCost,
                Notes = $"Bulk inventory funding: {products.Count} product(s)"
            });
            posted = true;
        }

        await _db.SaveChangesAsync(ct);
        return new BulkSetPaidByResult(products.Count, totalCost, posted);
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
            "sold" => desc
                ? q.OrderByDescending(p => p.OrderItems.Where(i => SoldStatuses.Contains(i.Order.Status)).Sum(i => (int?)i.Quantity) ?? 0)
                : q.OrderBy(p => p.OrderItems.Where(i => SoldStatuses.Contains(i.Order.Status)).Sum(i => (int?)i.Quantity) ?? 0),
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

    /// <summary>A chosen funding owner (if any) must exist.</summary>
    private async Task EnsureOwnerValidAsync(int? ownerId, CancellationToken ct)
    {
        if (ownerId is not int id) return;
        if (!await _db.Owners.AnyAsync(o => o.Id == id && !o.IsDeleted, ct))
            throw new NotFoundException(nameof(Owner), id);
    }

    /// <summary>Every vendor referenced by a cost line (if any) must exist.</summary>
    private async Task EnsureComponentVendorsValidAsync(IReadOnlyList<ProductCostComponentInput>? components, CancellationToken ct)
    {
        if (components is null) return;
        var ids = components.Where(c => c.VendorId is int).Select(c => c.VendorId!.Value).Distinct().ToList();
        if (ids.Count == 0) return;
        var found = await _db.Vendors.Where(v => ids.Contains(v.Id) && !v.IsDeleted).Select(v => v.Id).ToListAsync(ct);
        var missing = ids.Except(found).FirstOrDefault();
        if (missing != 0) throw new NotFoundException(nameof(Vendor), missing);
    }

    // Committed sale statuses (Pending/Cancelled don't count as sold).
    private static readonly Domain.Enums.OrderStatus[] SoldStatuses =
        { Domain.Enums.OrderStatus.Confirmed, Domain.Enums.OrderStatus.Fulfilled };

    /// <summary>Total units sold (committed orders) per product, for the given product ids.</summary>
    private async Task<Dictionary<int, int>> SoldUnitsAsync(IEnumerable<int> productIds, CancellationToken ct)
    {
        var ids = productIds.Distinct().ToList();
        if (ids.Count == 0) return new();
        var rows = await _db.OrderItems.AsNoTracking()
            .Where(i => ids.Contains(i.ProductId) && SoldStatuses.Contains(i.Order.Status))
            .GroupBy(i => i.ProductId)
            .Select(g => new { ProductId = g.Key, Units = g.Sum(x => x.Quantity) })
            .ToListAsync(ct);
        return rows.ToDictionary(r => r.ProductId, r => r.Units);
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
    private static ProductDto MapToDto(Product p, int unitsSold = 0) => new(
        p.Id,
        p.CategoryId,
        p.Category?.Name ?? string.Empty,
        p.SubCategoryId,
        p.SubCategory?.Name,
        p.InventoryId,
        p.Inventory?.Name,
        p.VendorId,
        p.Vendor?.Name,
        p.PaidByOwnerId,
        p.PaidByOwner?.Name,
        p.SKU,
        p.Name,
        p.Description,
        p.Size,
        p.Color,
        p.Material,
        p.OriginalPrice,
        p.SalePrice,
        p.QuantityOnHand,
        unitsSold,
        p.ReorderThreshold,
        p.QuantityOnHand <= p.ReorderThreshold,
        p.ImageUrl,
        p.IsActive,
        (p.Variants ?? new List<ProductVariant>())
            .Where(v => !v.IsDeleted)
            .OrderBy(v => v.Id)
            .Select(v => new ProductVariantDto(v.Id, v.Size, v.QuantityOnHand, v.CostPrice, v.SalePrice))
            .ToList(),
        (p.CostComponents ?? new List<ProductCostComponent>())
            .Where(c => !c.IsDeleted)
            .OrderBy(c => c.Id)
            .Select(c => new ProductCostComponentDto(c.Id, c.Label, c.VendorId, c.Vendor?.Name, c.Amount))
            .ToList(),
        Convert.ToBase64String(p.RowVersion));

    // ---- Variant helpers ----

    /// <summary>Total cost value of a product's stock, valuing each size at its own cost when set,
    /// else the product's OriginalPrice. Falls back to product-level when variants aren't loaded.</summary>
    private static decimal EffectiveCost(Product p)
    {
        var vs = p.Variants?.Where(v => !v.IsDeleted).ToList();
        return vs is { Count: > 0 }
            ? vs.Sum(v => (v.CostPrice ?? p.OriginalPrice) * v.QuantityOnHand)
            : p.OriginalPrice * p.QuantityOnHand;
    }

    /// <summary>Normalize variant input (trim, drop blanks, merge duplicate sizes). Falls back
    /// to a single variant from the legacy Size+Quantity fields when no variants are supplied.</summary>
    private static List<(string Size, int Qty, decimal? Cost, decimal? Sale)> NormalizeVariants(
        IReadOnlyList<ProductVariantInput>? inputs, string? legacySize, int legacyQty)
    {
        var source = (inputs != null && inputs.Count > 0)
            ? inputs
            : new[] { new ProductVariantInput(string.IsNullOrWhiteSpace(legacySize) ? "One Size" : legacySize!, legacyQty) };

        return source
            .Select(v => (Size: string.IsNullOrWhiteSpace(v.Size) ? "One Size" : v.Size.Trim(),
                          Qty: v.QuantityOnHand < 0 ? 0 : v.QuantityOnHand,
                          Cost: v.CostPrice is > 0 ? v.CostPrice : null,
                          Sale: v.SalePrice is > 0 ? v.SalePrice : null))
            // Merge duplicate sizes: sum qty, keep the first non-null price.
            .GroupBy(v => v.Size, StringComparer.OrdinalIgnoreCase)
            .Select(g => (Size: g.First().Size, Qty: g.Sum(x => x.Qty),
                          Cost: g.Select(x => x.Cost).FirstOrDefault(c => c != null),
                          Sale: g.Select(x => x.Sale).FirstOrDefault(s => s != null)))
            .ToList();
    }

    /// <summary>Reconcile a product's variant rows with the desired set (add/update/soft-delete),
    /// then refresh the denormalized total and size summary.</summary>
    private static void SyncVariants(Product product, List<(string Size, int Qty, decimal? Cost, decimal? Sale)> desired)
    {
        var existing = product.Variants.Where(v => !v.IsDeleted).ToList();
        foreach (var d in desired)
        {
            var match = existing.FirstOrDefault(e => string.Equals(e.Size, d.Size, StringComparison.OrdinalIgnoreCase));
            if (match != null) { match.QuantityOnHand = d.Qty; match.CostPrice = d.Cost; match.SalePrice = d.Sale; }
            else product.Variants.Add(new ProductVariant { Size = d.Size, QuantityOnHand = d.Qty, CostPrice = d.Cost, SalePrice = d.Sale });
        }
        foreach (var e in existing)
            if (!desired.Any(d => string.Equals(d.Size, e.Size, StringComparison.OrdinalIgnoreCase)))
                e.IsDeleted = true;

        product.QuantityOnHand = desired.Sum(d => d.Qty);
        product.Size = JoinSizes(desired);
    }

    /// <summary>A comma summary of sizes for display; null when the product is effectively unsized.</summary>
    private static string? JoinSizes(List<(string Size, int Qty, decimal? Cost, decimal? Sale)> variants)
    {
        var sizes = variants.Select(v => v.Size).Where(s => !string.Equals(s, "One Size", StringComparison.OrdinalIgnoreCase)).ToList();
        return sizes.Count == 0 ? null : string.Join(", ", sizes);
    }

    // ---- Cost component helpers ----

    /// <summary>Trim/validate cost lines: drop blank-label lines, clamp negatives to 0.</summary>
    private static List<(string Label, int? VendorId, decimal Amount)> NormalizeComponents(
        IReadOnlyList<ProductCostComponentInput>? inputs)
    {
        if (inputs is null) return new();
        return inputs
            .Where(c => !string.IsNullOrWhiteSpace(c.Label))
            .Select(c => (Label: c.Label.Trim(), c.VendorId, Amount: c.Amount < 0 ? 0m : Math.Round(c.Amount, 2)))
            .ToList();
    }

    /// <summary>Reconcile a product's cost-component rows with the desired set (add/update/soft-delete).
    /// Matches existing rows in order so labels/vendors/amounts can all change.</summary>
    private static void SyncCostComponents(Product product, List<(string Label, int? VendorId, decimal Amount)> desired)
    {
        var existing = product.CostComponents.Where(c => !c.IsDeleted).OrderBy(c => c.Id).ToList();
        for (int i = 0; i < desired.Count; i++)
        {
            if (i < existing.Count)
            {
                existing[i].Label = desired[i].Label;
                existing[i].VendorId = desired[i].VendorId;
                existing[i].Amount = desired[i].Amount;
            }
            else
            {
                product.CostComponents.Add(new ProductCostComponent
                {
                    Label = desired[i].Label, VendorId = desired[i].VendorId, Amount = desired[i].Amount
                });
            }
        }
        for (int i = desired.Count; i < existing.Count; i++)
            existing[i].IsDeleted = true;
    }
}
