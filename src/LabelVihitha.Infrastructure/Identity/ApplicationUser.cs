using Microsoft.AspNetCore.Identity;

namespace LabelVihitha.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public string? DisplayName { get; set; }
}

public static class Roles
{
    public const string Admin = "Admin";         // full control incl. user management
    public const string Owner = "Owner";         // business: orders, invoicing, financials/reports
    public const string Inventory = "Inventory"; // products / inventory / categories only

    public static readonly string[] All = { Admin, Owner, Inventory };
}
