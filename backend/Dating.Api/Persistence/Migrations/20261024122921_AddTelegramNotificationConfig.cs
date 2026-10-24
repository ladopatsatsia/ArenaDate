using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTelegramNotificationConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TelegramNotificationConfigs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MasterEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ChatMessageEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ChatMessageTemplate = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ChatMessageButtonText = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MatchRequestEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    MatchRequestTemplate = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    MatchRequestButtonText = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MatchEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    MatchTemplate = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    MatchButtonText = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SuperLikeEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    SuperLikeTemplate = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    SuperLikeButtonText = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    WelcomeTemplate = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    WelcomeButtonText = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TelegramNotificationConfigs", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TelegramNotificationConfigs");
        }
    }
}
