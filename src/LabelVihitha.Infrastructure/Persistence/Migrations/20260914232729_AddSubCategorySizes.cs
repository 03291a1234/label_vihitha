using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabelVihitha.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSubCategorySizes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Sizes",
                table: "SubCategories",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Sizes",
                table: "SubCategories");
        }
    }
}
