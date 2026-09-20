using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabelVihitha.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryBillVendor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "VendorId",
                table: "InventoryBills",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryBills_VendorId",
                table: "InventoryBills",
                column: "VendorId");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryBills_Vendors_VendorId",
                table: "InventoryBills",
                column: "VendorId",
                principalTable: "Vendors",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryBills_Vendors_VendorId",
                table: "InventoryBills");

            migrationBuilder.DropIndex(
                name: "IX_InventoryBills_VendorId",
                table: "InventoryBills");

            migrationBuilder.DropColumn(
                name: "VendorId",
                table: "InventoryBills");
        }
    }
}
