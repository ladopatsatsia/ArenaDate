using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ArenaBottleGameStorePurchases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OutstandingDebt",
                table: "UserWallets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "StorePurchases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Platform = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProductId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TransactionId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PurchaseToken = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<int>(type: "integer", nullable: false),
                    PriceCurrency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    PriceAmount = table.Column<decimal>(type: "numeric", nullable: true),
                    Environment = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RefundedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RefundReason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StorePurchases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StorePurchases_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserWallets_OutstandingDebt",
                table: "UserWallets",
                sql: "\"OutstandingDebt\" >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_StorePurchases_Platform_TransactionId",
                table: "StorePurchases",
                columns: new[] { "Platform", "TransactionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StorePurchases_UserId",
                table: "StorePurchases",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StorePurchases");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserWallets_OutstandingDebt",
                table: "UserWallets");

            migrationBuilder.DropColumn(
                name: "OutstandingDebt",
                table: "UserWallets");
        }
    }
}
