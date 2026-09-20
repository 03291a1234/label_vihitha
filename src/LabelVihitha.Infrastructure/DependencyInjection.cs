using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Features.Auth;
using LabelVihitha.Infrastructure.Auth;
using LabelVihitha.Infrastructure.Identity;
using LabelVihitha.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LabelVihitha.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config)
    {
        var connectionString = config.GetConnectionString("Default")
            ?? "Server=(localdb)\\mssqllocaldb;Database=LabelVihitha;Trusted_Connection=True;";

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(connectionString, sql =>
                sql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)));

        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());

        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.Password.RequiredLength = 8;
                options.User.RequireUniqueEmail = true;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>();

        services.Configure<JwtSettings>(config.GetSection(JwtSettings.SectionName));
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IIdentityService, IdentityService>();

        // --- File storage: local disk in dev, durable Azure Blob in the cloud (by config) ---
        services.Configure<Storage.StorageOptions>(config.GetSection(Storage.StorageOptions.SectionName));
        var provider = config.GetValue<string>($"{Storage.StorageOptions.SectionName}:Provider") ?? "Local";
        if (provider.Equals("AzureBlob", StringComparison.OrdinalIgnoreCase))
            services.AddScoped<IFileStorage, Storage.AzureBlobFileStorage>();
        else
            services.AddScoped<IFileStorage, Storage.LocalFileStorage>();

        return services;
    }
}
