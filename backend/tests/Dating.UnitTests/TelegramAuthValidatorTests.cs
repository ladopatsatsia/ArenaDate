using System.Security.Cryptography;
using System.Text;
using Dating.Api.Features.Auth;
using Xunit;

namespace Dating.UnitTests;

public class TelegramAuthValidatorTests
{
    private const string TestBotToken = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz";

    private static string CreateSignedInitData(string botToken, string userJson, long authDate)
    {
        var dataPairs = new List<string>
        {
            $"auth_date={authDate}",
            $"query_id=AAHdF6IQAAAAAN0XohDhrOrc",
            $"user={userJson}"
        };
        dataPairs.Sort(StringComparer.Ordinal);
        var dataCheckString = string.Join("\n", dataPairs);

        using var hmacSecret = new HMACSHA256(Encoding.UTF8.GetBytes("WebAppData"));
        var secretKey = hmacSecret.ComputeHash(Encoding.UTF8.GetBytes(botToken));

        using var hmacData = new HMACSHA256(secretKey);
        var hashBytes = hmacData.ComputeHash(Encoding.UTF8.GetBytes(dataCheckString));
        var hashHex = Convert.ToHexString(hashBytes).ToLowerInvariant();

        return $"query_id=AAHdF6IQAAAAAN0XohDhrOrc&user={Uri.EscapeDataString(userJson)}&auth_date={authDate}&hash={hashHex}";
    }

    [Fact]
    public void Valid_InitData_Validates_And_Extracts_User()
    {
        var userJson = """{"id":987654321,"first_name":"Lado","last_name":"Beridze","username":"lado_b","language_code":"ka"}""";
        var initData = CreateSignedInitData(TestBotToken, userJson, 1712345678);

        var ok = TelegramAuthValidator.TryValidate(initData, TestBotToken, out var user);

        Assert.True(ok);
        Assert.NotNull(user);
        Assert.Equal(987654321, user.Id);
        Assert.Equal("Lado", user.FirstName);
        Assert.Equal("Beridze", user.LastName);
        Assert.Equal("lado_b", user.Username);
        Assert.Equal("ka", user.LanguageCode);
    }

    [Fact]
    public void Tampered_Hash_Fails_Validation()
    {
        var userJson = """{"id":987654321,"first_name":"Lado"}""";
        var initData = CreateSignedInitData(TestBotToken, userJson, 1712345678);
        var tampered = initData.Replace("hash=", "hash=deadbeef");

        var ok = TelegramAuthValidator.TryValidate(tampered, TestBotToken, out var user);

        Assert.False(ok);
        Assert.Null(user);
    }

    [Fact]
    public void Tampered_Data_Fails_Validation()
    {
        var userJson = """{"id":987654321,"first_name":"Lado"}""";
        var initData = CreateSignedInitData(TestBotToken, userJson, 1712345678);
        var tampered = initData.Replace("987654321", "111111111");

        var ok = TelegramAuthValidator.TryValidate(tampered, TestBotToken, out var user);

        Assert.False(ok);
        Assert.Null(user);
    }

    [Fact]
    public void Missing_User_Fails_Validation()
    {
        var initData = "query_id=abc&auth_date=123&hash=123456";
        var ok = TelegramAuthValidator.TryValidate(initData, TestBotToken, out var user);
        Assert.False(ok);
        Assert.Null(user);
    }
}
