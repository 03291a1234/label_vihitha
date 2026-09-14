using System.Reflection;
using FluentValidation;
using LabelVihitha.Application.Features.Categories;
using LabelVihitha.Application.Features.Products;
using Microsoft.Extensions.DependencyInjection;

namespace LabelVihitha.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

        services.AddScoped<ICategoryService, CategoryService>();
        services.AddScoped<IProductService, ProductService>();

        return services;
    }
}
