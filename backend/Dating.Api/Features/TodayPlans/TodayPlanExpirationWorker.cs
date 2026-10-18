using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Dating.Api.Features.TodayPlans;

public sealed class TodayPlanExpirationWorker(
    IServiceScopeFactory scopeFactory,
    TimeProvider clock,
    ILogger<TodayPlanExpirationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("TodayPlanExpirationWorker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<TodayPlanService>();
                await service.ProcessExpiredPlansAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing expired today plans in background.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(15), clock, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        logger.LogInformation("TodayPlanExpirationWorker stopped.");
    }
}
