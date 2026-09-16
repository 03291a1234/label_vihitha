using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabelVihitha.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProductPaidByOwner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PaidByOwnerId",
                table: "Products",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_PaidByOwnerId",
                table: "Products",
                column: "PaidByOwnerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Owners_PaidByOwnerId",
                table: "Products",
                column: "PaidByOwnerId",
                principalTable: "Owners",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Products_Owners_PaidByOwnerId",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Products_PaidByOwnerId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "PaidByOwnerId",
                table: "Products");
        }
    }
}
