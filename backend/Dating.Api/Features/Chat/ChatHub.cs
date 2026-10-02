using System.Collections.Concurrent;
using Dating.Api.Features.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
namespace Dating.Api.Features.Chat;
public sealed record ChatSubscription(string Connection,Guid User,Guid Session,long Expiration,Guid Conversation);
public sealed class ChatConnections {
 private readonly ConcurrentDictionary<string,ChatSubscription> subscriptions=new();
 private readonly ConcurrentDictionary<string,ChatSubscription> known=new();
 public void Set(ChatSubscription value){known[value.Connection]=value;subscriptions[value.Connection]=value;} // one conversation per connection
 public void Remove(string connection){subscriptions.TryRemove(connection,out _);known.TryRemove(connection,out _);}
 public void Revoke(Guid conversation){foreach(var s in For(conversation))subscriptions.TryRemove(s.Connection,out _);}
 public ChatSubscription[] Known(Guid conversation)=>known.Values.Where(s=>s.Conversation==conversation).ToArray();
 public ChatSubscription[] For(Guid conversation)=>subscriptions.Values.Where(s=>s.Conversation==conversation).ToArray();
}
[Authorize]
public sealed class ChatHub(ChatService service,ChatConnections connections):Hub {
 private async Task<(Guid User,Guid Session,long Expiration)> Validate(Guid conversation,bool subscribe=false) {
  if(!Guid.TryParse(Context.User?.FindFirst("sub")?.Value,out var user) ||
   !Guid.TryParse(Context.User?.FindFirst("sid")?.Value,out var session) ||
   !long.TryParse(Context.User?.FindFirst("exp")?.Value,out var expiration)) {
   connections.Remove(Context.ConnectionId);Context.Abort();throw new HubException("conversation_unavailable");
  }
  try { await service.AuthorizeSession(user,session,expiration,conversation,Context.ConnectionAborted,subscribe?()=>connections.Set(new(Context.ConnectionId,user,session,expiration,conversation)):null); }
  catch(AuthFailure) { connections.Remove(Context.ConnectionId);throw new HubException("conversation_unavailable"); }
  return(user,session,expiration);
 }
 public async Task Subscribe(Guid conversation) {
  await Validate(conversation,true);
 }
 public async Task Unsubscribe(Guid conversation) { await Validate(conversation);connections.Remove(Context.ConnectionId); }
 public override Task OnDisconnectedAsync(Exception? exception) { connections.Remove(Context.ConnectionId);return base.OnDisconnectedAsync(exception); }
}
