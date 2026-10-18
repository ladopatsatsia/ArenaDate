using System.ComponentModel.DataAnnotations;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;

namespace Dating.Api.Features.Game;

public enum GameRoomState
{
    Lobby,
    Starting,
    Playing,
    Paused,
    Ended
}

public enum GameMembershipStatus
{
    Active,
    Disconnected,
    Left,
    Expired
}

public sealed class GameRoom
{
    public Guid Id { get; set; }
    public string Title { get; set; } = "";
    public GameRoomState State { get; set; } = GameRoomState.Lobby;
    public int Capacity { get; set; } = 10;
    public int FemaleQuota { get; set; } = 5;
    public int MaleQuota { get; set; } = 5;
    public int MinFemaleStart { get; set; } = 3;
    public int MinMaleStart { get; set; } = 3;
    public int LobbyTimeoutSeconds { get; set; } = 30;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset LobbyDeadlineUtc { get; set; }
    public int Version { get; set; } = 1;
    public Guid CreatedByUserId { get; set; }

    // Prompt 15 additions:
    public int StateVersion { get; set; } = 1;
    public long Sequence { get; set; } = 0;
    public DateTimeOffset? DeadlineUtc { get; set; }
    public string? DeadlineType { get; set; }
    public bool IsPaused { get; set; } = false;
    public int? RemainingDeadlineMs { get; set; }
    public int DisconnectPauseBudgetMs { get; set; } = 15000;
    public int MinActivePlayers { get; set; } = 4;

    // Prompt 16 additions:
    public Guid? CurrentRoundId { get; set; }
    public Guid? CurrentTurnUserId { get; set; }

    public string? Password { get; set; }
    public bool HasPassword => !string.IsNullOrWhiteSpace(Password);

    public List<GameMembership> Memberships { get; set; } = [];
}

public sealed class GameQuestion
{
    public Guid Id { get; set; }
    public string QuestionText { get; set; } = "";
    public string OptionsJson { get; set; } = "[]";
    public string Category { get; set; } = "general";
    public bool IsActive { get; set; } = true;
    public int Version { get; set; } = 1;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed class GameRound
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public GameRoom Room { get; set; } = null!;
    public int RoundNumber { get; set; }
    public Guid SpinnerUserId { get; set; }
    public Guid TargetUserId { get; set; }
    public int AngleDegrees { get; set; }
    public string State { get; set; } = "Spinning"; // Spinning, QuestionAnswering, QuestionRevealing, KissChoice, Completed, EndedEarly
    public int CurrentQuestionIndex { get; set; } = 0;
    public int ConsecutiveIncompleteQuestions { get; set; } = 0;
    public string QuestionsJson { get; set; } = "[]"; // List<FrozenQuestionDto>
    public string RevealedSelectionsJson { get; set; } = "[]"; // List<RevealedSelectionDto>
    public DateTimeOffset StartedAtUtc { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }

    public List<GameRoundAnswer> Answers { get; set; } = [];
    public Guid? KissRecipientUserId { get; set; }
    public bool KissSkipped { get; set; }
    public List<GameKiss> Kisses { get; set; } = [];
    public string? SummaryCommentary { get; set; }
}

public sealed class GameKiss
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public GameRoom Room { get; set; } = null!;
    public Guid RoundId { get; set; }
    public GameRound Round { get; set; } = null!;
    public Guid SenderUserId { get; set; }
    public Guid RecipientUserId { get; set; }
    public int SenderGeneration { get; set; }
    public int RecipientGeneration { get; set; }
    public string Status { get; set; } = "Pending"; // Pending, Matched, Expired
    public string IdempotencyKey { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? MatchedAtUtc { get; set; }
    public DateTimeOffset? ExpiredAtUtc { get; set; }
}

public sealed class GameDirectMatchRequest
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public Guid SenderUserId { get; set; }
    public Guid TargetUserId { get; set; }
    public string Message { get; set; } = "";
    public int CrystalsPaid { get; set; } = 125;
    public string Status { get; set; } = "Pending"; // Pending, Accepted, Declined
    public string IdempotencyKey { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? RespondedAtUtc { get; set; }
    public Guid? MatchId { get; set; }
}

public sealed class GameRoundAnswer
{
    public Guid Id { get; set; }
    public Guid RoundId { get; set; }
    public GameRound Round { get; set; } = null!;
    public int QuestionIndex { get; set; }
    public Guid UserId { get; set; }
    public int? SelectedOption { get; set; }
    public bool IsSkipped { get; set; }
    public string IdempotencyKey { get; set; } = "";
    public DateTimeOffset SubmittedAtUtc { get; set; }
}

public sealed class GameMembership
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public GameRoom Room { get; set; } = null!;
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public string Gender { get; set; } = "";
    public GameMembershipStatus Status { get; set; } = GameMembershipStatus.Active;
    public int Generation { get; set; } = 1;
    public DateTimeOffset JoinedAtUtc { get; set; }
    public DateTimeOffset? LeftAtUtc { get; set; }

    // Prompt 15 additions:
    public DateTimeOffset LastHeartbeatUtc { get; set; }
    public DateTimeOffset? DisconnectedAtUtc { get; set; }
    public DateTimeOffset? ReservationExpiresAtUtc { get; set; }
}

public sealed class GameOutboxEvent
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public long Sequence { get; set; }
    public int StateVersion { get; set; }
    public string EventType { get; set; } = "";
    public string PayloadJson { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? DispatchedAtUtc { get; set; }
}

public sealed class GameOptions
{
    [Range(2, 20)]
    public int DefaultCapacity { get; set; } = 10;

    [Range(1, 10)]
    public int DefaultFemaleQuota { get; set; } = 5;

    [Range(1, 10)]
    public int DefaultMaleQuota { get; set; } = 5;

    [Range(1, 10)]
    public int MinFemaleStart { get; set; } = 3;

    [Range(1, 10)]
    public int MinMaleStart { get; set; } = 3;

    [Range(5, 300)]
    public int LobbyTimeoutSeconds { get; set; } = 30;

    public bool Valid() =>
        DefaultCapacity == DefaultFemaleQuota + DefaultMaleQuota &&
        MinFemaleStart > 0 && MinMaleStart > 0 &&
        MinFemaleStart <= DefaultFemaleQuota &&
        MinMaleStart <= DefaultMaleQuota &&
        LobbyTimeoutSeconds >= 5;
}

public sealed record CreateRoomRequest(
    [StringLength(60, MinimumLength = 2)] string? Title = null,
    [Range(6, 10)] int Capacity = 10,
    [StringLength(30)] string? Password = null
);

public sealed record JoinRoomRequest(
    [StringLength(30)] string? Password = null
);

public sealed record JoinQueueRequest(
    [Range(6, 10)] int Capacity = 10
);

public sealed record GameMemberDto(
    Guid UserId,
    string DisplayName,
    int Age,
    string Gender,
    PhotoDto? Photo,
    DateTimeOffset JoinedAtUtc,
    string Status = "Active",
    int Generation = 1,
    int? ReservationRemainingSeconds = null,
    bool IsSelf = false
);

public sealed record FrozenQuestionDto(
    Guid Id,
    string QuestionText,
    string[] Options,
    string Category
);

public sealed record RevealedSelectionDto(
    int QuestionIndex,
    int? SpinnerOption,
    int? TargetOption,
    bool IsSuppressed,
    bool IsMatch,
    string FallbackCommentary
);

public sealed record GameRoundDto(
    Guid RoundId,
    int RoundNumber,
    Guid SpinnerUserId,
    Guid TargetUserId,
    int AngleDegrees,
    string State,
    int CurrentQuestionIndex,
    FrozenQuestionDto? CurrentQuestion,
    int? CallerPendingAnswer,
    RevealedSelectionDto[] RevealedSelections,
    DateTimeOffset? DeadlineUtc,
    string? DeadlineType,
    Guid? KissRecipientUserId = null,
    bool KissSkipped = false,
    bool HasPendingKissFromPartner = false,
    string? SummaryCommentary = null
);

public sealed class UserGameSettings
{
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public bool AiConsent { get; set; } = false;
    public DateTimeOffset? AiConsentGivenAtUtc { get; set; }
    public bool AllowProfileUnlockInArena { get; set; } = true;
    public DateTimeOffset UpdatedAtUtc { get; set; }
}

public sealed record UserAiConsentResponse(
    bool AiConsent,
    string DisclosureText,
    DateTimeOffset? ConsentGivenAtUtc
);

public sealed record UpdateAiConsentRequest(
    bool AiConsent
);

public sealed record SendKissRequest(
    Guid RecipientUserId,
    string IdempotencyKey
);

public sealed record SkipKissRequest(
    string IdempotencyKey
);

public sealed record SendKissResult(
    Guid KissId,
    Guid SenderUserId,
    Guid RecipientUserId,
    string Status,
    Guid? MatchId = null,
    Guid? ConversationId = null
);

public sealed record SelectTargetRequest(
    Guid TargetUserId
);

public sealed record SelectTargetResult(
    Guid RoundId,
    Guid SpinnerUserId,
    Guid TargetUserId,
    FrozenQuestionDto CurrentQuestion,
    DateTimeOffset DeadlineUtc
);

public sealed record SkipTargetRequest(
    string? IdempotencyKey = null
);

public sealed record SkipTargetResult(
    Guid RoundId,
    Guid SpinnerUserId,
    string Status,
    DateTimeOffset? NextDeadlineUtc
);

public sealed record PostGameKissRequest(
    Guid RecipientUserId,
    string IdempotencyKey
);

public sealed record PostGameKissResult(
    Guid KissId,
    Guid SenderUserId,
    Guid RecipientUserId,
    string Status,
    bool IsMatch,
    Guid? MatchId = null,
    Guid? ConversationId = null
);


public sealed record DirectMatchRequestDto(
    Guid RequestId,
    Guid SenderUserId,
    string SenderDisplayName,
    int SenderAge,
    PhotoDto? SenderPhoto,
    string Message,
    DateTimeOffset CreatedAtUtc
);

public sealed record SendDirectMatchRequestInput(
    Guid TargetUserId,
    [StringLength(300, MinimumLength = 1)] string Message,
    string IdempotencyKey,
    Guid? RoomId = null
);

public sealed record SendDirectMatchRequestResult(
    Guid RequestId,
    Guid TargetUserId,
    string Status,
    int CrystalsPaid,
    int BalanceAfter,
    DateTimeOffset CreatedAtUtc
);

public sealed record RespondDirectMatchRequestInput(
    string Action
);

public sealed record RespondDirectMatchRequestResult(
    Guid RequestId,
    string Status,
    Guid? MatchId = null,
    Guid? ConversationId = null
);

public sealed record GameGiftEventDto(
    Guid Id,
    Guid SenderUserId,
    Guid RecipientUserId,
    string GiftId,
    string GiftName,
    string GiftIcon,
    int CrystalCost,
    DateTimeOffset CreatedAtUtc
);

public sealed record GameRoomSnapshot(
    Guid RoomId,
    string Title,
    string State,
    int Capacity,
    int FemaleQuota,
    int MaleQuota,
    int MemberCount,
    int FemaleCount,
    int MaleCount,
    int StateVersion,
    long Sequence,
    DateTimeOffset? DeadlineUtc,
    string? DeadlineType,
    bool IsPaused,
    int? RemainingDeadlineMs,
    int DisconnectPauseBudgetMs,
    int MinActivePlayers,
    DateTimeOffset ServerTimeUtc,
    GameMemberDto[] Members,
    Guid? CurrentTurnUserId = null,
    GameRoundDto? CurrentRound = null,
    DirectMatchRequestDto[]? PendingDirectRequests = null,
    Guid[]? SentDirectRequestUserIds = null,
    GameGiftEventDto[]? RecentGifts = null
);

public sealed record SpinRequest(
    bool? AutoPickTarget = null
);

public sealed record SpinResult(
    Guid RoundId,
    Guid SpinnerUserId,
    Guid TargetUserId,
    int AngleDegrees,
    int SpinDurationMs,
    DateTimeOffset DeadlineUtc
);

public sealed record AnswerQuestionRequest(
    Guid QuestionId,
    int? SelectedOption,
    bool IsSkipped,
    string IdempotencyKey,
    int StateVersion
);

public sealed record SkipQuestionRequest(
    string IdempotencyKey
);

public sealed record AnswerQuestionResult(
    Guid RoundId,
    int QuestionIndex,
    bool Submitted,
    bool WaitingForPartner,
    bool Revealed,
    RevealedSelectionDto? RevealedSelection
);

public sealed record GameQuestionDto(
    Guid Id,
    string QuestionText,
    string[] Options,
    string Category,
    bool IsActive,
    int Version,
    DateTimeOffset CreatedAtUtc
);

public sealed record CreateQuestionRequest(
    [Required, StringLength(300)] string QuestionText,
    [Required, MinLength(3), MaxLength(4)] string[] Options,
    [Required, StringLength(50)] string Category
);

public sealed record UpdateQuestionRequest(
    [Required, StringLength(300)] string QuestionText,
    [Required, MinLength(3), MaxLength(4)] string[] Options,
    [Required, StringLength(50)] string Category,
    bool IsActive
);

public sealed record ReconnectRoomResult(
    Guid RoomId,
    Guid MembershipId,
    int Generation,
    GameRoomSnapshot Snapshot
);

public sealed record HeartbeatResult(
    Guid RoomId,
    DateTimeOffset ServerTimeUtc
);

public sealed record GameRoomSummary(
    Guid Id,
    string Title,
    string State,
    int MemberCount,
    int FemaleCount,
    int MaleCount,
    int Capacity,
    int FemaleQuota,
    int MaleQuota,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset LobbyDeadlineUtc,
    int Version,
    bool HasPassword = false
);

public sealed record GameRoomDetail(
    Guid Id,
    string Title,
    string State,
    int MemberCount,
    int FemaleCount,
    int MaleCount,
    int Capacity,
    int FemaleQuota,
    int MaleQuota,
    int MinFemaleStart,
    int MinMaleStart,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset LobbyDeadlineUtc,
    int Version,
    bool CanStart,
    bool IsJoined,
    GameMemberDto[] Members,
    bool HasPassword = false
);

public sealed record JoinRoomResult(
    Guid RoomId,
    Guid MembershipId,
    string State,
    int Version
);

public sealed record LeaveRoomResult(
    Guid RoomId,
    bool Success
);

public sealed record DevFixtureSeedRequest(
    [Range(0, 5)] int FemaleCount = 3,
    [Range(0, 5)] int MaleCount = 3
);

public sealed record SendRoomMessageRequest(
    string Text
);

public sealed record GameRoomMessageDto(
    Guid Id,
    Guid RoomId,
    Guid SenderUserId,
    string SenderDisplayName,
    string? SenderPhotoId,
    string Text,
    DateTimeOffset SentAtUtc
);

