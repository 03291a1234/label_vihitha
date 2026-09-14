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
        var entities = await q
            .Include(p => p.Category)
            .Include(p => p.SubCategory)
            .OrderBy(p => p.Name)
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

    public async Task<ProductDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.Products.AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.SubCategory)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct);
        return entity is null ? throw new NotFoundException(nameof(Product), id) : MapToDto(entity);
    }

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct = default)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == request.CategoryId && !c.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Category), request.CategoryId);

        await EnsureSkuUniqueAsync(request.SKU, null, ct);
        await EnsureSubCategoryValidAsync(request.CategoryId, request.SubCategoryId, ct);

        var entity = new Product
        {
            CategoryId = request.CategoryId,
            SubCategoryId = request.SubCategoryId,
            SKU = request.SKU.Trim(),
            Name = request.Name.Trim(),
            Description = request.Description,
            Size = request.Size,
            Color = request.Color,
            Material = request.Material,
            // Inherit category defaults when a price is omitted.
            OriginalPrice = request.OriginalPrice ?? category.DefaultOriginalPrice ?? 0m,
            SalePrice = request.SalePrice ?? category.DefaultSalePrice ?? 0m,
            QuantityOnHand = request.QuantityOnHand,
            ReorderThreshold = request.ReorderThreshold,
            ImageUrl = request.ImageUrl,
            IsActive = true
        };

        _db.Products.Add(entity);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(entity.Id, ct);
    }

    public async Task<ProductDto> UpdateAsync(int id, UpdateProductRequest request, CancellationToken ct = default)
    {
        var entity = await _db.Products.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct)
            ?? throw new NotFoundException(nameof(Product), id);

        if (!await _db.Categories.AnyAsync(c => c.Id == request.CategoryId && !c.IsDeleted, ct))
            throw new NotFoundException(nameof(Category), request.CategoryId);

        await EnsureSkuUniqueAsync(request.SKU, id, ct);
        await EnsureSubCategoryValidAsync(request.CategoryId, request.SubCategoryId, ct);

        entity.CategoryId = request.CategoryId;
        entity.SubCategoryId = request.SubCategoryId;
        entity.SKU = request.SKU.Trim();
        entity.Name = request.Name.Trim();
        entity.Description = request.Description;
        entity.Size = request.Size;
        entity.Color = request.Color;
        entity.Material = request.Material;
        entity.OriginalPrice = request.OriginalPrice;
        entity.SalePrice = request.SalePrice;
        entity.QuantityOnHand = request.QuantityOnHand;
        entity.ReorderThreshold = request.ReorderThreshold;
        entity.ImageUrl = request.ImageUrl;
        entity.IsActive = request.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;

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

    /// <summary>A chosen subcategory (if any) must exist and belong to the product's category.</summary>
    private async Task EnsureSubCategoryValidAsync(int categoryId, int? subCategoryId, CancellationToken ct)
    {
        if (subCategoryId is not int scid) return;
        var ok = await _db.SubCategories.AnyAsync(
            s => s.Id == scid && s.CategoryId == categoryId && !s.IsDeleted, ct);
        if (!ok)
            throw new ConflictException("The selected subcategory does not belong to the chosen category.");
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
        Convert.ToBase64String(p.RowVersion));
}
