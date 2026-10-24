using Dating.Api.Features.Auth;
using Dating.Api.Features.Notifications;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Dating.UnitTests;

public class TelegramNotificationTests
{
    [Fact]
    public void TelegramSubscriber_Defaults_To_Active()
    {
        var sub = new TelegramSubscriber
        {
            ChatId = 123456789,
            TelegramUserId = 123456789,
            FirstName = "Lado",
            Username = "lado_dev"
        };

        Assert.True(sub.IsActive);
        Assert.Equal(123456789, sub.ChatId);
        Assert.Equal("Lado", sub.FirstName);
        Assert.Equal("lado_dev", sub.Username);
    }

    [Fact]
    public async Task BroadcastAsync_Throws_On_Empty_Message()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Telegram:BotToken"] = "dev_bot_token"
        }).Build();

        var service = new TelegramNotificationService(
            (IServiceScopeFactory)null!,
            config,
            new HttpClient(),
            NullLogger<TelegramNotificationService>.Instance
        );

        await Assert.ThrowsAsync<AuthFailure>(() =>
            service.BroadcastAsync(new TelegramBroadcastRequest(""), CancellationToken.None));

        await Assert.ThrowsAsync<AuthFailure>(() =>
            service.BroadcastAsync(new TelegramBroadcastRequest("   "), CancellationToken.None));
    }

    [Fact]
    public async Task BroadcastAsync_Throws_On_Message_Exceeding_4000_Chars()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var service = new TelegramNotificationService(
            (IServiceScopeFactory)null!,
            config,
            new HttpClient(),
            NullLogger<TelegramNotificationService>.Instance
        );

        var longMsg = new string('A', 4001);
        await Assert.ThrowsAsync<AuthFailure>(() =>
            service.BroadcastAsync(new TelegramBroadcastRequest(longMsg), CancellationToken.None));
    }

    [Fact]
    public void TelegramStatsDto_Preserves_Values()
    {
        var now = DateTimeOffset.UtcNow;
        var stats = new TelegramStatsDto(
            TotalSubscribers: 150,
            ActiveSubscribers: 142,
            LinkedUsersCount: 88,
            LatestActivityUtc: now
        );

        Assert.Equal(150, stats.TotalSubscribers);
        Assert.Equal(142, stats.ActiveSubscribers);
        Assert.Equal(88, stats.LinkedUsersCount);
        Assert.Equal(now, stats.LatestActivityUtc);
    }

    [Fact]
    public void TelegramBroadcastResult_Calculates_Properly()
    {
        var now = DateTimeOffset.UtcNow;
        var result = new TelegramBroadcastResult(
            TotalSubscribers: 100,
            Targeted: 95,
            SuccessCount: 90,
            FailedCount: 3,
            BlockedCount: 2,
            CompletedAtUtc: now
        );

        Assert.Equal(100, result.TotalSubscribers);
        Assert.Equal(95, result.Targeted);
        Assert.Equal(90, result.SuccessCount);
        Assert.Equal(3, result.FailedCount);
        Assert.Equal(2, result.BlockedCount);
        Assert.Equal(now, result.CompletedAtUtc);
    }

    [Fact]
    public async Task SendToChatAsync_InDevMockMode_ReturnsTrue()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Telegram:BotToken"] = "dev_bot_token"
        }).Build();

        var service = new TelegramNotificationService(
            (IServiceScopeFactory)null!,
            config,
            new HttpClient(),
            NullLogger<TelegramNotificationService>.Instance
        );

        var result = await service.SendToChatAsync(12345678, "Hello World", "Open", "/messages", CancellationToken.None);
        Assert.True(result);
    }

    [Fact]
    public async Task SendToUserAsync_ReturnsFalse_WhenSubscriberNotFound()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Telegram:BotToken"] = "dev_bot_token"
        }).Build();

        // Testing that when DI scope factory is null or DB has no subscriber, it gracefully catches and returns false
        var service = new TelegramNotificationService(
            (IServiceScopeFactory)null!,
            config,
            new HttpClient(),
            NullLogger<TelegramNotificationService>.Instance
        );

        var result = await service.SendToUserAsync(Guid.NewGuid(), "Hello", null, null, CancellationToken.None);
        Assert.False(result);
    }

    [Fact]
    public void TelegramNotificationConfig_Defaults_AreValid()
    {
        var config = new TelegramNotificationConfig();

        Assert.Equal("default", config.Id);
        Assert.True(config.MasterEnabled);
        Assert.True(config.ChatMessageEnabled);
        Assert.Contains("{sender}", config.ChatMessageTemplate);
        Assert.Contains("{message}", config.ChatMessageTemplate);
        Assert.True(config.MatchRequestEnabled);
        Assert.Contains("{sender}", config.MatchRequestTemplate);
        Assert.True(config.MatchEnabled);
        Assert.Contains("{partner}", config.MatchTemplate);
        Assert.True(config.SuperLikeEnabled);
        Assert.Contains("{sender}", config.SuperLikeTemplate);
        Assert.Contains("{note}", config.SuperLikeTemplate);
        Assert.False(string.IsNullOrWhiteSpace(config.WelcomeTemplate));
    }

    [Fact]
    public async Task UpdateConfigAsync_ThrowsOnTooLongTemplate()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var service = new TelegramNotificationService(
            (IServiceScopeFactory)null!,
            config,
            new HttpClient(),
            NullLogger<TelegramNotificationService>.Instance
        );

        var tooLong = new string('X', 2001);
        var req = new UpdateTelegramNotificationConfigRequest(
            MasterEnabled: true,
            ChatMessageEnabled: true,
            ChatMessageTemplate: tooLong,
            ChatMessageButtonText: "btn",
            MatchRequestEnabled: true,
            MatchRequestTemplate: "valid",
            MatchRequestButtonText: "btn",
            MatchEnabled: true,
            MatchTemplate: "valid",
            MatchButtonText: "btn",
            SuperLikeEnabled: true,
            SuperLikeTemplate: "valid",
            SuperLikeButtonText: "btn",
            WelcomeTemplate: "valid",
            WelcomeButtonText: "btn"
        );

        await Assert.ThrowsAsync<AuthFailure>(() => service.UpdateConfigAsync(req, CancellationToken.None));
    }
}

