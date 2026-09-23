using LabelVihitha.Application.Features.Products;

namespace LabelVihitha.Application.Features.Inventories;

public record InventoryDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    bool IsVisibleOnStore,
    int? PaidByOwnerId,
    string? PaidByOwnerName,
    int ProductCount,
    int TotalUnits,
    decimal TotalCostUsd,                 // current stock on hand, at cost
    IReadOnlyList<CategoryCount> Categories,
    IReadOnlyList<InventoryBillDto> Bills,
    decimal TotalBillsUsd,
    // ---- Per-inventory performance ----
    decimal SoldRevenueUsd,               // revenue from this inventory's items already sold
    decimal SoldCostUsd,                  // cost of goods sold from this inventory
    decimal InitialCostUsd,               // TotalCostUsd + SoldCostUsd (everything ever stocked here, at cost)
    decimal ProfitUsd,                    // SoldRevenueUsd − SoldCostUsd (gross P&L to date)
    decimal AllocatedExpenseUsd,          // share of operating expenses, by this inventory's sales share
    decimal NetProfitUsd);                // ProfitUsd − AllocatedExpenseUsd (net P&L to date)

public record CreateInventoryRequest(string Name, string? Description, int? PaidByOwnerId, bool IsVisibleOnStore = true);

public record UpdateInventoryRequest(string Name, string? Description, bool IsActive, int? PaidByOwnerId, bool IsVisibleOnStore = true);

// ---- Supplier bills attached to an inventory batch (one or more per vendor) ----
public record InventoryBillDto(int Id, string FileUrl, string FileName, decimal? Amount, DateTime? BillDate, string? Note,
    int? VendorId, string? VendorName);

public record AddInventoryBillRequest(string FileUrl, string FileName, decimal? Amount, DateTime? BillDate, string? Note,
    int? VendorId = null);

/// <summary>Capitalise a shipping cost (in USD) across the inventory's on-hand units, then re-price
/// each affected product's sale price at the given markup over its new cost.</summary>
public record ApplyShippingRequest(decimal AmountUsd, decimal MarkupPercent = 100m, string? Note = null, int? CategoryId = null);

public record ApplyShippingResult(
    int ProductsUpdated, int UnitsCovered, decimal PerUnitUsd, decimal TotalUsd, decimal MarkupPercent);

/// <summary>A recorded shipping charge on an inventory batch (capitalised into product cost).</summary>
public record ShippingDto(
    int Id, decimal AmountUsd, decimal PerUnitUsd, int UnitsCovered, decimal MarkupPercent,
    DateTime AppliedAt, int ProductsAffected, string? Note, int? CategoryId, string? CategoryName);

/// <summary>Recompute every product's sale price to the given markup over its current cost,
/// without changing the cost (unlike shipping, which also adds to cost).</summary>
public record RepriceRequest(decimal MarkupPercent = 100m);
public record RepriceResult(int ProductsUpdated, decimal MarkupPercent);
