namespace LabelVihitha.Application.Features.Customers;

public record CustomerDto(
    int Id,
    string Name,
    string? Phone,
    string? Email,
    string? Address,
    string? Notes,
    int OrderCount);

public record CreateCustomerRequest(
    string Name,
    string? Phone,
    string? Email,
    string? Address,
    string? Notes);

public record UpdateCustomerRequest(
    string Name,
    string? Phone,
    string? Email,
    string? Address,
    string? Notes);
