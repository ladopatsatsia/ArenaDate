using System.ComponentModel.DataAnnotations;
using Dating.Api.Features.Profiles;
namespace Dating.Api.Features.Matching;
public sealed class SwipeReceipt {
 public Guid UserId { get; set; } public Guid RequestId { get; set; } public Guid TargetId { get; set; }
 public string Kind { get; set; } = ""; public Guid? MatchId { get; set; } public DateTimeOffset CreatedAt { get; set; }
}
public sealed class DatingMatch {
 public Guid Id { get; set; } public Guid FirstId { get; set; } public Guid SecondId { get; set; }
 public bool Active { get; set; } = true; public DateTimeOffset CreatedAt { get; set; }
 public string Origin { get; set; } = "Discovery";
 public bool HasChatEntitlement { get; set; } = true;
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
public sealed record SuperLikeRequest(Guid RequestId, Guid TargetId, string? Note = null);
public sealed record SuperLikeResult(Guid RequestId, Guid TargetId, Guid? MatchId, int BalanceAfter, string? Note);
public sealed record MatchNotification(Guid EventId, Guid MatchId);

public sealed class UserProfileView {
 public Guid Id { get; set; }
 public Guid ViewerUserId { get; set; }
 public Guid TargetUserId { get; set; }
 public DateTimeOffset ViewedAt { get; set; }
}

public sealed record MatchSummary(Guid Id, string DisplayName, int Age, string City, Guid ConversationId, string? LastMessage, int UnreadCount, PhotoDto? Photo = null, string Bio = "", string Gender = "", string RelationshipGoal = "", string[]? Interests = null, PhotoDto[]? Photos = null, Guid? UserId = null, bool HasChatEntitlement = true, string Origin = "Discovery");
public sealed record MatchPage(MatchSummary[] Items, Guid? NextCursor);
public sealed record LikeRequestSummary(Guid UserId, string DisplayName, int Age, string City, string Bio, PhotoDto? Photo, string Gender = "", string RelationshipGoal = "", string[]? Interests = null, PhotoDto[]? Photos = null, string Origin = "Discovery", string? Note = null, bool IsBlurred = false);
public sealed record ProfileViewSummary(Guid UserId, string DisplayName, int Age, string City, string Bio, DateTimeOffset ViewedAt, PhotoDto? Photo = null, string Gender = "", string RelationshipGoal = "", string[]? Interests = null, PhotoDto[]? Photos = null, bool IsBlurred = false);
