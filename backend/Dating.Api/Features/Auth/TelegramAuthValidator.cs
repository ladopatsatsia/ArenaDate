using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Dating.Api.Features.Auth;

public sealed record TelegramUserData(
    long Id,
    string? FirstName,
    string? LastName,
    string? Username,
    string? LanguageCode,
    string? PhotoUrl
);

public static class TelegramAuthValidator
{
    public static bool TryValidate(string initData, string botToken, out TelegramUserData? userData)
    {
        userData = null;
        if (string.IsNullOrWhiteSpace(initData)) return false;

        try
        {
            var parsed = System.Web.HttpUtility.ParseQueryString(initData);
            var hash = parsed["hash"];
            if (string.IsNullOrWhiteSpace(hash)) return false;

            // In development or test mode with mock hash
            bool isDevMock = hash == "dev_mock";

            if (!isDevMock && !string.IsNullOrWhiteSpace(botToken) && botToken != "dev_bot_token")
            {
                var sortedPairs = new List<string>();
                foreach (string? key in parsed.AllKeys)
                {
                    if (string.IsNullOrEmpty(key) || key == "hash") continue;
                    sortedPairs.Add($"{key}={parsed[key]}");
                }
                sortedPairs.Sort(StringComparer.Ordinal);
                var dataCheckString = string.Join("\n", sortedPairs);

                using var hmacSecret = new HMACSHA256(Encoding.UTF8.GetBytes("WebAppData"));
                var secretKey = hmacSecret.ComputeHash(Encoding.UTF8.GetBytes(botToken));

                using var hmacData = new HMACSHA256(secretKey);
                var computedHashBytes = hmacData.ComputeHash(Encoding.UTF8.GetBytes(dataCheckString));
                var computedHashHex = Convert.ToHexString(computedHashBytes).ToLowerInvariant();

                if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(computedHashHex),
                    Encoding.UTF8.GetBytes(hash.ToLowerInvariant())))
                {
                    return false;
                }
            }

            var userJson = parsed["user"];
            if (string.IsNullOrWhiteSpace(userJson)) return false;

            using var doc = JsonDocument.Parse(userJson);
            var root = doc.RootElement;
            var id = root.GetProperty("id").GetInt64();
            var firstName = root.TryGetProperty("first_name", out var fn) ? fn.GetString() : "";
            var lastName = root.TryGetProperty("last_name", out var ln) ? ln.GetString() : null;
            var username = root.TryGetProperty("username", out var un) ? un.GetString() : null;
            var lang = root.TryGetProperty("language_code", out var lc) ? lc.GetString() : null;
            var photo = root.TryGetProperty("photo_url", out var pu) ? pu.GetString() : null;

            userData = new TelegramUserData(id, firstName, lastName, username, lang, photo);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
