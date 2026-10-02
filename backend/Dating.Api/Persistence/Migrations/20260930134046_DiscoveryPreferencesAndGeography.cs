using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DiscoveryPreferencesAndGeography : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CityKey",
                table: "DatingProfile",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "DiscoverySequence",
                table: "DatingProfile",
                type: "bigint",
                nullable: false,
                defaultValue: 0L)
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AddColumn<Point>(
                name: "Location",
                table: "DatingProfile",
                type: "geography (point, 4326)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LocationMode",
                table: "DatingProfile",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "MaxAge",
                table: "DatingProfile",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MinAge",
                table: "DatingProfile",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RadiusKm",
                table: "DatingProfile",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "DiscoveryDecision",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DiscoveryDecision", x => new { x.UserId, x.TargetId });
                });

            migrationBuilder.CreateTable(
                name: "UnmatchedPair",
                columns: table => new
                {
                    FirstId = table.Column<Guid>(type: "uuid", nullable: false),
                    SecondId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnmatchedPair", x => new { x.FirstId, x.SecondId });
                });

            migrationBuilder.CreateIndex(
                name: "IX_DatingProfile_CityKey",
                table: "DatingProfile",
                column: "CityKey");

            migrationBuilder.CreateIndex(
                name: "IX_DatingProfile_DiscoverySequence",
                table: "DatingProfile",
                column: "DiscoverySequence",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DatingProfile_Location",
                table: "DatingProfile",
                column: "Location")
                .Annotation("Npgsql:IndexMethod", "gist");
            migrationBuilder.Sql("""UPDATE "DatingProfile" SET "MinAge" = 18, "MaxAge" = 99, "RadiusKm" = 25, "LocationMode" = 'city', "CityKey" = upper(normalize(regexp_replace(btrim("City"), '[[:space:]]+', ' ', 'g'), NFKC))""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DiscoveryDecision");

            migrationBuilder.DropTable(
                name: "UnmatchedPair");

            migrationBuilder.DropIndex(
                name: "IX_DatingProfile_CityKey",
                table: "DatingProfile");

            migrationBuilder.DropIndex(
                name: "IX_DatingProfile_DiscoverySequence",
                table: "DatingProfile");

            migrationBuilder.DropIndex(
                name: "IX_DatingProfile_Location",
                table: "DatingProfile");

            migrationBuilder.DropColumn(
                name: "CityKey",
                table: "DatingProfile");

            migrationBuilder.DropColumn(
                name: "DiscoverySequence",
                table: "DatingProfile");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "DatingProfile");

            migrationBuilder.DropColumn(
                name: "LocationMode",
                table: "DatingProfile");

            migrationBuilder.DropColumn(
                name: "MaxAge",
                table: "DatingProfile");

            migrationBuilder.DropColumn(
                name: "MinAge",
                table: "DatingProfile");

            migrationBuilder.DropColumn(
                name: "RadiusKm",
                table: "DatingProfile");
        }
    }
}
