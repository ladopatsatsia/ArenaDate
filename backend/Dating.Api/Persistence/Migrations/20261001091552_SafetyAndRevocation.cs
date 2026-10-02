using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SafetyAndRevocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "ChatEvent",
                type: "text",
                nullable: false,
                defaultValue: "changed");

            migrationBuilder.CreateTable(
                name: "SafetyReceipt",
                columns: table => new
                {
                    ActorId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    Fingerprint = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SafetyReceipt", x => new { x.ActorId, x.RequestId });
                });

            migrationBuilder.CreateTable(
                name: "SafetyReport",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReporterId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: false),
                    ProtectedEvidence = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DeleteAfter = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SafetyReport", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SafetyReceipt_CreatedAt",
                table: "SafetyReceipt",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SafetyReport_DeleteAfter",
                table: "SafetyReport",
                column: "DeleteAfter");

            migrationBuilder.CreateIndex(
                name: "IX_SafetyReport_ReporterId_CreatedAt",
                table: "SafetyReport",
                columns: new[] { "ReporterId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SafetyReceipt");

            migrationBuilder.DropTable(
                name: "SafetyReport");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "ChatEvent");
        }
    }
}
