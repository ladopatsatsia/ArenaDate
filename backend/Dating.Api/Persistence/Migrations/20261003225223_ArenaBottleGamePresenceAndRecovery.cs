using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ArenaBottleGamePresenceAndRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GameMemberships_UserId",
                table: "GameMemberships");

            migrationBuilder.AddColumn<string>(
                name: "DeadlineType",
                table: "GameRooms",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeadlineUtc",
                table: "GameRooms",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DisconnectPauseBudgetMs",
                table: "GameRooms",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsPaused",
                table: "GameRooms",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "MinActivePlayers",
                table: "GameRooms",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RemainingDeadlineMs",
                table: "GameRooms",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "Sequence",
                table: "GameRooms",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "StateVersion",
                table: "GameRooms",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DisconnectedAtUtc",
                table: "GameMemberships",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "LastHeartbeatUtc",
                table: "GameMemberships",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ReservationExpiresAtUtc",
                table: "GameMemberships",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GameOutboxEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoomId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sequence = table.Column<long>(type: "bigint", nullable: false),
                    StateVersion = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PayloadJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DispatchedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameOutboxEvents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GameMemberships_UserId",
                table: "GameMemberships",
                column: "UserId",
                unique: true,
                filter: "\"Status\" IN ('Active', 'Disconnected')");

            migrationBuilder.CreateIndex(
                name: "IX_GameOutboxEvents_DispatchedAtUtc",
                table: "GameOutboxEvents",
                column: "DispatchedAtUtc",
                filter: "\"DispatchedAtUtc\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_GameOutboxEvents_RoomId_Sequence",
                table: "GameOutboxEvents",
                columns: new[] { "RoomId", "Sequence" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GameOutboxEvents");

            migrationBuilder.DropIndex(
                name: "IX_GameMemberships_UserId",
                table: "GameMemberships");

            migrationBuilder.DropColumn(
                name: "DeadlineType",
                table: "GameRooms");

            migrationBuilder.DropColumn(
                name: "DeadlineUtc",
                table: "GameRooms");

            migrationBuilder.DropColumn(
                name: "DisconnectPauseBudgetMs",
                table: "GameRooms");

            migrationBuilder.DropColumn(
                name: "IsPaused",
                table: "GameRooms");

            migrationBuilder.DropColumn(
                name: "MinActivePlayers",
                table: "GameRooms");

            migrationBuilder.DropColumn(
                name: "RemainingDeadlineMs",
                table: "GameRooms");

            migrationBuilder.DropColumn(
                name: "Sequence",
                table: "GameRooms");

            migrationBuilder.DropColumn(
                name: "StateVersion",
                table: "GameRooms");

            migrationBuilder.DropColumn(
                name: "DisconnectedAtUtc",
                table: "GameMemberships");

            migrationBuilder.DropColumn(
                name: "LastHeartbeatUtc",
                table: "GameMemberships");

            migrationBuilder.DropColumn(
                name: "ReservationExpiresAtUtc",
                table: "GameMemberships");

            migrationBuilder.CreateIndex(
                name: "IX_GameMemberships_UserId",
                table: "GameMemberships",
                column: "UserId",
                unique: true,
                filter: "\"Status\" = 'Active'");
        }
    }
}
