using System.ComponentModel.DataAnnotations;
namespace Dating.Api.Features.Notifications;
public sealed class PushOptions {
 public bool Enabled {get;set;}
 public string ProjectId {get;set;}="";
 public string AccessToken {get;set;}="";
 public string CurrentKeyId {get;set;}="";
 public Dictionary<string,string> Keys {get;set;}=[];
 public bool Valid(){
  if(!Enabled)return true;
  if(!Guid.TryParse(ProjectId,out var id)||id==Guid.Empty||string.IsNullOrWhiteSpace(AccessToken)||!Keys.ContainsKey(CurrentKeyId))return false;
  try{return Keys.All(k=>!string.IsNullOrWhiteSpace(k.Key)&&Convert.FromBase64String(k.Value).Length==32);}catch(FormatException){return false;}
 }
}
public sealed class PushDevice {
 public Guid Id {get;set;} public Guid UserId {get;set;} public Guid SessionId {get;set;}
 public string SecretHash {get;set;}=""; public string TokenHash {get;set;}="";
 public string Ciphertext {get;set;}=""; public string KeyId {get;set;}="";
 public string Platform {get;set;}=""; public string ProjectId {get;set;}="";
 public int Revision {get;set;} public int BindingRevision {get;set;} public bool Active {get;set;} public DateTimeOffset UpdatedAt {get;set;}
}
public sealed class PushPreference {public Guid UserId {get;set;} public bool Matches {get;set;} public bool Messages {get;set;}}
public sealed class PushDelivery {
 public Guid Id {get;set;} public Guid EventId {get;set;} public Guid DeviceId {get;set;} public int DeviceRevision {get;set;}
 public Guid UserId {get;set;} public Guid ConversationId {get;set;} public string Kind {get;set;}="";
 public DateTimeOffset CreatedAt {get;set;} public DateTimeOffset NextAttemptAt {get;set;} public DateTimeOffset? FinishedAt {get;set;}
 public DateTimeOffset? DeadLetterAt {get;set;} public int Attempts {get;set;} public string? ReceiptId {get;set;}
 public string? LastCode {get;set;}
}
public sealed record DeviceRequest(Guid InstallationId,[Required,MaxLength(64)] string Secret,int Revision,
 [Required] string Provider,[Required] string ProjectId,[Required] string Platform,bool Enabled,[MaxLength(256)] string? Token);
public sealed record PushPreferences(bool Matches,bool Messages);
public sealed record PushConfiguration(bool Enabled,string? ProjectId);
public sealed record NotificationTarget(Guid ConversationId);
public sealed record ResolveNotification(Guid NotificationId);
