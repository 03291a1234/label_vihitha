using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LabelVihitha.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProductVariants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProductVariantId",
                table: "OrderItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Size",
                table: "OrderItems",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProductVariants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    Size = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    QuantityOnHand = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductVariants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductVariants_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_ProductVariantId",
                table: "OrderItems",
                column: "ProductVariantId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_ProductId_Size",
                table: "ProductVariants",
                columns: new[] { "ProductId", "Size" },
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_ProductVariants_ProductVariantId",
                table: "OrderItems",
                column: "ProductVariantId",
                principalTable: "ProductVariants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Backfill: give every existing product a single size variant carrying its current
            // stock, so the new per-size model has data from day one.
            migrationBuilder.Sql(@"
                INSERT INTO ProductVariants (ProductId, Size, QuantityOnHand, TenantId, CreatedAt, IsDeleted)
                SELECT p.Id,
                       CASE WHEN p.Size IS NULL OR LTRIM(RTRIM(p.Size)) = '' THEN 'One Size' ELSE p.Size END,
                       p.QuantityOnHand, p.TenantId, SYSUTCDATETIME(), 0
                FROM Products p
                WHERE p.IsDeleted = 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_ProductVariants_ProductVariantId",
                table: "OrderItems");

            migrationBuilder.DropTable(
                name: "ProductVariants");

            migrationBuilder.DropIndex(
                name: "IX_OrderItems_ProductVariantId",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "ProductVariantId",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "Size",
                table: "OrderItems");
        }
    }
}
