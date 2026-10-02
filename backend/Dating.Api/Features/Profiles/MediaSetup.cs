using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace Dating.Api.Features.Profiles;
public static class MediaSetup
{
    public static IServiceCollection AddProfileMedia(this IServiceCollection services)
    {
        services.AddOptions<MediaOptions>().BindConfiguration("Media").ValidateOnStart();
        services.AddSingleton<IValidateOptions<MediaOptions>, MediaValidator>();
        services.AddSingleton<IPrivateStorage>(sp => sp.GetRequiredService<IOptions<MediaOptions>>().Value.Mode == "Local"
            ? new LocalPrivateStorage(sp.GetRequiredService<IOptions<MediaOptions>>())
            : new S3PrivateStorage(sp.GetRequiredService<IOptions<MediaOptions>>()));
        services.AddSingleton<PhotoProcessor>(); services.AddScoped<ProfileService>(); services.AddScoped<MediaAccess>();
        services.AddHostedService<MediaCleanup>();
        return services;
    }
}
public sealed class MediaCleanup(IServiceScopeFactory scopes, TimeProvider clock, ILogger<MediaCleanup> logs) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await Sweep(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception) { logs.LogWarning("Private media cleanup failed; retry scheduled. Object details redacted."); }
            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
    public async Task Sweep(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cutoff = clock.GetUtcNow().AddHours(-1);
        var ids = await db.Set<ProfilePhoto>().AsNoTracking().Where(p => !p.ObjectsDeleted && (p.Deleted || (p.State == "uploading" && p.CreatedAt < cutoff)))
            .OrderBy(p => p.CreatedAt).Take(20).Select(p => p.Id).ToListAsync(ct);
        foreach (var id in ids)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var owner = await db.Set<ProfilePhoto>().Where(p => p.Id == id).Select(p => p.UserId).SingleAsync(ct);
            await db.Users.FromSqlInterpolated($"SELECT * FROM \"AspNetUsers\" WHERE \"Id\" = {owner} FOR UPDATE").SingleAsync(ct);
            var photo = await db.Set<ProfilePhoto>().SingleAsync(p => p.Id == id, ct);
            if (photo.ObjectsDeleted || (!photo.Deleted && (photo.State != "uploading" || photo.CreatedAt >= cutoff))) continue;
            photo.Deleted = true;
            await db.SaveChangesAsync(ct);
            var service = scope.ServiceProvider.GetRequiredService<ProfileService>();
            var remaining = await db.Set<ProfilePhoto>().Where(p => p.UserId == owner && !p.Deleted).OrderBy(p => p.Position).ToListAsync(ct);
            await service.SetOrder(owner, remaining, ct);
            var profile = await db.Set<DatingProfile>().SingleAsync(p => p.UserId == owner, ct); profile.Revision++;
            var storage = scope.ServiceProvider.GetRequiredService<IPrivateStorage>();
            await storage.Delete(photo.ObjectKey, ct); await storage.Delete(photo.ThumbnailKey, ct);
            photo.ObjectsDeleted = true; await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
            db.ChangeTracker.Clear();
        }
    }
}
