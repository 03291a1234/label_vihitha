using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabelVihitha.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "InventoryId",
                table: "Expenses",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_InventoryId",
                table: "Expenses",
                column: "InventoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Inventories_InventoryId",
                table: "Expenses",
                column: "InventoryId",
                principalTable: "Inventories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Inventories_InventoryId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_InventoryId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "InventoryId",
                table: "Expenses");
        }
    }
}
