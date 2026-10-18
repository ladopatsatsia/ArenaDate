using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGameGifts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GameGifts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    GiftId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    GiftName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    GiftIcon = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CrystalCost = table.Column<int>(type: "integer", nullable: false),
                    RoomId = table.Column<Guid>(type: "uuid", nullable: true),
                    TransactionId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameGifts", x => x.Id);
                    table.CheckConstraint("CK_GameGifts_NotSelf", "\"SenderUserId\" <> \"RecipientUserId\"");
                    table.ForeignKey(
                        name: "FK_GameGifts_AspNetUsers_RecipientUserId",
                        column: x => x.RecipientUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GameGifts_AspNetUsers_SenderUserId",
                        column: x => x.SenderUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GameGifts_CrystalTransactions_TransactionId",
                        column: x => x.TransactionId,
                        principalTable: "CrystalTransactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GameGifts_RecipientUserId_CreatedAtUtc",
                table: "GameGifts",
                columns: new[] { "RecipientUserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_GameGifts_RoomId",
                table: "GameGifts",
                column: "RoomId");

            migrationBuilder.CreateIndex(
                name: "IX_GameGifts_SenderUserId_CreatedAtUtc",
                table: "GameGifts",
                columns: new[] { "SenderUserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_GameGifts_TransactionId",
                table: "GameGifts",
                column: "TransactionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GameGifts");
        }
    }
}
