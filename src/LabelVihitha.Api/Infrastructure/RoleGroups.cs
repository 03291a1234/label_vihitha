namespace LabelVihitha.Api.Infrastructure;

/// <summary>Role groups used in [Authorize(Roles = ...)] across controllers.</summary>
public static class RoleGroups
{
    /// <summary>Products, categories, subcategories, inventories, uploads.</summary>
    public const string ManageInventory = "Admin,Inventory";

    /// <summary>Orders, invoices, customers, follow-ups, financial reports.</summary>
    public const string ManageSales = "Admin,Owner";
}
