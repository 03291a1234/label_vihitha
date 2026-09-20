using LabelVihitha.Application.Features.Products;

namespace LabelVihitha.Application.Features.Inventories;

public record InventoryDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
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

public record CreateInventoryRequest(string Name, string? Description, int? PaidByOwnerId);

public record UpdateInventoryRequest(string Name, string? Description, bool IsActive, int? PaidByOwnerId);

// ---- Supplier bills attached to an inventory batch (one or more per vendor) ----
public record InventoryBillDto(int Id, string FileUrl, string FileName, decimal? Amount, DateTime? BillDate, string? Note,
    int? VendorId, string? VendorName);

public record AddInventoryBillRequest(string FileUrl, string FileName, decimal? Amount, DateTime? BillDate, string? Note,
    int? VendorId = null);
