using System.ComponentModel.DataAnnotations;
namespace Dating.Api.Features.Moderation;
public sealed class StaffAccount {
 public Guid UserId {get;set;} public string Role {get;set;}="Moderator";
 public bool Enabled {get;set;}=true; public DateTimeOffset? LastMfaAt {get;set;}
}
public sealed class AdminSession {
 public Guid Id {get;set;} public Guid UserId {get;set;} public string SecurityStamp {get;set;}="";
 public DateTimeOffset ExpiresAt {get;set;} public DateTimeOffset? RevokedAt {get;set;}
}
public sealed class AdminMfaUse { public Guid UserId {get;set;} public string CodeHash {get;set;}=""; public DateTimeOffset At {get;set;} }
public sealed record AuditDto(long Id,Guid ActorId,Guid TargetId,string Action,string Reason,DateTimeOffset At);
public sealed class ModerationAudit {
 public long Id {get;set;} public Guid ActorId {get;set;} public Guid TargetId {get;set;}
 public string Action {get;set;}=""; public string Reason {get;set;}=""; public DateTimeOffset At {get;set;}
}
public sealed record AdminLogin([Required,EmailAddress,MaxLength(254)] string Email,[Required,MaxLength(128)] string Password,[Required,RegularExpression("^[0-9]{6}$")] string Code);
public sealed record ReviewRequest([Required] string State,[Required,StringLength(500,MinimumLength=3)] string Reason);
public sealed record AccountReview(bool Active,[Required,StringLength(500,MinimumLength=3)] string Reason);
public sealed record AdminIdentity(Guid Id,string Role);
public sealed record ReportSummary(Guid Id,Guid SubjectId,string Category,DateTimeOffset CreatedAt,bool Closed);
public sealed record PhotoReview(Guid Id,Guid UserId,DateTimeOffset CreatedAt);
public sealed record UserReview(Guid Id,string DisplayName,bool Active);
