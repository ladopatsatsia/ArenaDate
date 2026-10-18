using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ArenaBottleGameAiCommentaryAndSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GameKiss_GameRooms_RoomId",
                table: "GameKiss");

            migrationBuilder.DropForeignKey(
                name: "FK_GameKiss_GameRounds_RoundId",
                table: "GameKiss");

            migrationBuilder.DropPrimaryKey(
                name: "PK_GameKiss",
                table: "GameKiss");

            migrationBuilder.RenameTable(
                name: "GameKiss",
                newName: "GameKisses");

            migrationBuilder.RenameIndex(
                name: "IX_GameKiss_RoundId_SenderUserId_IdempotencyKey",
                table: "GameKisses",
                newName: "IX_GameKisses_RoundId_SenderUserId_IdempotencyKey");

            migrationBuilder.RenameIndex(
                name: "IX_GameKiss_RoomId_SenderUserId_RecipientUserId",
                table: "GameKisses",
                newName: "IX_GameKisses_RoomId_SenderUserId_RecipientUserId");

            migrationBuilder.AddColumn<string>(
                name: "SummaryCommentary",
                table: "GameRounds",
                type: "text",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_GameKisses",
                table: "GameKisses",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "UserGameSettings",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AiConsent = table.Column<bool>(type: "boolean", nullable: false),
                    AiConsentGivenAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserGameSettings", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_UserGameSettings_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddForeignKey(
                name: "FK_GameKisses_GameRooms_RoomId",
                table: "GameKisses",
                column: "RoomId",
                principalTable: "GameRooms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GameKisses_GameRounds_RoundId",
                table: "GameKisses",
                column: "RoundId",
                principalTable: "GameRounds",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GameKisses_GameRooms_RoomId",
                table: "GameKisses");

            migrationBuilder.DropForeignKey(
                name: "FK_GameKisses_GameRounds_RoundId",
                table: "GameKisses");

            migrationBuilder.DropTable(
                name: "UserGameSettings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_GameKisses",
                table: "GameKisses");

            migrationBuilder.DropColumn(
                name: "SummaryCommentary",
                table: "GameRounds");

            migrationBuilder.RenameTable(
                name: "GameKisses",
                newName: "GameKiss");

            migrationBuilder.RenameIndex(
                name: "IX_GameKisses_RoundId_SenderUserId_IdempotencyKey",
                table: "GameKiss",
                newName: "IX_GameKiss_RoundId_SenderUserId_IdempotencyKey");

            migrationBuilder.RenameIndex(
                name: "IX_GameKisses_RoomId_SenderUserId_RecipientUserId",
                table: "GameKiss",
                newName: "IX_GameKiss_RoomId_SenderUserId_RecipientUserId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_GameKiss",
                table: "GameKiss",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_GameKiss_GameRooms_RoomId",
                table: "GameKiss",
                column: "RoomId",
                principalTable: "GameRooms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GameKiss_GameRounds_RoundId",
                table: "GameKiss",
                column: "RoundId",
                principalTable: "GameRounds",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
