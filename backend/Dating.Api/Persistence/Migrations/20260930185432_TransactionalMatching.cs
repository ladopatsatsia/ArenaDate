using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TransactionalMatching : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE FUNCTION prevent_decision_update() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN RAISE EXCEPTION 'Decisions are immutable' USING ERRCODE = '23514'; END $$;
                CREATE TRIGGER immutable_decision BEFORE UPDATE ON "DiscoveryDecision"
                FOR EACH ROW EXECUTE FUNCTION prevent_decision_update();
                """);
            migrationBuilder.CreateTable(
                name: "DatingMatch",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FirstId = table.Column<Guid>(type: "uuid", nullable: false),
                    SecondId = table.Column<Guid>(type: "uuid", nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DatingMatch", x => x.Id);
                    table.CheckConstraint("CK_Match_Ordered", "\"FirstId\" < \"SecondId\"");
                    table.ForeignKey(
                        name: "FK_DatingMatch_AspNetUsers_FirstId",
                        column: x => x.FirstId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DatingMatch_AspNetUsers_SecondId",
                        column: x => x.SecondId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Conversation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MatchId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Conversation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Conversation_DatingMatch_MatchId",
                        column: x => x.MatchId,
                        principalTable: "DatingMatch",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MatchEvent",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MatchId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ProcessedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MatchEvent", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MatchEvent_DatingMatch_MatchId",
                        column: x => x.MatchId,
                        principalTable: "DatingMatch",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SwipeReceipt",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    MatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SwipeReceipt", x => new { x.UserId, x.RequestId });
                    table.ForeignKey(
                        name: "FK_SwipeReceipt_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SwipeReceipt_DatingMatch_MatchId",
                        column: x => x.MatchId,
                        principalTable: "DatingMatch",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MatchNotice",
                columns: table => new
                {
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    MatchId = table.Column<Guid>(type: "uuid", nullable: false),
                    SeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MatchNotice", x => new { x.EventId, x.UserId });
                    table.ForeignKey(
                        name: "FK_MatchNotice_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MatchNotice_DatingMatch_MatchId",
                        column: x => x.MatchId,
                        principalTable: "DatingMatch",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MatchNotice_MatchEvent_EventId",
                        column: x => x.EventId,
                        principalTable: "MatchEvent",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Decision_Kind",
                table: "DiscoveryDecision",
                sql: "\"Kind\" IN ('like','pass')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Decision_Self",
                table: "DiscoveryDecision",
                sql: "\"UserId\" <> \"TargetId\"");

            migrationBuilder.CreateIndex(
                name: "IX_Conversation_MatchId",
                table: "Conversation",
                column: "MatchId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DatingMatch_FirstId_SecondId",
                table: "DatingMatch",
                columns: new[] { "FirstId", "SecondId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DatingMatch_SecondId",
                table: "DatingMatch",
                column: "SecondId");

            migrationBuilder.CreateIndex(
                name: "IX_MatchEvent_CreatedAt",
                table: "MatchEvent",
                column: "CreatedAt",
                filter: "\"ProcessedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_MatchEvent_MatchId",
                table: "MatchEvent",
                column: "MatchId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MatchNotice_MatchId",
                table: "MatchNotice",
                column: "MatchId");

            migrationBuilder.CreateIndex(
                name: "IX_MatchNotice_UserId",
                table: "MatchNotice",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SwipeReceipt_MatchId",
                table: "SwipeReceipt",
                column: "MatchId");

            migrationBuilder.CreateIndex(
                name: "IX_SwipeReceipt_UserId_TargetId",
                table: "SwipeReceipt",
                columns: new[] { "UserId", "TargetId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER immutable_decision ON \"DiscoveryDecision\"; DROP FUNCTION prevent_decision_update();");
            migrationBuilder.DropTable(
                name: "Conversation");

            migrationBuilder.DropTable(
                name: "MatchNotice");

            migrationBuilder.DropTable(
                name: "SwipeReceipt");

            migrationBuilder.DropTable(
                name: "MatchEvent");

            migrationBuilder.DropTable(
                name: "DatingMatch");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Decision_Kind",
                table: "DiscoveryDecision");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Decision_Self",
                table: "DiscoveryDecision");
        }
    }
}
