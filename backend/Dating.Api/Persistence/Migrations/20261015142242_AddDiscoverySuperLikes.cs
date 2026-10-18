using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDiscoverySuperLikes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DiscoverySuperLikes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Note = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DiscoverySuperLikes", x => x.Id);
                    table.CheckConstraint("CK_DiscoverySuperLike_NotSelf", "\"SenderUserId\" <> \"TargetUserId\"");
                    table.ForeignKey(
                        name: "FK_DiscoverySuperLikes_AspNetUsers_SenderUserId",
                        column: x => x.SenderUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DiscoverySuperLikes_AspNetUsers_TargetUserId",
                        column: x => x.TargetUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DiscoverySuperLikes_SenderUserId_CreatedAtUtc",
                table: "DiscoverySuperLikes",
                columns: new[] { "SenderUserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_DiscoverySuperLikes_SenderUserId_TargetUserId",
                table: "DiscoverySuperLikes",
                columns: new[] { "SenderUserId", "TargetUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DiscoverySuperLikes_TargetUserId_CreatedAtUtc",
                table: "DiscoverySuperLikes",
                columns: new[] { "TargetUserId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DiscoverySuperLikes");
        }
    }
}
