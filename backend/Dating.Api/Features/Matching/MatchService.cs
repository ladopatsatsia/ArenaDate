using Dating.Api.Features.Chat;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Game;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Matching;
public sealed class MatchService(AppDbContext db, PairSynchronization pairs, DiscoveryEligibility eligibility, TimeProvider clock, Dating.Api.Features.Notifications.PushQueue push, Dating.Api.Features.Premium.IPremiumService premiumService, Dating.Api.Features.Notifications.ITelegramNotificationService telegramNotifications) {
 public IQueryable<DatingMatch> Available(Guid user) => db.Set<DatingMatch>().Where(m => m.Active &&
  (m.FirstId == user || m.SecondId == user) &&
  db.Users.Any(u => u.Id == m.FirstId && u.IsActive && u.EmailConfirmed) &&
  db.Users.Any(u => u.Id == m.SecondId && u.IsActive && u.EmailConfirmed) &&
  !db.Set<UserBlock>().Any(b => (b.BlockerId == m.FirstId && b.BlockedId == m.SecondId) || (b.BlockerId == m.SecondId && b.BlockedId == m.FirstId)) &&
  !db.Set<UnmatchedPair>().Any(p => (p.FirstId == m.FirstId && p.SecondId == m.SecondId) || (p.SecondId == m.FirstId && p.FirstId == m.SecondId)));
 private async Task<SwipeResult> Result(SwipeReceipt receipt, CancellationToken ct) {
  var match = receipt.MatchId is not null && await Available(receipt.UserId).AnyAsync(m => m.Id == receipt.MatchId, ct) ? receipt.MatchId : null;
  return new(receipt.RequestId, receipt.TargetId, receipt.Kind, match);
 }
 public async Task<MatchPage> List(Guid user,Guid? after,CancellationToken ct) {
  var query=Available(user).Where(m=>after==null || m.Id.CompareTo(after.Value)>0);
  var rows=await query.OrderBy(m=>m.Id).Take(21).Select(m=>new {
   m.Id,
   m.HasChatEntitlement,
   m.Origin,
   ConversationId=db.Set<Conversation>().Where(c=>c.MatchId==m.Id).Select(c=>c.Id).Single(),
   LastMessage=(from c in db.Set<Conversation>() join message in db.Set<ChatMessage>() on c.Id equals message.ConversationId
     where c.MatchId==m.Id orderby message.Sequence descending select message.Text).FirstOrDefault(),
   Unread=(from c in db.Set<Conversation>() join message in db.Set<ChatMessage>() on c.Id equals message.ConversationId
     where c.MatchId==m.Id && message.SenderId!=user &&
      message.Sequence>(db.Set<ChatRead>().Where(r=>r.ConversationId==c.Id && r.UserId==user).Select(r=>(long?)r.Sequence).SingleOrDefault()??0)
     select message.Id).Count(),
   Profile=db.Set<DatingProfile>().Where(p=>p.UserId==(m.FirstId==user?m.SecondId:m.FirstId))
    .Select(p=>new {
     p.UserId,p.DisplayName,p.City,p.Bio,p.Gender,p.RelationshipGoal,p.Interests,p.User.DateOfBirth
    }).Single()
  }).ToArrayAsync(ct);
  var ids = rows.Select(r => r.Profile.UserId).ToArray();
  var photos = await db.Set<ProfilePhoto>().AsNoTracking()
      .Where(f => ids.Contains(f.UserId) && !f.Deleted && f.State == "approved")
      .OrderBy(f => f.Position)
      .Select(f => new { f.UserId, Photo = new PhotoDto(f.Id, f.State, f.Position, f.Width, f.Height) })
      .ToListAsync(ct);
  var items=rows.Take(20).Select(r=>{
   var userPhotos = photos.Where(f => f.UserId == r.Profile.UserId).Select(f => f.Photo).ToArray();
   return new MatchSummary(
    r.Id,
    r.Profile.DisplayName,
    ProfileRules.Age(r.Profile.DateOfBirth,clock.GetUtcNow()),
    r.Profile.City,
    r.ConversationId,
    r.LastMessage==null?null:r.LastMessage.Substring(0,Math.Min(120,r.LastMessage.Length)),
    r.Unread,
    userPhotos.FirstOrDefault(),
    r.Profile.Bio ?? "",
    r.Profile.Gender ?? "",
    r.Profile.RelationshipGoal ?? "",
    r.Profile.Interests ?? [],
    userPhotos,
    r.Profile.UserId,
    r.HasChatEntitlement,
    r.Origin);
  }).ToArray();
  return new(items,rows.Length>20?items[^1].Id:null);
 }
 public async Task<LikeRequestSummary[]> Requests(Guid user, CancellationToken ct) {
  var pendingGameKissSenders = await db.Set<GameKiss>()
      .Where(k => k.RecipientUserId == user && k.Status == "Pending")
      .Select(k => k.SenderUserId)
      .Distinct()
      .ToListAsync(ct);

  var pendingGameDirectSenders = await db.Set<Dating.Api.Features.Game.GameDirectMatchRequest>()
      .Where(d => d.TargetUserId == user && d.Status == "Pending")
      .Select(d => d.SenderUserId)
      .Distinct()
      .ToListAsync(ct);

  var allBottleGameSenders = pendingGameKissSenders.Concat(pendingGameDirectSenders).ToHashSet();

  var superLikes = await db.Set<DiscoverySuperLike>().AsNoTracking()
      .Where(s => s.TargetUserId == user)
      .ToDictionaryAsync(s => s.SenderUserId, ct);

  var directRequests = await db.Set<Dating.Api.Features.Game.GameDirectMatchRequest>().AsNoTracking()
      .Where(d => d.TargetUserId == user && d.Status == "Pending")
      .ToDictionaryAsync(d => d.SenderUserId, ct);

  var discoveryLikes = await db.Set<DiscoveryDecision>()
      .Where(d => d.TargetId == user && d.Kind == "like")
      .Select(d => d.UserId)
      .Distinct()
      .ToListAsync(ct);

  var allCandidateSenderIds = discoveryLikes
      .Concat(superLikes.Keys)
      .Concat(allBottleGameSenders)
      .Distinct()
      .ToList();

  if (allCandidateSenderIds.Count == 0) return [];

  var alreadyMatchedIds = await db.Set<DatingMatch>()
      .Where(m => m.Active && ((m.FirstId == user && allCandidateSenderIds.Contains(m.SecondId)) || (m.SecondId == user && allCandidateSenderIds.Contains(m.FirstId))))
      .Select(m => m.FirstId == user ? m.SecondId : m.FirstId)
      .ToListAsync(ct);

  var blockedIds = await db.Set<UserBlock>()
      .Where(b => (b.BlockerId == user && allCandidateSenderIds.Contains(b.BlockedId)) || (b.BlockedId == user && allCandidateSenderIds.Contains(b.BlockerId)))
      .Select(b => b.BlockerId == user ? b.BlockedId : b.BlockerId)
      .ToListAsync(ct);

  var unmatchedIds = await db.Set<UnmatchedPair>()
      .Where(p => (p.FirstId == user && allCandidateSenderIds.Contains(p.SecondId)) || (p.SecondId == user && allCandidateSenderIds.Contains(p.FirstId)))
      .Select(p => p.FirstId == user ? p.SecondId : p.FirstId)
      .ToListAsync(ct);

  var alreadyLikedBackIds = await db.Set<DiscoveryDecision>()
      .Where(d => d.UserId == user && allCandidateSenderIds.Contains(d.TargetId) && d.Kind == "like")
      .Select(d => d.TargetId)
      .ToListAsync(ct);

  var validSenderIds = allCandidateSenderIds
      .Except(alreadyMatchedIds)
      .Except(blockedIds)
      .Except(unmatchedIds)
      .Except(alreadyLikedBackIds)
      .Take(50)
      .ToList();

  if (validSenderIds.Count == 0) return [];

  var rawRows = await db.Set<DatingProfile>()
      .Where(p => validSenderIds.Contains(p.UserId) && p.Visible && p.User.IsActive && p.User.EmailConfirmed)
      .Select(profile => new {
       profile.UserId,
       profile.DisplayName,
       profile.City,
       profile.Bio,
       profile.Gender,
       profile.RelationshipGoal,
       profile.Interests,
       profile.User.DateOfBirth
      })
      .ToListAsync(ct);

  // Prioritize Super Likes and Bottle Game matches at the top of incoming requests
  var rows = rawRows.OrderByDescending(r => superLikes.ContainsKey(r.UserId) || allBottleGameSenders.Contains(r.UserId)).ToArray();

  var ids = rows.Select(r => r.UserId).ToArray();
  var photos = await db.Set<ProfilePhoto>().AsNoTracking()
              .Where(f => ids.Contains(f.UserId) && !f.Deleted && f.State != "rejected")
              .OrderBy(f => f.Position)
              .Select(f => new { f.UserId, Photo = new PhotoDto(f.Id, f.State, f.Position, f.Width, f.Height) })
              .ToListAsync(ct);

  var hasPremium = await premiumService.HasActivePremiumAsync(user, ct);
  return rows.Select(r => {
   var userPhotos = photos.Where(f => f.UserId == r.UserId).Select(f => f.Photo).ToArray();
   var isSuperLike = superLikes.TryGetValue(r.UserId, out var sl);
   var isArenaKiss = allBottleGameSenders.Contains(r.UserId);
   directRequests.TryGetValue(r.UserId, out var directReq);
   var origin = isSuperLike ? "SuperLike" : (isArenaKiss ? "GameArena" : "Discovery");
   var note = isSuperLike ? (sl?.Note ?? "⭐ გამოგიგზავნა სუპერ ლაიქი") : (directReq != null && !string.IsNullOrWhiteSpace(directReq.Message) ? $"💌 \"{directReq.Message}\"" : (isArenaKiss ? "🍾 ბოთლის თამაშიდან არის მეჩი" : null));
   // SuperLikes and GameArena are special sender actions, never blurred
   var isBlurred = !hasPremium && origin == "Discovery";
   return new LikeRequestSummary(
    UserId: r.UserId,
    DisplayName: r.DisplayName,
    Age: ProfileRules.Age(r.DateOfBirth, clock.GetUtcNow()),
    City: r.City,
    Bio: r.Bio,
    Photo: userPhotos.FirstOrDefault(),
    Gender: r.Gender,
    RelationshipGoal: r.RelationshipGoal,
    Interests: r.Interests,
    Photos: userPhotos,
    Origin: origin,
    Note: note,
    IsBlurred: isBlurred
   );
  }).ToArray();
 }
 public async Task<SwipeResult> Decide(Guid user, SwipeRequest input, CancellationToken ct) {
  if (input.RequestId == Guid.Empty || input.Kind is not ("like" or "pass")) throw new AuthFailure(400,"invalid_decision");
  await using var tx = await db.Database.BeginTransactionAsync(ct);
  await pairs.Lock(user, input.TargetId, ct);
  var receipt = await db.Set<SwipeReceipt>().SingleOrDefaultAsync(r => r.UserId == user && r.RequestId == input.RequestId, ct);
  if (receipt is not null) {
   if (receipt.TargetId != input.TargetId || receipt.Kind != input.Kind) throw new AuthFailure(409,"request_id_reused");
   var replay = await Result(receipt, ct); await tx.CommitAsync(ct); return replay;
  }

  // Check if this decision is responding to an incoming like, superlike, or game request
  var incomingLike = await db.Set<DiscoveryDecision>().AnyAsync(d => d.UserId == input.TargetId && d.TargetId == user && d.Kind == "like", ct);
  var incomingSuperLike = await db.Set<DiscoverySuperLike>().AnyAsync(s => s.SenderUserId == input.TargetId && s.TargetUserId == user, ct);
  var pendingKisses = await db.Set<GameKiss>()
      .Where(k => (k.SenderUserId == input.TargetId && k.RecipientUserId == user) ||
                  (k.SenderUserId == user && k.RecipientUserId == input.TargetId))
      .Where(k => k.Status == "Pending")
      .ToListAsync(ct);
  var pendingDirects = await db.Set<Dating.Api.Features.Game.GameDirectMatchRequest>()
      .Where(d => (d.SenderUserId == input.TargetId && d.TargetUserId == user) ||
                  (d.SenderUserId == user && d.TargetUserId == input.TargetId))
      .Where(d => d.Status == "Pending")
      .ToListAsync(ct);

  var isRespondingToIncoming = incomingLike || incomingSuperLike || pendingKisses.Count > 0 || pendingDirects.Count > 0;

  var existingDecision = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == user && d.TargetId == input.TargetId, ct);
  if (existingDecision != null) {
      if (existingDecision.Kind == input.Kind) {
          throw new AuthFailure(409, "decision_final");
      }
      // If user previously passed, but is now liking in response to an incoming request, allow updating!
      if (isRespondingToIncoming && input.Kind == "like") {
          existingDecision.Kind = "like";
      } else {
          throw new AuthFailure(409, "decision_final");
      }
  } else {
      db.Add(new DiscoveryDecision { UserId = user, TargetId = input.TargetId, Kind = input.Kind });
  }

  if (isRespondingToIncoming) {
      if (await db.Set<UserBlock>().AnyAsync(b => (b.BlockerId == user && b.BlockedId == input.TargetId) || (b.BlockerId == input.TargetId && b.BlockedId == user), ct))
          throw new AuthFailure(404, "profile_unavailable");
      if (await db.Set<UnmatchedPair>().AnyAsync(u => (u.FirstId == user && u.SecondId == input.TargetId) || (u.SecondId == user && u.FirstId == input.TargetId), ct))
          throw new AuthFailure(404, "profile_unavailable");
      var targetProfile = await db.Set<DatingProfile>().Include(p => p.User).SingleOrDefaultAsync(p => p.UserId == input.TargetId, ct);
      if (targetProfile is null || !targetProfile.Visible || !targetProfile.User.IsActive || !AdultPolicy.IsAdult(targetProfile.User.DateOfBirth, clock.GetUtcNow()))
          throw new AuthFailure(404, "profile_unavailable");
  } else {
      await eligibility.RequireCurrent(user, input.TargetId, ct);
  }

  receipt = new SwipeReceipt { UserId=user, TargetId=input.TargetId, RequestId=input.RequestId, Kind=input.Kind, CreatedAt=clock.GetUtcNow() };
  db.Add(receipt);

  if (input.Kind == "pass") {
      foreach (var k in pendingKisses) {
          k.Status = "Declined";
      }
      foreach (var d in pendingDirects) {
          d.Status = "Declined";
          d.RespondedAtUtc = clock.GetUtcNow();
      }
  } else if (input.Kind == "like" && (incomingLike || incomingSuperLike || pendingKisses.Count > 0 || pendingDirects.Count > 0)) {
   var (first,second) = PairSynchronization.Order(user,input.TargetId);
   var existingMatch = await db.Set<DatingMatch>().SingleOrDefaultAsync(m => m.FirstId == first && m.SecondId == second, ct);
   if (existingMatch != null) {
    if (!existingMatch.HasChatEntitlement) {
     existingMatch.HasChatEntitlement = true;
    }
    existingMatch.Active = true;
    receipt.MatchId = existingMatch.Id;
   } else {
    var superLike = await db.Set<DiscoverySuperLike>().AsNoTracking()
        .SingleOrDefaultAsync(s => (s.SenderUserId == input.TargetId && s.TargetUserId == user) ||
                                   (s.SenderUserId == user && s.TargetUserId == input.TargetId), ct);
    var isFromSuperLike = superLike != null;
    var isFromGame = pendingKisses.Count > 0 || pendingDirects.Count > 0;
    var matchOrigin = isFromSuperLike ? "SuperLike" : (isFromGame ? "GameArena" : "Discovery");
    var hasChatEntitlement = !isFromGame; // GameArena matches require 25 crystals to unlock chat!

    var now = clock.GetUtcNow();
    foreach (var k in pendingKisses) {
        k.Status = "Matched";
        k.MatchedAtUtc = now;
    }
    foreach (var d in pendingDirects) {
        d.Status = "Accepted";
        d.RespondedAtUtc = now;
    }

    var match = new DatingMatch { Id=Guid.NewGuid(), FirstId=first, SecondId=second, Origin=matchOrigin, HasChatEntitlement=hasChatEntitlement, CreatedAt=now, Active=true };
    var conversation=new Conversation {Id=Guid.NewGuid(),MatchId=match.Id};var matchEvent=new MatchEvent {Id=Guid.NewGuid(),MatchId=match.Id,CreatedAt=now};
    db.Add(match);db.Add(conversation);db.Add(matchEvent);

    foreach (var d in pendingDirects) {
        d.MatchId = match.Id;
    }

    if (superLike != null && !string.IsNullOrWhiteSpace(superLike.Note)) {
        var introMessage = new ChatMessage {
            Id = Guid.NewGuid(),
            ConversationId = conversation.Id,
            SenderId = superLike.SenderUserId,
            ClientMessageId = Guid.NewGuid(),
            Sequence = 1,
            Text = superLike.Note,
            SentAt = now
        };
        db.Add(introMessage);
        conversation.LastSequence = 1;
    } else if (pendingDirects.FirstOrDefault(d => !string.IsNullOrWhiteSpace(d.Message)) is { } directWithMsg) {
        var introMessage = new ChatMessage {
            Id = Guid.NewGuid(),
            ConversationId = conversation.Id,
            SenderId = directWithMsg.SenderUserId,
            ClientMessageId = Guid.NewGuid(),
            Sequence = 1,
            Text = directWithMsg.Message,
            SentAt = now
        };
        db.Add(introMessage);
        conversation.LastSequence = 1;
    }

    await push.Enqueue(matchEvent.Id,conversation.Id,first,"match",ct);await push.Enqueue(matchEvent.Id,conversation.Id,second,"match",ct);
    receipt.MatchId=match.Id;
   }
  }
  await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
  if (receipt.MatchId.HasValue)
  {
      _ = Task.Run(async () =>
      {
          try { await telegramNotifications.NotifyMatchAsync(receipt.UserId, receipt.TargetId, CancellationToken.None); }
          catch { }
      });
  }
  else if (input.Kind == "like")
  {
      _ = Task.Run(async () =>
      {
          try { await telegramNotifications.NotifyLikeReceivedAsync(user, input.TargetId, CancellationToken.None); }
          catch { }
      });
  }
  return new(receipt.RequestId,receipt.TargetId,receipt.Kind,receipt.MatchId);
 }

 public async Task<SuperLikeResult> SuperLike(Guid user, SuperLikeRequest input, CancellationToken ct) {
  if (input.RequestId == Guid.Empty || input.TargetId == Guid.Empty || user == input.TargetId)
      throw new AuthFailure(400, "invalid_superlike_request");

  var trimmedNote = string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim();
  if (trimmedNote != null && trimmedNote.Length > 300)
      throw new AuthFailure(400, "note_too_long");

  await using var tx = await db.Database.BeginTransactionAsync(ct);
  await pairs.Lock(user, input.TargetId, ct);

  var receipt = await db.Set<SwipeReceipt>().SingleOrDefaultAsync(r => r.UserId == user && r.RequestId == input.RequestId, ct);
  if (receipt != null) {
      var currentWallet = await db.Set<Dating.Api.Features.Game.Wallet.UserWallet>().AsNoTracking().SingleOrDefaultAsync(w => w.UserId == user, ct);
      var existingSuperLike = await db.Set<DiscoverySuperLike>().AsNoTracking()
          .SingleOrDefaultAsync(s => s.SenderUserId == user && s.TargetUserId == input.TargetId, ct);
      await tx.CommitAsync(ct);
      return new SuperLikeResult(input.RequestId, input.TargetId, receipt.MatchId, currentWallet?.Balance ?? 0, existingSuperLike?.Note);
  }

  var existingUserDecision = await db.Set<DiscoveryDecision>().SingleOrDefaultAsync(d => d.UserId == user && d.TargetId == input.TargetId, ct);
  if (existingUserDecision != null) {
      existingUserDecision.Kind = "like";
  }

  // Safety checks
  if (await db.Set<UserBlock>().AnyAsync(b => (b.BlockerId == user && b.BlockedId == input.TargetId) || (b.BlockerId == input.TargetId && b.BlockedId == user), ct))
      throw new AuthFailure(404, "profile_unavailable");
  if (await db.Set<UnmatchedPair>().AnyAsync(u => (u.FirstId == user && u.SecondId == input.TargetId) || (u.SecondId == user && u.FirstId == input.TargetId), ct))
      throw new AuthFailure(404, "profile_unavailable");
  var superLikeTargetProfile = await db.Set<DatingProfile>().Include(p => p.User).SingleOrDefaultAsync(p => p.UserId == input.TargetId, ct);
  if (superLikeTargetProfile is null || !superLikeTargetProfile.Visible || !superLikeTargetProfile.User.IsActive || !AdultPolicy.IsAdult(superLikeTargetProfile.User.DateOfBirth, clock.GetUtcNow()))
      throw new AuthFailure(404, "profile_unavailable");

  const int SuperLikePrice = 20;

  var wallet = await db.Set<Dating.Api.Features.Game.Wallet.UserWallet>()
      .FromSqlInterpolated($"""SELECT "UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc", xmin FROM "UserWallets" WHERE "UserId" = {user} FOR UPDATE""")
      .SingleOrDefaultAsync(ct);

  if (wallet is null || wallet.Balance < SuperLikePrice) {
      throw new AuthFailure(400, "insufficient_crystals");
  }

  wallet.Balance -= SuperLikePrice;
  wallet.UpdatedAtUtc = clock.GetUtcNow();

  var crystalTx = new Dating.Api.Features.Game.Wallet.CrystalTransaction {
      Id = Guid.NewGuid(),
      UserId = user,
      Amount = -SuperLikePrice,
      BalanceAfter = wallet.Balance,
      Type = "SuperLike",
      ReferenceId = input.TargetId.ToString(),
      IdempotencyKey = $"superlike:{input.RequestId}",
      Description = $"სუპერ ლაიქი ({SuperLikePrice} 💎)",
      CreatedAtUtc = clock.GetUtcNow()
  };
  db.Add(crystalTx);

  var now = clock.GetUtcNow();
  var superLikeEntity = new DiscoverySuperLike {
      Id = Guid.NewGuid(),
      SenderUserId = user,
      TargetUserId = input.TargetId,
      Note = trimmedNote,
      CreatedAtUtc = now
  };
  db.Add(superLikeEntity);

  if (existingUserDecision == null) {
      db.Add(new DiscoveryDecision { UserId = user, TargetId = input.TargetId, Kind = "like" });
  }
  receipt = new SwipeReceipt { UserId = user, TargetId = input.TargetId, RequestId = input.RequestId, Kind = "superlike", CreatedAt = now };
  db.Add(receipt);

  var recipientAlreadyLiked = await db.Set<DiscoveryDecision>().AnyAsync(d => d.UserId == input.TargetId && d.TargetId == user && d.Kind == "like", ct);
  var pendingKisses = await db.Set<GameKiss>()
      .Where(k => (k.SenderUserId == input.TargetId && k.RecipientUserId == user) ||
                  (k.SenderUserId == user && k.RecipientUserId == input.TargetId))
      .Where(k => k.Status == "Pending")
      .ToListAsync(ct);

  // Super Like with crystals guarantees an instant match!
  var (first, second) = PairSynchronization.Order(user, input.TargetId);
  var existingMatch = await db.Set<DatingMatch>().SingleOrDefaultAsync(m => m.FirstId == first && m.SecondId == second, ct);
  if (existingMatch != null) {
      existingMatch.HasChatEntitlement = true;
      existingMatch.Active = true;
      receipt.MatchId = existingMatch.Id;
  } else {
      foreach (var k in pendingKisses) {
          k.Status = "Matched";
          k.MatchedAtUtc = now;
      }

      if (!recipientAlreadyLiked) {
          db.Add(new DiscoveryDecision { UserId = input.TargetId, TargetId = user, Kind = "like" });
      }

      var match = new DatingMatch {
          Id = Guid.NewGuid(),
          FirstId = first,
          SecondId = second,
          Origin = "SuperLike",
          HasChatEntitlement = true,
          CreatedAt = now,
          Active = true
      };
      var conversation = new Conversation { Id = Guid.NewGuid(), MatchId = match.Id };
      var matchEvent = new MatchEvent { Id = Guid.NewGuid(), MatchId = match.Id, CreatedAt = now };
      db.Add(match);
      db.Add(conversation);
      db.Add(matchEvent);

      if (!string.IsNullOrWhiteSpace(trimmedNote)) {
          var introMessage = new ChatMessage {
              Id = Guid.NewGuid(),
              ConversationId = conversation.Id,
              SenderId = user,
              ClientMessageId = Guid.NewGuid(),
              Sequence = 1,
              Text = trimmedNote,
              SentAt = now
          };
          db.Add(introMessage);
          conversation.LastSequence = 1;
      }

      await push.Enqueue(matchEvent.Id, conversation.Id, first, "match", ct);
      await push.Enqueue(matchEvent.Id, conversation.Id, second, "match", ct);
      receipt.MatchId = match.Id;
  }

  await db.SaveChangesAsync(ct);
  await tx.CommitAsync(ct);

  if (receipt.MatchId.HasValue)
  {
      _ = Task.Run(async () =>
      {
          try { await telegramNotifications.NotifyMatchAsync(user, input.TargetId, CancellationToken.None); }
          catch { }
      });
  }
  else
  {
      _ = Task.Run(async () =>
      {
          try { await telegramNotifications.NotifySuperLikeAsync(user, input.TargetId, trimmedNote, CancellationToken.None); }
          catch { }
      });
  }

  return new SuperLikeResult(receipt.RequestId, receipt.TargetId, receipt.MatchId, wallet.Balance, trimmedNote);
 }
 public async Task<(DatingMatch Match, Conversation Conversation, bool Created)> CreateOrUnlockGameMatchAsync(Guid userA, Guid userB, CancellationToken ct) {
  var (first, second) = PairSynchronization.Order(userA, userB);
  var ownsTx = db.Database.CurrentTransaction == null;
  Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? tx = ownsTx ? await db.Database.BeginTransactionAsync(ct) : null;
  try {
   await pairs.Lock(first, second, ct);

   var isBlocked = await db.Set<UserBlock>().AnyAsync(b =>
    (b.BlockerId == first && b.BlockedId == second) ||
    (b.BlockerId == second && b.BlockedId == first), ct);
   if (isBlocked) throw new AuthFailure(403, "pair_blocked");

   var isUnmatched = await db.Set<UnmatchedPair>().AnyAsync(p =>
    (p.FirstId == first && p.SecondId == second) ||
    (p.FirstId == second && p.SecondId == first), ct);
   if (isUnmatched) throw new AuthFailure(403, "pair_unmatched");

   var existingMatch = await db.Set<DatingMatch>().SingleOrDefaultAsync(m => m.FirstId == first && m.SecondId == second, ct);
   if (existingMatch != null) {
    if (!existingMatch.Active) {
     existingMatch.Active = true;
     await db.SaveChangesAsync(ct);
    }
    var existingConv = await db.Set<Conversation>().SingleAsync(c => c.MatchId == existingMatch.Id, ct);
    if (ownsTx) await tx!.CommitAsync(ct);
    return (existingMatch, existingConv, false);
   }

   var now = clock.GetUtcNow();
   var match = new DatingMatch {
    Id = Guid.NewGuid(),
    FirstId = first,
    SecondId = second,
    Origin = "GameArena",
    HasChatEntitlement = false,
    Active = true,
    CreatedAt = now
   };
   var conversation = new Conversation { Id = Guid.NewGuid(), MatchId = match.Id };
   var matchEvent = new MatchEvent { Id = Guid.NewGuid(), MatchId = match.Id, CreatedAt = now };
   db.Add(match); db.Add(conversation); db.Add(matchEvent);
   await push.Enqueue(matchEvent.Id, conversation.Id, first, "match", ct);
   await push.Enqueue(matchEvent.Id, conversation.Id, second, "match", ct);
   await db.SaveChangesAsync(ct);
   if (ownsTx) await tx!.CommitAsync(ct);
   _ = Task.Run(async () =>
   {
       try { await telegramNotifications.NotifyMatchAsync(first, second, CancellationToken.None); }
       catch { }
   });
   return (match, conversation, true);
  } finally {
   if (tx != null) await tx.DisposeAsync();
  }
 }

  public async Task<SwipeResult?> Receipt(Guid user, Guid request, CancellationToken ct) {
   var receipt = await db.Set<SwipeReceipt>().AsNoTracking().SingleOrDefaultAsync(r=>r.UserId==user && r.RequestId==request,ct);
  return receipt is null ? null : await Result(receipt,ct);
 }
 public Task<MatchNotification[]> Notices(Guid user,CancellationToken ct) =>
  db.Set<MatchNotice>().Where(n=>n.UserId==user && n.SeenAt==null && Available(user).Any(m=>m.Id==n.MatchId))
   .OrderBy(n=>n.EventId).Take(20).Select(n=>new MatchNotification(n.EventId,n.MatchId)).ToArrayAsync(ct);
 public async Task Acknowledge(Guid user,Guid match,CancellationToken ct) {
  // Acknowledge only caller's records. A receipt may arrive before outbox processing:
  // upsert the same event/user identity so a later delivery cannot resurrect its modal.
  var item = await db.Set<MatchEvent>().Where(e=>e.MatchId==match &&
   db.Set<DatingMatch>().Any(m=>m.Id==match && (m.FirstId==user || m.SecondId==user))).SingleOrDefaultAsync(ct);
  if(item is null) throw new AuthFailure(404,"match_unavailable");
  var now=clock.GetUtcNow();
  await db.Database.ExecuteSqlInterpolatedAsync($"""
   INSERT INTO "MatchNotice" ("EventId","UserId","MatchId","SeenAt") VALUES ({item.Id},{user},{match},{now})
   ON CONFLICT ("EventId","UserId") DO UPDATE SET "SeenAt" = EXCLUDED."SeenAt"
   """,ct);
 }

 public async Task RecordProfileView(Guid viewer, Guid target, CancellationToken ct) {
  if (viewer == target) return;
  if (await db.Set<UserBlock>().AnyAsync(b => (b.BlockerId == viewer && b.BlockedId == target) || (b.BlockerId == target && b.BlockedId == viewer), ct))
   return;
  if (await db.Set<UnmatchedPair>().AnyAsync(p => (p.FirstId == viewer && p.SecondId == target) || (p.SecondId == viewer && p.FirstId == target), ct))
   return;

  var existing = await db.Set<UserProfileView>().SingleOrDefaultAsync(pv => pv.ViewerUserId == viewer && pv.TargetUserId == target, ct);
  if (existing is not null) {
   existing.ViewedAt = clock.GetUtcNow();
  } else {
   db.Add(new UserProfileView {
    Id = Guid.NewGuid(),
    ViewerUserId = viewer,
    TargetUserId = target,
    ViewedAt = clock.GetUtcNow()
   });
  }
  await db.SaveChangesAsync(ct);
 }

 public async Task<ProfileViewSummary[]> GetViewedMe(Guid user, CancellationToken ct) {
  var query = from pv in db.Set<UserProfileView>()
              where pv.TargetUserId == user
              where !db.Set<UserBlock>().Any(b => (b.BlockerId == user && b.BlockedId == pv.ViewerUserId) || (b.BlockerId == pv.ViewerUserId && b.BlockedId == user))
              where !db.Set<UnmatchedPair>().Any(p => (p.FirstId == user && p.SecondId == pv.ViewerUserId) || (p.SecondId == user && p.FirstId == pv.ViewerUserId))
              join profile in db.Set<DatingProfile>() on pv.ViewerUserId equals profile.UserId
              where profile.Visible && profile.User.IsActive && profile.User.EmailConfirmed
              orderby pv.ViewedAt descending
              select new {
               profile.UserId,
               profile.DisplayName,
               profile.City,
               profile.Bio,
               profile.Gender,
               profile.RelationshipGoal,
               profile.Interests,
               profile.User.DateOfBirth,
               pv.ViewedAt
              };

  var rows = await query.Take(50).ToArrayAsync(ct);
  var ids = rows.Select(r => r.UserId).ToArray();
  var photos = await db.Set<ProfilePhoto>().AsNoTracking()
              .Where(f => ids.Contains(f.UserId) && !f.Deleted && f.State == "approved")
              .OrderBy(f => f.Position)
              .Select(f => new { f.UserId, Photo = new PhotoDto(f.Id, f.State, f.Position, f.Width, f.Height) })
              .ToListAsync(ct);

  var hasPremium = await premiumService.HasActivePremiumAsync(user, ct);
  return rows.Select(r => {
   var userPhotos = photos.Where(f => f.UserId == r.UserId).Select(f => f.Photo).ToArray();
   if (!hasPremium)
   {
    return new ProfileViewSummary(
     r.UserId,
     r.DisplayName,
     ProfileRules.Age(r.DateOfBirth, clock.GetUtcNow()),
     "",
     "",
     r.ViewedAt,
     userPhotos.FirstOrDefault(),
     "",
     "",
     null,
     null,
     IsBlurred: true
    );
   }
   return new ProfileViewSummary(
    r.UserId,
    r.DisplayName,
    ProfileRules.Age(r.DateOfBirth, clock.GetUtcNow()),
    r.City,
    r.Bio ?? "",
    r.ViewedAt,
    userPhotos.FirstOrDefault(),
    r.Gender ?? "",
    r.RelationshipGoal ?? "",
    r.Interests ?? [],
    userPhotos,
    IsBlurred: false
   );
  }).ToArray();
 }

 public async Task<ProfileViewSummary[]> GetYouViewed(Guid user, CancellationToken ct) {
  var query = from pv in db.Set<UserProfileView>()
              where pv.ViewerUserId == user
              where !db.Set<UserBlock>().Any(b => (b.BlockerId == user && b.BlockedId == pv.TargetUserId) || (b.BlockerId == pv.TargetUserId && b.BlockedId == user))
              where !db.Set<UnmatchedPair>().Any(p => (p.FirstId == user && p.SecondId == pv.TargetUserId) || (p.SecondId == user && p.FirstId == pv.TargetUserId))
              join profile in db.Set<DatingProfile>() on pv.TargetUserId equals profile.UserId
              where profile.Visible && profile.User.IsActive && profile.User.EmailConfirmed
              orderby pv.ViewedAt descending
              select new {
               profile.UserId,
               profile.DisplayName,
               profile.City,
               profile.Bio,
               profile.Gender,
               profile.RelationshipGoal,
               profile.Interests,
               profile.User.DateOfBirth,
               pv.ViewedAt
              };

  var rows = await query.Take(50).ToArrayAsync(ct);
  var ids = rows.Select(r => r.UserId).ToArray();
  var photos = await db.Set<ProfilePhoto>().AsNoTracking()
              .Where(f => ids.Contains(f.UserId) && !f.Deleted && f.State == "approved")
              .OrderBy(f => f.Position)
              .Select(f => new { f.UserId, Photo = new PhotoDto(f.Id, f.State, f.Position, f.Width, f.Height) })
              .ToListAsync(ct);

  var hasPremium = await premiumService.HasActivePremiumAsync(user, ct);
  return rows.Select(r => {
   var userPhotos = photos.Where(f => f.UserId == r.UserId).Select(f => f.Photo).ToArray();
   if (!hasPremium)
   {
    return new ProfileViewSummary(
     r.UserId,
     r.DisplayName,
     ProfileRules.Age(r.DateOfBirth, clock.GetUtcNow()),
     "",
     "",
     r.ViewedAt,
     userPhotos.FirstOrDefault(),
     "",
     "",
     null,
     null,
     IsBlurred: true
    );
   }
   return new ProfileViewSummary(
    r.UserId,
    r.DisplayName,
    ProfileRules.Age(r.DateOfBirth, clock.GetUtcNow()),
    r.City,
    r.Bio ?? "",
    r.ViewedAt,
    userPhotos.FirstOrDefault(),
    r.Gender ?? "",
    r.RelationshipGoal ?? "",
    r.Interests ?? [],
    userPhotos,
    IsBlurred: false
   );
  }).ToArray();
 }
}
