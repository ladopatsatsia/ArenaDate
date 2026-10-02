using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MatchOutboxRetryPolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Attempts",
                table: "MatchEvent",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeadLetterAt",
                table: "MatchEvent",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastErrorCode",
                table: "MatchEvent",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "NextAttemptAt",
                table: "MatchEvent",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));
            migrationBuilder.Sql("""CREATE VIEW "MatchOutboxDeadLetters" AS SELECT "Id", "MatchId", "CreatedAt", "Attempts", "NextAttemptAt", "LastErrorCode" FROM "MatchEvent" WHERE "DeadLetterAt" IS NOT NULL""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP VIEW \"MatchOutboxDeadLetters\";");
            migrationBuilder.DropColumn(
                name: "Attempts",
                table: "MatchEvent");

            migrationBuilder.DropColumn(
                name: "DeadLetterAt",
                table: "MatchEvent");

            migrationBuilder.DropColumn(
                name: "LastErrorCode",
                table: "MatchEvent");

            migrationBuilder.DropColumn(
                name: "NextAttemptAt",
                table: "MatchEvent");
        }
    }
}
