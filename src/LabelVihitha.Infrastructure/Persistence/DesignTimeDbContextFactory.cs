using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace LabelVihitha.Infrastructure.Persistence;

/// <summary>
/// Used by `dotnet ef` at design time (migrations) — no live DB connection required.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=LabelVihitha;Trusted_Connection=True;")
            .Options;

        return new ApplicationDbContext(options);
    }
}
