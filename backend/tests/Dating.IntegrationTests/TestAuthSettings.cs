using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
namespace Dating.IntegrationTests;
internal static class TestAuthSettings
{
    public static readonly string Key = RSA.Create(2048).ExportPkcs8PrivateKeyPem();
    public static readonly string DirectoryPath = Path.Combine(Path.GetTempPath(), "dating-auth-tests-" + Guid.NewGuid().ToString("N"));
    public static readonly string CertificatePath = CreateCertificate();
    private static string CreateCertificate()
    {
        Directory.CreateDirectory(DirectoryPath);
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest("CN=DatingTests", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var cert = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));
        var path = Path.Combine(DirectoryPath, "test.pfx");
        File.WriteAllBytes(path, cert.Export(X509ContentType.Pfx));
        return path;
    }
    public static Dictionary<string, string?> Configuration(string connection, bool production = false) => new()
    {
        ["ConnectionStrings:Database"] = connection,
        ["Media:Mode"] = production ? "S3" : "Local",
        ["Media:LocalPath"] = Path.Combine(DirectoryPath, "media"),
        ["Media:Endpoint"] = "https://storage.example.test", ["Media:Region"] = "test",
        ["Media:Bucket"] = "private-test", ["Media:AccessKey"] = "test", ["Media:SecretKey"] = "test",
        ["Auth:SigningKeyPem"] = Key,
        ["Auth:KeyRingPath"] = Path.Combine(DirectoryPath, production ? "production" : "development"),
        ["Auth:KeyCertificatePath"] = CertificatePath,
        ["Email:Mode"] = production ? "Smtp" : "Capture", ["Email:Host"] = "127.0.0.1",
        ["Email:Port"] = "1025", ["Email:Sender"] = "tests@dating.local",
        ["Email:Username"] = "test-only", ["Email:Password"] = "test-only"
    };
}
