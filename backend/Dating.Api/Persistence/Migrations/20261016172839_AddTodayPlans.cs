using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTodayPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TodayPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    City = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    District = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Activity = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Title = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    StartsAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    BudgetAmount = table.Column<decimal>(type: "numeric", nullable: true),
                    Currency = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false, defaultValue: "GEL"),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Open"),
                    SelectedCompanionUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    MatchedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CancelledAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TodayPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TodayPlans_AspNetUsers_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TodayPlans_AspNetUsers_SelectedCompanionUserId",
                        column: x => x.SelectedCompanionUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "TodayPlanResponses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicantUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Message = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Pending"),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RespondedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    WithdrawnAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TodayPlanResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TodayPlanResponses_AspNetUsers_ApplicantUserId",
                        column: x => x.ApplicantUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TodayPlanResponses_TodayPlans_PlanId",
                        column: x => x.PlanId,
                        principalTable: "TodayPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TodayPlanResponses_ApplicantUserId_CreatedAtUtc",
                table: "TodayPlanResponses",
                columns: new[] { "ApplicantUserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_TodayPlanResponses_PlanId_ApplicantUserId",
                table: "TodayPlanResponses",
                columns: new[] { "PlanId", "ApplicantUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TodayPlanResponses_PlanId_State",
                table: "TodayPlanResponses",
                columns: new[] { "PlanId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_TodayPlans_AuthorUserId_State",
                table: "TodayPlans",
                columns: new[] { "AuthorUserId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_TodayPlans_City_Activity_State_ExpiresAtUtc",
                table: "TodayPlans",
                columns: new[] { "City", "Activity", "State", "ExpiresAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_TodayPlans_SelectedCompanionUserId",
                table: "TodayPlans",
                column: "SelectedCompanionUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TodayPlans_StartsAtUtc",
                table: "TodayPlans",
                column: "StartsAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_TodayPlans_State_ExpiresAtUtc",
                table: "TodayPlans",
                columns: new[] { "State", "ExpiresAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TodayPlanResponses");

            migrationBuilder.DropTable(
                name: "TodayPlans");
        }
    }
}
