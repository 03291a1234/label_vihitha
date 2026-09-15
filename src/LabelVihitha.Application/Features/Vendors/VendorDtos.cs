namespace LabelVihitha.Application.Features.Vendors;

public record VendorDto(
    int Id,
    string Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Notes,
    bool IsActive,
    int ProductCount,
    int TotalUnits);

public record CreateVendorRequest(
    string Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Notes);

public record UpdateVendorRequest(
    string Name,
    string? ContactPerson,
    string? Phone,
    string? Email,
    string? Notes,
    bool IsActive);
