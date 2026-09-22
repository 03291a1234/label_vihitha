using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabelVihitha.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ShippingByCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "InventoryShippings",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryShippings_CategoryId",
                table: "InventoryShippings",
                column: "CategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryShippings_Categories_CategoryId",
                table: "InventoryShippings",
                column: "CategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryShippings_Categories_CategoryId",
                table: "InventoryShippings");

            migrationBuilder.DropIndex(
                name: "IX_InventoryShippings_CategoryId",
                table: "InventoryShippings");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "InventoryShippings");
        }
    }
}
