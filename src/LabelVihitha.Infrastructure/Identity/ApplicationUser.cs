using Microsoft.AspNetCore.Identity;

namespace LabelVihitha.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public string? DisplayName { get; set; }
}

public static class Roles
{
    public const string Owner = "Owner";     // sees financials/margins
    public const string Staff = "Staff";      // orders/inventory
    public const string ReadOnly = "ReadOnly"; // view only

    public static readonly string[] All = { Owner, Staff, ReadOnly };
}
