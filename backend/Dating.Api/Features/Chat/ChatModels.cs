using System.ComponentModel.DataAnnotations;
namespace Dating.Api.Features.Chat;
public sealed class ChatMessage {
 public Guid Id { get; set; } public Guid ConversationId { get; set; } public Guid SenderId { get; set; }
 public Guid ClientMessageId { get; set; } public long Sequence { get; set; } public string Text { get; set; } = "";
 public DateTimeOffset SentAt { get; set; }
}
public sealed class ChatRead { public Guid ConversationId { get; set; } public Guid UserId { get; set; } public long Sequence { get; set; } }
public sealed class ChatEvent {
 public string Kind {get;set;}="changed";
 public Guid Id { get; set; } public Guid ConversationId { get; set; } public DateTimeOffset CreatedAt { get; set; }
 public DateTimeOffset? ProcessedAt { get; set; } public int Attempts { get; set; }
 public DateTimeOffset NextAttemptAt { get; set; } = DateTimeOffset.UnixEpoch; public DateTimeOffset? DeadLetterAt { get; set; }
}
public sealed record SendMessage(Guid ClientMessageId, [Required,MaxLength(2000)] string Text);
public sealed record ReadMessage(Guid MessageId);
public sealed record MessageDto(Guid Id,Guid ConversationId,Guid SenderId,Guid ClientMessageId,string Sequence,string Text,DateTimeOffset SentAt);
public sealed record HistoryPage(MessageDto[] Items,string? NextBefore,string? NextAfter,string ReadSequence,string PeerReadSequence);
public sealed record ReadDto(string Sequence);
public static class ChatDto {
 public static MessageDto Message(ChatMessage m)=>new(m.Id,m.ConversationId,m.SenderId,m.ClientMessageId,m.Sequence.ToString(System.Globalization.CultureInfo.InvariantCulture),m.Text,m.SentAt);
}
