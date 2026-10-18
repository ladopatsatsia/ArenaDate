using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Dating.Api.Features.Game;

public sealed class GameDeadlineWorker(
    IServiceScopeFactory scopeFactory,
    TimeProvider clock,
    ILogger<GameDeadlineWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("GameDeadlineWorker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<GameService>();
                await service.ProcessDeadlinesAndOutboxAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing game deadlines and outbox.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(1), clock, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        logger.LogInformation("GameDeadlineWorker stopped.");
    }
}
