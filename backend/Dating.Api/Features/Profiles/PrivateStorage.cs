using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
namespace Dating.Api.Features.Profiles;
public sealed class MediaOptions
{
    public string Mode { get; set; } = "";
    public string LocalPath { get; set; } = "";
    public bool AutoApprove { get; set; }
    public string Endpoint { get; set; } = "";
    public string Region { get; set; } = "";
    public string Bucket { get; set; } = "";
    public string AccessKey { get; set; } = "";
    public string SecretKey { get; set; } = "";
}
public interface IPrivateStorage
{
    Task Put(string key, byte[] bytes, CancellationToken ct);
    Task<byte[]> Get(string key, CancellationToken ct);
    Task Delete(string key, CancellationToken ct);
}
public sealed class LocalPrivateStorage(IOptions<MediaOptions> options) : IPrivateStorage
{
    private string PathFor(string key)
    {
        if (key.Length != 36 || !Guid.TryParseExact(key[..32], "N", out _) || !key.EndsWith(".jpg", StringComparison.Ordinal))
            throw new InvalidOperationException("Invalid private object key.");
        return Path.Combine(Path.GetFullPath(options.Value.LocalPath), key);
    }
    public async Task Put(string key, byte[] bytes, CancellationToken ct)
    { Directory.CreateDirectory(options.Value.LocalPath); await File.WriteAllBytesAsync(PathFor(key), bytes, ct); }
    public Task<byte[]> Get(string key, CancellationToken ct) => File.ReadAllBytesAsync(PathFor(key), ct);
    public Task Delete(string key, CancellationToken ct) { File.Delete(PathFor(key)); return Task.CompletedTask; }
}
public sealed class S3PrivateStorage : IPrivateStorage, IDisposable
{
    private readonly AmazonS3Client client;
    private readonly string bucket;
    public S3PrivateStorage(IOptions<MediaOptions> options)
    {
        var o = options.Value; bucket = o.Bucket;
        client = new AmazonS3Client(new BasicAWSCredentials(o.AccessKey, o.SecretKey),
            new AmazonS3Config { ServiceURL = o.Endpoint, AuthenticationRegion = o.Region, ForcePathStyle = true });
    }
    public async Task Put(string key, byte[] bytes, CancellationToken ct)
    {
        using var stream = new MemoryStream(bytes, false);
        await client.PutObjectAsync(new PutObjectRequest { BucketName = bucket, Key = key, InputStream = stream,
            ContentType = "image/jpeg", AutoCloseStream = false }, ct);
    }
    public async Task<byte[]> Get(string key, CancellationToken ct)
    {
        using var response = await client.GetObjectAsync(bucket, key, ct);
        using var output = new MemoryStream();
        await response.ResponseStream.CopyToAsync(output, ct);
        return output.ToArray();
    }
    public async Task Delete(string key, CancellationToken ct) => await client.DeleteObjectAsync(bucket, key, ct);
    public void Dispose() => client.Dispose();
}
public sealed class MediaValidator(IHostEnvironment env) : IValidateOptions<MediaOptions>
{
    public ValidateOptionsResult Validate(string? name, MediaOptions o)
    {
        var local = (env.IsDevelopment() || env.IsEnvironment("Testing")) && o.Mode == "Local" && Path.IsPathFullyQualified(o.LocalPath);
        var remote = o.Mode == "S3" && Uri.TryCreate(o.Endpoint, UriKind.Absolute, out var uri) && uri.Scheme == "https" &&
            !string.IsNullOrWhiteSpace(o.Region) && !string.IsNullOrWhiteSpace(o.Bucket) &&
            !string.IsNullOrWhiteSpace(o.AccessKey) && !string.IsNullOrWhiteSpace(o.SecretKey);
        return (local || remote) && (!o.AutoApprove || env.IsDevelopment())
            ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail("Configure private media storage. Local storage and auto approval are development only; production requires HTTPS S3 settings.");
    }
}
