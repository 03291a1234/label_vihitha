using LabelVihitha.Application.Common.Models;

namespace LabelVihitha.Application.Features.Expenses;

// ---- Expense categories ----
public record ExpenseCategoryDto(int Id, string Name, string? Description, bool IsActive, int ExpenseCount);
public record CreateExpenseCategoryRequest(string Name, string? Description);
public record UpdateExpenseCategoryRequest(string Name, string? Description, bool IsActive);

// ---- Expenses ----
public record ExpenseDto(
    int Id,
    int ExpenseCategoryId,
    string ExpenseCategoryName,
    DateTime Date,
    decimal Amount,
    string? Description,
    string? Notes,
    int? PaidByOwnerId,
    string? PaidByOwnerName,
    string? ReceiptUrl,
    int? InventoryId,
    string? InventoryName);

public record CreateExpenseRequest(
    int ExpenseCategoryId,
    DateTime Date,
    decimal Amount,
    string? Description,
    string? Notes,
    int? PaidByOwnerId,
    string? ReceiptUrl,
    int? InventoryId = null);

public record UpdateExpenseRequest(
    int ExpenseCategoryId,
    DateTime Date,
    decimal Amount,
    string? Description,
    string? Notes,
    int? PaidByOwnerId,
    string? ReceiptUrl,
    int? InventoryId = null);

public record ExpenseQuery(
    int? CategoryId = null,
    int? InventoryId = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    string? SortBy = null,
    string? SortDir = null,
    int Page = 1,
    int PageSize = 25);
