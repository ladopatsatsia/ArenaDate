using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Dating.Api.Features.AccountLifecycle;

public sealed class AccountPurgeWorker(
    IServiceScopeFactory scopes,
    TimeProvider clock,
    ILogger<AccountPurgeWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Sweep(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Account purge worker encountered an error. Retrying later.");
            }

            try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }

    public async Task Sweep(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storage = scope.ServiceProvider.GetRequiredService<IPrivateStorage>();
        var now = clock.GetUtcNow();

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var job = await db.Set<AccountDeletionJob>()
            .FromSqlInterpolated($"""
                SELECT * FROM "AccountDeletionJobs"
                WHERE "State" IN ('pending', 'failed')
                  AND "NextAttemptAt" <= {now}
                  AND "Attempts" < 10
                ORDER BY "NextAttemptAt"
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            """).SingleOrDefaultAsync(ct);

        if (job is null) return;

        job.Attempts++;
        job.State = "processing";
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        try
        {
            var userId = job.UserId;

            var photos = await db.Set<ProfilePhoto>()
                .Where(p => p.UserId == userId)
                .ToListAsync(ct);

            foreach (var photo in photos)
            {
                if (!string.IsNullOrEmpty(photo.ObjectKey))
                {
                    try { await storage.Delete(photo.ObjectKey, ct); } catch { /* Non-existent objects can be safely skipped */ }
                }
                if (!string.IsNullOrEmpty(photo.ThumbnailKey))
                {
                    try { await storage.Delete(photo.ThumbnailKey, ct); } catch { /* Non-existent objects can be safely skipped */ }
                }
                photo.Deleted = true;
                photo.ObjectsDeleted = true;
                photo.ObjectKey = "";
                photo.ThumbnailKey = "";
            }

            await db.SaveChangesAsync(ct);

            job.State = "completed";
            job.CompletedAt = clock.GetUtcNow();
            job.LastError = null;
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            job.State = "failed";
            job.LastError = ex.Message.Length > 1024 ? ex.Message[..1024] : ex.Message;
            job.NextAttemptAt = clock.GetUtcNow().AddSeconds(Math.Min(300, 5 * Math.Pow(2, job.Attempts)));
            await db.SaveChangesAsync(ct);
            throw;
        }
    }
}
