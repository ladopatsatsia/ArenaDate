using Dating.Api.Features.Auth;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Chat;
public sealed class ChatService(AppDbContext db,MatchService matches,PairSynchronization pairs,TimeProvider clock,Dating.Api.Features.Notifications.PushQueue push,Dating.Api.Features.Notifications.ITelegramNotificationService telegramNotifications) {
 public async Task<Conversation> Lock(Guid user,Guid id,CancellationToken ct) {
  if(db.Database.CurrentTransaction is null) throw new InvalidOperationException("Transaction required.");
  var row=await (from c in db.Set<Conversation>().AsNoTracking() join m in db.Set<DatingMatch>() on c.MatchId equals m.Id
   where c.Id==id && (m.FirstId==user || m.SecondId==user) select new {m.FirstId,m.SecondId,m.HasChatEntitlement}).SingleOrDefaultAsync(ct);
  if(row is null) throw new AuthFailure(404,"conversation_unavailable");
  if(!row.HasChatEntitlement) throw new AuthFailure(403,"chat_locked_pending_unlock");
  await pairs.Lock(row.FirstId,row.SecondId,ct);
  var conversation=await db.Set<Conversation>().SingleOrDefaultAsync(c=>c.Id==id && matches.Available(user).Any(m=>m.Id==c.MatchId),ct);
  return conversation ?? throw new AuthFailure(404,"conversation_unavailable");
 }
 public async Task AuthorizeSession(Guid user,Guid session,long expiration,Guid id,CancellationToken ct,Action? authorized=null) {
  await using var tx=await db.Database.BeginTransactionAsync(ct);await Lock(user,id,ct);
  if(!await SessionValid(user,session,expiration,ct))throw new AuthFailure(401,"invalid_session");
  authorized?.Invoke();await tx.CommitAsync(ct);
 }
 public async Task<MessageDto> Send(Guid user,Guid id,SendMessage input,CancellationToken ct) {
  if(input.ClientMessageId==Guid.Empty || string.IsNullOrWhiteSpace(input.Text) || input.Text.Length>2000 || input.Text.Contains('\0'))
   throw new AuthFailure(400,"invalid_message");
  await using var tx=await db.Database.BeginTransactionAsync(ct);var conversation=await Lock(user,id,ct);
  var old=await db.Set<ChatMessage>().SingleOrDefaultAsync(m=>m.ConversationId==id && m.SenderId==user && m.ClientMessageId==input.ClientMessageId,ct);
  if(old is not null) {
   if(old.Text!=input.Text) throw new AuthFailure(409,"message_id_reused");
   await tx.CommitAsync(ct);return ChatDto.Message(old);
  }
  if(await db.Set<ChatMessage>().CountAsync(m=>m.SenderId==user && m.SentAt>clock.GetUtcNow().AddMinutes(-1),ct)>=30)
   throw new AuthFailure(429,"message_rate_limited");
  conversation.LastSequence=checked(conversation.LastSequence+1);
  var now=clock.GetUtcNow();
  var sentAt=new DateTimeOffset(now.Ticks-(now.Ticks%10),TimeSpan.Zero);
  var message=new ChatMessage { Id=Guid.NewGuid(),ConversationId=id,SenderId=user,ClientMessageId=input.ClientMessageId,
   Sequence=conversation.LastSequence,Text=input.Text,SentAt=sentAt };
  db.Add(message);db.Add(new ChatEvent { Id=Guid.NewGuid(),ConversationId=id,CreatedAt=now });
  var match=await db.Set<DatingMatch>().AsNoTracking().SingleAsync(m=>m.Id==conversation.MatchId,ct);
  await push.Enqueue(message.Id,id,match.FirstId==user?match.SecondId:match.FirstId,"message",ct);
  await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);
  var recipient = match.FirstId == user ? match.SecondId : match.FirstId;
  _ = Task.Run(async () =>
  {
      try { await telegramNotifications.NotifyChatMessageAsync(user, recipient, input.Text, id, CancellationToken.None); }
      catch { }
  });
  return ChatDto.Message(message);
 }
 public async Task<HistoryPage> History(Guid user,Guid id,long? before,long? after,CancellationToken ct) {
  if((before is not null && after is not null) || before<=0 || after<0) throw new AuthFailure(400,"invalid_cursor");
  await using var tx=await db.Database.BeginTransactionAsync(ct);await Lock(user,id,ct);
  var q=db.Set<ChatMessage>().AsNoTracking().Where(m=>m.ConversationId==id);
  if(before is not null) q=q.Where(m=>m.Sequence<before);
  if(after is not null) q=q.Where(m=>m.Sequence>after);
  var rows=after is not null?await q.OrderBy(m=>m.Sequence).Take(51).ToArrayAsync(ct):await q.OrderByDescending(m=>m.Sequence).Take(51).ToArrayAsync(ct);
  var page=rows.Take(50).OrderBy(m=>m.Sequence).ToArray();
  var reads=await db.Set<ChatRead>().AsNoTracking().Where(r=>r.ConversationId==id).ToArrayAsync(ct);
  await tx.CommitAsync(ct);
  return new(page.Select(ChatDto.Message).ToArray(),after is null && rows.Length>50?page[0].Sequence.ToString():null,
   after is not null && rows.Length>50?page[^1].Sequence.ToString():null,
   (reads.FirstOrDefault(r=>r.UserId==user)?.Sequence??0).ToString(),(reads.FirstOrDefault(r=>r.UserId!=user)?.Sequence??0).ToString());
 }
 public async Task<ReadDto> Read(Guid user,Guid id,ReadMessage input,CancellationToken ct) {
  await using var tx=await db.Database.BeginTransactionAsync(ct);await Lock(user,id,ct);
  var message=await db.Set<ChatMessage>().AsNoTracking().SingleOrDefaultAsync(m=>m.Id==input.MessageId && m.ConversationId==id,ct)
   ?? throw new AuthFailure(400,"invalid_read_cursor");
  var read=await db.Set<ChatRead>().SingleOrDefaultAsync(r=>r.ConversationId==id && r.UserId==user,ct);
  if(read is null) { read=new ChatRead{ConversationId=id,UserId=user};db.Add(read); }
  if(message.Sequence>read.Sequence) {
   read.Sequence=message.Sequence;db.Add(new ChatEvent{Id=Guid.NewGuid(),ConversationId=id,CreatedAt=clock.GetUtcNow()});
  }
  await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return new(read.Sequence.ToString());
 }
 public Task<bool> SessionValid(Guid user,Guid session,long expiration,CancellationToken ct)=>db.Sessions.AnyAsync(s=>
  s.Id==session && s.UserId==user && s.RevokedAt==null && s.ExpiresAt>clock.GetUtcNow() && s.User.IsActive &&
  s.User.EmailConfirmed && expiration>clock.GetUtcNow().ToUnixTimeSeconds(),ct);
}

