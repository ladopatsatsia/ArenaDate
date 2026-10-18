using Dating.Api.Features.Auth;
using Dating.Api.Features.Premium;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Dating.UnitTests;

public class TelegramPaymentTests
{
    [Fact]
    public void Catalogues_Contain_Expected_Products_And_Stars()
    {
        Assert.True(TelegramPaymentService.SubscriptionPackages.ContainsKey("two_weeks"));
        Assert.Equal(50, TelegramPaymentService.SubscriptionPackages["two_weeks"].Stars);

        Assert.True(TelegramPaymentService.SubscriptionPackages.ContainsKey("one_month"));
        Assert.Equal(90, TelegramPaymentService.SubscriptionPackages["one_month"].Stars);

        Assert.True(TelegramPaymentService.SubscriptionPackages.ContainsKey("three_months"));
        Assert.Equal(180, TelegramPaymentService.SubscriptionPackages["three_months"].Stars);

        Assert.True(TelegramPaymentService.SubscriptionPackages.ContainsKey("lifetime"));
        Assert.Equal(750, TelegramPaymentService.SubscriptionPackages["lifetime"].Stars);

        Assert.True(TelegramPaymentService.CrystalPackages.ContainsKey("dating.crystals.100"));
        Assert.Equal(25, TelegramPaymentService.CrystalPackages["dating.crystals.100"].Stars);
        Assert.Equal(100, TelegramPaymentService.CrystalPackages["dating.crystals.100"].CrystalAmount);

        Assert.True(TelegramPaymentService.CrystalPackages.ContainsKey("dating.crystals.500"));
        Assert.Equal(100, TelegramPaymentService.CrystalPackages["dating.crystals.500"].Stars);

        Assert.True(TelegramPaymentService.CrystalPackages.ContainsKey("dating.crystals.1200"));
        Assert.Equal(200, TelegramPaymentService.CrystalPackages["dating.crystals.1200"].Stars);
    }

    [Fact]
    public async Task CreateInvoice_Generates_Mock_Link_When_Dev_BotToken()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Telegram:BotToken"] = "dev_bot_token"
        }).Build();

        var service = new TelegramPaymentService(
            new HttpClient(),
            config,
            null!,
            null!,
            null!,
            NullLogger<TelegramPaymentService>.Instance
        );

        var userId = Guid.NewGuid();
        var res = await service.CreateInvoiceLinkAsync(userId, new TelegramStarsInvoiceRequest("subscription", "one_month"), CancellationToken.None);

        Assert.NotNull(res.InvoiceLink);
        Assert.StartsWith("https://t.me/$dev_invoice_subscription_one_month_", res.InvoiceLink);
        Assert.Equal(90, res.StarsAmount);
        Assert.Equal("subscription", res.ItemType);
        Assert.Equal("one_month", res.ItemId);
        Assert.Contains(userId.ToString("N"), res.Payload);
    }

    [Fact]
    public async Task CreateInvoice_Throws_On_Invalid_Item_Or_Package()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var service = new TelegramPaymentService(
            new HttpClient(),
            config,
            null!,
            null!,
            null!,
            NullLogger<TelegramPaymentService>.Instance
        );

        await Assert.ThrowsAsync<AuthFailure>(() =>
            service.CreateInvoiceLinkAsync(Guid.NewGuid(), new TelegramStarsInvoiceRequest("unknown_type", "one_month"), CancellationToken.None));

        await Assert.ThrowsAsync<AuthFailure>(() =>
            service.CreateInvoiceLinkAsync(Guid.NewGuid(), new TelegramStarsInvoiceRequest("subscription", "non_existing_pkg"), CancellationToken.None));
    }

    [Fact]
    public async Task VerifyPayment_Rejects_Mismatched_User_Payload()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var service = new TelegramPaymentService(
            new HttpClient(),
            config,
            null!,
            null!,
            null!,
            NullLogger<TelegramPaymentService>.Instance
        );

        var victimUserId = Guid.NewGuid();
        var attackerUserId = Guid.NewGuid();
        var payload = $"subscription:one_month:{victimUserId:N}:nonce123";

        var ex = await Assert.ThrowsAsync<AuthFailure>(() =>
            service.VerifyPaymentAsync(attackerUserId, new TelegramStarsVerifyRequest(payload), CancellationToken.None));

        Assert.Equal(403, ex.Status);
        Assert.Equal("unauthorized_payload_user", ex.Code);
    }

    [Fact]
    public void Webhook_Deserializes_Telegram_SnakeCase_Payloads()
    {
        var json = """
        {
          "update_id": 999999,
          "pre_checkout_query": {
            "id": "query_123",
            "from": {
              "id": 111,
              "is_bot": false,
              "first_name": "TestUser"
            },
            "currency": "XTR",
            "total_amount": 25,
            "invoice_payload": "crystals:dating.crystals.100:00000000000000000000000000000000:nonce"
          }
        }
        """;

        var update = System.Text.Json.JsonSerializer.Deserialize<TelegramUpdate>(json);
        Assert.NotNull(update);
        Assert.Equal(999999, update.UpdateId);
        Assert.NotNull(update.PreCheckoutQuery);
        Assert.Equal("query_123", update.PreCheckoutQuery.Id);
        Assert.Equal("XTR", update.PreCheckoutQuery.Currency);
        Assert.Equal(25, update.PreCheckoutQuery.TotalAmount);
        Assert.Equal("crystals:dating.crystals.100:00000000000000000000000000000000:nonce", update.PreCheckoutQuery.InvoicePayload);
        Assert.NotNull(update.PreCheckoutQuery.From);
        Assert.Equal("TestUser", update.PreCheckoutQuery.From.FirstName);
    }
}
