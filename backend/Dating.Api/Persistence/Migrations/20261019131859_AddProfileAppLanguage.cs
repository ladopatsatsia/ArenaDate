using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileAppLanguage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AppLanguage",
                table: "DatingProfile",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "ka");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AppLanguage",
                table: "DatingProfile");
        }
    }
}
