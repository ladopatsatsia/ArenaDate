namespace Dating.Api.Features.Game.Ai;

public sealed record QuestionCommentaryContext(
    string QuestionText,
    IReadOnlyList<string> Options,
    int SpinnerOptionIndex,
    string SpinnerOptionText,
    int TargetOptionIndex,
    string TargetOptionText,
    bool IsMatch,
    string Language = "ka",
    IReadOnlyList<string>? RecentCommentaries = null
);

public sealed record RoundQuestionSummaryItem(
    string QuestionText,
    string SpinnerOptionText,
    string TargetOptionText,
    bool IsMatch
);

public sealed record RoundSummaryContext(
    int TotalQuestionsCount,
    int AnsweredQuestionsCount,
    int MatchesCount,
    int DifferencesCount,
    IReadOnlyList<RoundQuestionSummaryItem> CompletedQuestions,
    string Language = "ka",
    IReadOnlyList<string>? RecentCommentaries = null
);

public sealed record AiCommentaryResult(
    bool Success,
    string Commentary,
    string Provider,
    bool IsFallback,
    long LatencyMs,
    string? Error = null
);

public interface IAiCommentaryProvider
{
    Task<AiCommentaryResult> GenerateQuestionCommentaryAsync(QuestionCommentaryContext context, CancellationToken ct);
    Task<AiCommentaryResult> GenerateRoundSummaryAsync(RoundSummaryContext context, CancellationToken ct);
}
