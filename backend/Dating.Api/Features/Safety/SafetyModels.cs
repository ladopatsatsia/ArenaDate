using System.ComponentModel.DataAnnotations;
namespace Dating.Api.Features.Safety;
public sealed record ReportInput([Required] string Kind,[Required] string Category,[Required(AllowEmptyStrings=true),MaxLength(1000)] string Description,Guid? MessageId=null);
public sealed record SafetyRequest(Guid RequestId,[Required] string Action,Guid? TargetId=null,Guid? ConversationId=null,ReportInput? Report=null);
public sealed class SafetyReceipt {
 public Guid ActorId {get;set;} public Guid RequestId {get;set;} public string Fingerprint {get;set;}="";
 public DateTimeOffset CreatedAt {get;set;}
}
public sealed class SafetyReport {
 public DateTimeOffset? ClosedAt {get;set;}
 public Guid Id {get;set;} public Guid ReporterId {get;set;} public Guid SubjectId {get;set;}
 public string Category {get;set;}=""; public string ProtectedEvidence {get;set;}="";
 public DateTimeOffset CreatedAt {get;set;} public DateTimeOffset DeleteAfter {get;set;}
}
public sealed record SafetyItem(Guid Id,DateTimeOffset? CreatedAt);
public sealed record SafetyPage(SafetyItem[] Items,Guid? NextCursor);
