using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dating.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PersistedPushNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PushDevice",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SecretHash = table.Column<string>(type: "text", nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    Ciphertext = table.Column<string>(type: "text", nullable: false),
                    KeyId = table.Column<string>(type: "text", nullable: false),
                    Platform = table.Column<string>(type: "text", nullable: false),
                    ProjectId = table.Column<string>(type: "text", nullable: false),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    BindingRevision = table.Column<int>(type: "integer", nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PushDevice", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PushDevice_Sessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "Sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PushPreference",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Matches = table.Column<bool>(type: "boolean", nullable: false),
                    Messages = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PushPreference", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_PushPreference_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PushDelivery",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceRevision = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    NextAttemptAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    FinishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    DeadLetterAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    ReceiptId = table.Column<string>(type: "text", nullable: true),
                    LastCode = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PushDelivery", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PushDelivery_Conversation_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "Conversation",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PushDelivery_PushDevice_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "PushDevice",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PushDelivery_ConversationId",
                table: "PushDelivery",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_PushDelivery_DeviceId",
                table: "PushDelivery",
                column: "DeviceId");

            migrationBuilder.CreateIndex(
                name: "IX_PushDelivery_EventId_Kind_DeviceId_DeviceRevision",
                table: "PushDelivery",
                columns: new[] { "EventId", "Kind", "DeviceId", "DeviceRevision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PushDelivery_NextAttemptAt",
                table: "PushDelivery",
                column: "NextAttemptAt",
                filter: "\"FinishedAt\" IS NULL AND \"DeadLetterAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PushDevice_SessionId",
                table: "PushDevice",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_PushDevice_TokenHash",
                table: "PushDevice",
                column: "TokenHash",
                unique: true,
                filter: "\"TokenHash\" <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_PushDevice_UserId",
                table: "PushDevice",
                column: "UserId");
            migrationBuilder.Sql("""CREATE VIEW "PushDeadLetters" AS SELECT "Id","Kind","CreatedAt","Attempts","LastCode","DeadLetterAt" FROM "PushDelivery" WHERE "DeadLetterAt" IS NOT NULL""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP VIEW "PushDeadLetters" """);
            migrationBuilder.DropTable(
                name: "PushDelivery");

            migrationBuilder.DropTable(
                name: "PushPreference");

            migrationBuilder.DropTable(
                name: "PushDevice");
        }
    }
}
