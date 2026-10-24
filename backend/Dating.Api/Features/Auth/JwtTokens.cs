using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.WebUtilities;

namespace Dating.Api.Features.Auth;
public sealed class AuthOptions
{
    public string Issuer { get; set; } = "DatingMVP";
    public string Audience { get; set; } = "DatingMVP.Mobile";
    public string SigningKeyPem { get; set; } = "";
    public string KeyRingPath { get; set; } = "";
    public string KeyCertificatePath { get; set; } = "";
    public string KeyCertificatePassword { get; set; } = "";
}
public sealed class JwtTokens : IDisposable
{
    private readonly RSA rsa;
    private readonly AuthOptions options;
    public RsaSecurityKey Key { get; }
    public JwtTokens(IOptions<AuthOptions> settings)
    {
        options = settings.Value;
        var pem = (options.SigningKeyPem ?? "").Replace("\\n", "\n").Trim();
        RSA tempRsa = RSA.Create();
        bool success = false;
        if (!string.IsNullOrWhiteSpace(pem))
        {
            try
            {
                tempRsa.ImportFromPem(pem);
                if (tempRsa.KeySize >= 2048 && tempRsa.ExportParameters(true).D is not null)
                {
                    success = true;
                }
            }
            catch
            {
                success = false;
            }
        }
        if (!success)
        {
            tempRsa.Dispose();
            var keyRingDir = !string.IsNullOrWhiteSpace(options.KeyRingPath) && Directory.Exists(options.KeyRingPath)
                ? options.KeyRingPath
                : AppContext.BaseDirectory;
            var persistedKeyPath = Path.Combine(keyRingDir, "jwt_signing_key.pem");
            if (File.Exists(persistedKeyPath))
            {
                try
                {
                    var filePem = File.ReadAllText(persistedKeyPath);
                    tempRsa = RSA.Create();
                    tempRsa.ImportFromPem(filePem);
                    if (tempRsa.KeySize >= 2048 && tempRsa.ExportParameters(true).D is not null)
                    {
                        success = true;
                    }
                }
                catch
                {
                    tempRsa.Dispose();
                    success = false;
                }
            }

            if (!success)
            {
                tempRsa = RSA.Create(2048);
                try
                {
                    var exported = tempRsa.ExportPkcs8PrivateKeyPem();
                    File.WriteAllText(persistedKeyPath, exported);
                }
                catch { }
            }
        }
        rsa = tempRsa;
        Key = new RsaSecurityKey(rsa) { CryptoProviderFactory = new CryptoProviderFactory { CacheSignatureProviders = false } };
    }
    public TokenResponse Issue(AppUser user, AuthSession session, string refresh, DateTimeOffset now)
    {
        var expires = now.AddMinutes(5);
        var token = new JwtSecurityToken(options.Issuer, options.Audience,
            [new Claim("sub", user.Id.ToString()), new Claim("sid", session.Id.ToString()),
             new Claim("jti", Guid.NewGuid().ToString()), new Claim("iat", now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)],
            now.UtcDateTime, expires.UtcDateTime, new SigningCredentials(Key, SecurityAlgorithms.RsaSha256));
        return new(new JwtSecurityTokenHandler().WriteToken(token), expires, refresh, session.ExpiresAt, new(user.Id));
    }
    public static string NewRefresh() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(48));
    public static string Hash(string token) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));
    public void Dispose() => rsa.Dispose();
}
