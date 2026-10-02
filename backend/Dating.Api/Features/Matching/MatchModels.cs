using System.ComponentModel.DataAnnotations;
namespace Dating.Api.Features.Matching;
public sealed class SwipeReceipt {
 public Guid UserId { get; set; } public Guid RequestId { get; set; } public Guid TargetId { get; set; }
 public string Kind { get; set; } = ""; public Guid? MatchId { get; set; } public DateTimeOffset CreatedAt { get; set; }
}
public sealed class DatingMatch {
 public Guid Id { get; set; } public Guid FirstId { get; set; } public Guid SecondId { get; set; }
 public bool Active { get; set; } = true; public DateTimeOffset CreatedAt { get; set; }
}
public sealed class Conversation { public Guid Id { get; set; } public Guid MatchId { get; set; } public long LastSequence { get; set; } }
public sealed class MatchEvent {
 public Guid Id { get; set; } public Guid MatchId { get; set; } public DateTimeOffset CreatedAt { get; set; }
 public DateTimeOffset? ProcessedAt { get; set; }
 public int Attempts { get; set; } public DateTimeOffset NextAttemptAt { get; set; } = DateTimeOffset.UnixEpoch;
 public DateTimeOffset? DeadLetterAt { get; set; } public string? LastErrorCode { get; set; }
}
public sealed class MatchNotice {
 public Guid EventId { get; set; } public Guid UserId { get; set; } public Guid MatchId { get; set; }
 public DateTimeOffset? SeenAt { get; set; }
}
public sealed record SwipeRequest(Guid RequestId, Guid TargetId, [Required] string Kind);
public sealed record SwipeResult(Guid RequestId, Guid TargetId, string Kind, Guid? MatchId);
public sealed record MatchNotification(Guid EventId, Guid MatchId);

public sealed record MatchSummary(Guid Id, string DisplayName, int Age, string City, Guid ConversationId, string? LastMessage, int UnreadCount);
public sealed record MatchPage(MatchSummary[] Items, Guid? NextCursor);
