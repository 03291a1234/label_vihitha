using System.Reflection;
using FluentValidation;
using LabelVihitha.Application.Features.Categories;
using LabelVihitha.Application.Features.Customers;
using LabelVihitha.Application.Features.Expenses;
using LabelVihitha.Application.Features.Finance;
using LabelVihitha.Application.Features.FollowUps;
using LabelVihitha.Application.Features.Owners;
using LabelVihitha.Application.Features.Inventories;
using LabelVihitha.Application.Features.Invoices;
using LabelVihitha.Application.Features.Orders;
using LabelVihitha.Application.Features.Products;
using LabelVihitha.Application.Features.Reports;
using LabelVihitha.Application.Features.Store;
using LabelVihitha.Application.Features.SubCategories;
using LabelVihitha.Application.Features.Vendors;
using Microsoft.Extensions.DependencyInjection;

namespace LabelVihitha.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

        services.AddScoped<ICategoryService, CategoryService>();
        services.AddScoped<ISubCategoryService, SubCategoryService>();
        services.AddScoped<IInventoryGroupService, InventoryGroupService>();
        services.AddScoped<IVendorService, VendorService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IInvoiceService, InvoiceService>();
        services.AddScoped<IFollowUpService, FollowUpService>();
        services.AddScoped<IAnalyticsService, AnalyticsService>();
        services.AddScoped<IStoreService, StoreService>();
        services.AddScoped<IExpenseCategoryService, ExpenseCategoryService>();
        services.AddScoped<IExpenseService, ExpenseService>();
        services.AddScoped<IOwnerService, OwnerService>();
        services.AddScoped<IFinanceService, FinanceService>();

        return services;
    }
}
