using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UserProfileViews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserProfileViews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ViewerUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ViewedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserProfileViews", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserProfileViews_TargetUserId_ViewedAt",
                table: "UserProfileViews",
                columns: new[] { "TargetUserId", "ViewedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserProfileViews_ViewerUserId_TargetUserId",
                table: "UserProfileViews",
                columns: new[] { "ViewerUserId", "TargetUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserProfileViews_ViewerUserId_ViewedAt",
                table: "UserProfileViews",
                columns: new[] { "ViewerUserId", "ViewedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserProfileViews");
        }
    }
}
