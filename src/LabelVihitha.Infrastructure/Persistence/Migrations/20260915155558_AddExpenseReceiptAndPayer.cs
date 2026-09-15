using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabelVihitha.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseReceiptAndPayer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PaidByOwnerId",
                table: "Expenses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceiptUrl",
                table: "Expenses",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_PaidByOwnerId",
                table: "Expenses",
                column: "PaidByOwnerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Owners_PaidByOwnerId",
                table: "Expenses",
                column: "PaidByOwnerId",
                principalTable: "Owners",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Owners_PaidByOwnerId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_PaidByOwnerId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "PaidByOwnerId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "ReceiptUrl",
                table: "Expenses");
        }
    }
}
