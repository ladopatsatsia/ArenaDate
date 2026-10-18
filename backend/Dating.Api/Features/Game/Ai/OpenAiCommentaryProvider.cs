using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Dating.Api.Features.Game.Ai;

public sealed class OpenAiCommentaryProvider : IAiCommentaryProvider
{
    private readonly HttpClient _httpClient;
    private readonly OpenAiOptions _options;
    private readonly DeterministicAiCommentaryProvider _fallbackProvider;
    private readonly ILogger<OpenAiCommentaryProvider> _logger;
    private readonly SemaphoreSlim _semaphore;

    private const string SystemPrompt =
        "შენ ხარ ბოთლის თამაშის მახვილგონივრული, თავაზიანი და მსუბუქი ქართველი კომენტატორი. " +
        "შენი დავალებაა დაწერო 1 მოკლე, ბუნებრივი ქართული წინადადება (მაქსიმუმ 25 სიტყვა).\n" +
        "წესები:\n" +
        "- გამოიყენე მსუბუქი იუმორი და ფლირტი, მაგრამ არასოდეს დაპირდე სიყვარულს ან ქორწინებას.\n" +
        "- არასოდეს გააკეთო თავსებადობის ან ფსიქოლოგიური დიაგნოზი.\n" +
        "- არასოდეს დააკნინო ან გაკიცხო განსხვავებული არჩევანი.\n" +
        "- არასოდეს მოუწოდო კოცნისკენ ან კრისტალების/ფულის დახარჯვისკენ.\n" +
        "- პასუხი აუცილებლად დააბრუნე JSON ფორმატში: {\"commentary\": \"...\"}.";

    public OpenAiCommentaryProvider(
        HttpClient httpClient,
        IOptions<OpenAiOptions> options,
        DeterministicAiCommentaryProvider fallbackProvider,
        ILogger<OpenAiCommentaryProvider> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _fallbackProvider = fallbackProvider;
        _logger = logger;
        _semaphore = new SemaphoreSlim(Math.Max(1, _options.MaxConcurrentRequests));
    }

    public async Task<AiCommentaryResult> GenerateQuestionCommentaryAsync(QuestionCommentaryContext context, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            return await _fallbackProvider.GenerateQuestionCommentaryAsync(context, ct);
        }

        var sw = Stopwatch.StartNew();

        var recentContext = context.RecentCommentaries != null && context.RecentCommentaries.Count > 0
            ? string.Join("; ", context.RecentCommentaries)
            : "არ არის";

        var userPrompt =
            $"კითხვა: {context.QuestionText}\n" +
            $"მოთამაშე 1-ის არჩევანი: {context.SpinnerOptionText}\n" +
            $"მოთამაშე 2-ის არჩევანი: {context.TargetOptionText}\n" +
            $"თანხვედრა: {(context.IsMatch ? "დიახ" : "არა")}\n" +
            $"წინა კომენტარები: {recentContext}\n" +
            "დაწერე მოკლე ქართული კომენტარი ამ კონკრეტულ არჩევანზე.";

        var acquired = await _semaphore.WaitAsync(TimeSpan.FromSeconds(1), ct);
        if (!acquired)
        {
            _logger.LogWarning("AI commentary throttled due to concurrency cap; utilizing deterministic fallback.");
            return await _fallbackProvider.GenerateQuestionCommentaryAsync(context, ct);
        }

        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_options.TimeoutSeconds, 1, 5)));

            var result = await CallOpenAiAsync(userPrompt, timeoutCts.Token);
            sw.Stop();

            if (result != null)
            {
                var validation = AiCommentaryValidator.Validate(result);
                if (validation.IsValid)
                {
                    return new AiCommentaryResult(
                        Success: true,
                        Commentary: result,
                        Provider: $"OpenAI:{_options.Model}",
                        IsFallback: false,
                        LatencyMs: sw.ElapsedMilliseconds
                    );
                }
                _logger.LogWarning("OpenAI commentary rejected by safety validator: {Reason}. Falling back.", validation.RejectionReason);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("OpenAI commentary call timed out after {Timeout}s. Falling back.", _options.TimeoutSeconds);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenAI commentary call failed. Falling back.");
        }
        finally
        {
            _semaphore.Release();
        }

        return await _fallbackProvider.GenerateQuestionCommentaryAsync(context, ct);
    }

    public async Task<AiCommentaryResult> GenerateRoundSummaryAsync(RoundSummaryContext context, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            return await _fallbackProvider.GenerateRoundSummaryAsync(context, ct);
        }

        var sw = Stopwatch.StartNew();

        var questionsSummaryBuilder = new StringBuilder();
        foreach (var q in context.CompletedQuestions)
        {
            questionsSummaryBuilder.AppendLine($"- {q.QuestionText}: {q.SpinnerOptionText} vs {q.TargetOptionText} (თანხვედრა: {(q.IsMatch ? "კი" : "არა")})");
        }

        var userPrompt =
            "რაუნდის შეჯამება:\n" +
            $"სულ კითხვები: {context.TotalQuestionsCount}\n" +
            $"უპასუხეს: {context.AnsweredQuestionsCount}\n" +
            $"თანხვედრები: {context.MatchesCount}\n" +
            $"განსხვავებები: {context.DifferencesCount}\n" +
            $"კითხვების ჩამონათვალი:\n{questionsSummaryBuilder}\n" +
            "დაწერე მოკლე ქართული შემაჯამებელი კომენტარი რაუნდზე. აუცილებლად ზუსტად ასახე პასუხგაცემული კითხვების რაოდენობა.";

        var acquired = await _semaphore.WaitAsync(TimeSpan.FromSeconds(1), ct);
        if (!acquired)
        {
            _logger.LogWarning("AI commentary throttled due to concurrency cap; utilizing deterministic fallback.");
            return await _fallbackProvider.GenerateRoundSummaryAsync(context, ct);
        }

        try
        {
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_options.TimeoutSeconds, 1, 5)));

            var result = await CallOpenAiAsync(userPrompt, timeoutCts.Token);
            sw.Stop();

            if (result != null)
            {
                var validation = AiCommentaryValidator.Validate(result);
                if (validation.IsValid)
                {
                    return new AiCommentaryResult(
                        Success: true,
                        Commentary: result,
                        Provider: $"OpenAI:{_options.Model}",
                        IsFallback: false,
                        LatencyMs: sw.ElapsedMilliseconds
                    );
                }
                _logger.LogWarning("OpenAI summary rejected by safety validator: {Reason}. Falling back.", validation.RejectionReason);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("OpenAI summary call timed out after {Timeout}s. Falling back.", _options.TimeoutSeconds);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenAI summary call failed. Falling back.");
        }
        finally
        {
            _semaphore.Release();
        }

        return await _fallbackProvider.GenerateRoundSummaryAsync(context, ct);
    }

    private async Task<string?> CallOpenAiAsync(string userPrompt, CancellationToken ct)
    {
        var requestUrl = $"{_options.BaseUrl.TrimEnd('/')}/chat/completions";

        var payload = new
        {
            model = _options.Model,
            temperature = 0.7,
            max_tokens = 150,
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = SystemPrompt },
                new { role = "user", content = userPrompt }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, requestUrl)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        var response = await _httpClient.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("OpenAI API returned non-success code: {StatusCode}", response.StatusCode);
            return null;
        }

        var json = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);

        if (doc.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
        {
            var firstChoice = choices[0];
            if (firstChoice.TryGetProperty("message", out var message) &&
                message.TryGetProperty("content", out var contentElem))
            {
                var contentText = contentElem.GetString();
                if (!string.IsNullOrWhiteSpace(contentText))
                {
                    try
                    {
                        using var innerDoc = JsonDocument.Parse(contentText);
                        if (innerDoc.RootElement.TryGetProperty("commentary", out var commElem))
                        {
                            return commElem.GetString();
                        }
                    }
                    catch
                    {
                        return contentText.Trim();
                    }
                }
            }
        }

        return null;
    }
}
