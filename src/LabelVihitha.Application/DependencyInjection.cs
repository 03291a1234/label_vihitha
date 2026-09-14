using System.Reflection;
using FluentValidation;
using LabelVihitha.Application.Features.Categories;
using LabelVihitha.Application.Features.Customers;
using LabelVihitha.Application.Features.FollowUps;
using LabelVihitha.Application.Features.Inventories;
using LabelVihitha.Application.Features.Invoices;
using LabelVihitha.Application.Features.Orders;
using LabelVihitha.Application.Features.Products;
using LabelVihitha.Application.Features.Reports;
using LabelVihitha.Application.Features.SubCategories;
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
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IInvoiceService, InvoiceService>();
        services.AddScoped<IFollowUpService, FollowUpService>();
        services.AddScoped<IAnalyticsService, AnalyticsService>();

        return services;
    }
}
