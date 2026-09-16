using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabelVihitha.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryPaidByOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PaidByOwnerId",
                table: "Inventories",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Inventories_PaidByOwnerId",
                table: "Inventories",
                column: "PaidByOwnerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Inventories_Owners_PaidByOwnerId",
                table: "Inventories",
                column: "PaidByOwnerId",
                principalTable: "Owners",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Inventories_Owners_PaidByOwnerId",
                table: "Inventories");

            migrationBuilder.DropIndex(
                name: "IX_Inventories_PaidByOwnerId",
                table: "Inventories");

            migrationBuilder.DropColumn(
                name: "PaidByOwnerId",
                table: "Inventories");
        }
    }
}
