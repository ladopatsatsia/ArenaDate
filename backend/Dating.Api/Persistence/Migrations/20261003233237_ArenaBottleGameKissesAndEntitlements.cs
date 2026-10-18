using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ArenaBottleGameKissesAndEntitlements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "KissRecipientUserId",
                table: "GameRounds",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "KissSkipped",
                table: "GameRounds",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "HasChatEntitlement",
                table: "DatingMatch",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Origin",
                table: "DatingMatch",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Discovery");

            migrationBuilder.CreateTable(
                name: "GameKiss",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoomId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderGeneration = table.Column<int>(type: "integer", nullable: false),
                    RecipientGeneration = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    MatchedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ExpiredAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameKiss", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GameKiss_GameRooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "GameRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GameKiss_GameRounds_RoundId",
                        column: x => x.RoundId,
                        principalTable: "GameRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GameKiss_RoomId_SenderUserId_RecipientUserId",
                table: "GameKiss",
                columns: new[] { "RoomId", "SenderUserId", "RecipientUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_GameKiss_RoundId_SenderUserId_IdempotencyKey",
                table: "GameKiss",
                columns: new[] { "RoundId", "SenderUserId", "IdempotencyKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GameKiss");

            migrationBuilder.DropColumn(
                name: "KissRecipientUserId",
                table: "GameRounds");

            migrationBuilder.DropColumn(
                name: "KissSkipped",
                table: "GameRounds");

            migrationBuilder.DropColumn(
                name: "HasChatEntitlement",
                table: "DatingMatch");

            migrationBuilder.DropColumn(
                name: "Origin",
                table: "DatingMatch");
        }
    }
}
