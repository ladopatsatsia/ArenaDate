using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
namespace Dating.Api.Features.Notifications;
public sealed record PushResult(string Status,string Code,string? Ticket=null);
public interface IPushProvider {
 Task<PushResult> Send(string token,Guid notification,string kind,CancellationToken ct);
 Task<PushResult> Receipt(string ticket,CancellationToken ct);
}
public sealed class ExpoPushProvider(HttpClient client,IOptions<PushOptions> options):IPushProvider {
 private async Task<JsonDocument?> Post(string path,object payload,CancellationToken ct){
  using var request=new HttpRequestMessage(HttpMethod.Post,new Uri("https://exp.host/--/api/v2/push/"+path));
  request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",options.Value.AccessToken);
  request.Content=JsonContent.Create(payload);
  using var response=await client.SendAsync(request,ct);
  if(response.StatusCode==HttpStatusCode.TooManyRequests||(int)response.StatusCode>=500)throw new HttpRequestException("push_retry");
  if(!response.IsSuccessStatusCode)return null;
  return JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
 }
 private static PushResult Parse(JsonElement data,bool ticket){
  if(data.TryGetProperty("status",out var status)&&status.GetString()=="ok"){
   if(!ticket)return new("ok","accepted");
   if(data.TryGetProperty("id",out var id)&&id.ValueKind==JsonValueKind.String&&id.GetString() is {Length:>0 and <=128} value)return new("ticket","queued",value);
   return new("retry","invalid_response");
  }
  var code=data.TryGetProperty("details",out var details)&&details.TryGetProperty("error",out var error)?error.GetString():null;
  return code switch {
   "DeviceNotRegistered"=>new("invalid","invalid_token"),
   "MessageRateExceeded"=>new("retry","provider_rate"),
   "InvalidCredentials" or "MismatchSenderId"=>new("permanent","provider_credentials"),
   "MessageTooBig"=>new("permanent","payload_rejected"),
   _=>new("retry","provider_unavailable")
  };
 }
 public async Task<PushResult> Send(string token,Guid notification,string kind,CancellationToken ct){
  using var doc=await Post("send",new{to=token,title="DatingMVP",body=kind=="match"?"You have a new match.":"You have a new message.",
   data=new{notificationId=notification,version=1},sound="default",channelId="activity",ttl=600},ct);
  if(doc is null)return new("permanent","provider_rejected");
  return doc.RootElement.TryGetProperty("data",out var data)&&data.ValueKind==JsonValueKind.Object?Parse(data,true):new("retry","invalid_response");
 }
 public async Task<PushResult> Receipt(string ticket,CancellationToken ct){
  using var doc=await Post("getReceipts",new{ids=new[]{ticket}},ct);
  if(doc is null)return new("permanent","provider_rejected");
  return doc.RootElement.TryGetProperty("data",out var data)&&data.TryGetProperty(ticket,out var receipt)?Parse(receipt,false):new("retry","receipt_pending");
 }
}
