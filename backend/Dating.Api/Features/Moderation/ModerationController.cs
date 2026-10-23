using System.Security.Claims;
using System.Text.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Game;
using Dating.Api.Features.Game.Wallet;
using Dating.Api.Features.Premium;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Safety;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace Dating.Api.Features.Moderation;
[ApiController,Route("api/moderation"),Authorize(Policy="Staff"),AdminCsrf,EnableRateLimiting("profile")]
[ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class ModerationController(AppDbContext db,ModerationService service,IAntiforgery csrf,IPrivateStorage storage,Dating.Api.Features.Notifications.ITelegramNotificationService telegramNotifications):ControllerBase {
 private Guid Actor=>Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
 [HttpGet("csrf"),AllowAnonymous]
 public async Task<IActionResult> Csrf() {
  var auth=await HttpContext.AuthenticateAsync(AdminSetup.Scheme);HttpContext.User=auth.Succeeded?auth.Principal!:new ClaimsPrincipal(new ClaimsIdentity());
  var tokens=csrf.GetAndStoreTokens(HttpContext);
  Response.Cookies.Append("XSRF-TOKEN",tokens.RequestToken!,new CookieOptions{HttpOnly=false,Secure=true,SameSite=SameSiteMode.Strict,Path="/"});
  return NoContent();
 }
 [HttpPost("login"),AllowAnonymous,EnableRateLimiting("auth"),RequestSizeLimit(2048)]
 public async Task<IActionResult> Login(AdminLogin input,CancellationToken ct){await service.Login(HttpContext,input,ct);return NoContent();}
 [HttpGet("me")] public async Task<AdminIdentity> Me(CancellationToken ct)=>new(Actor,await db.Set<StaffAccount>().Where(s=>s.UserId==Actor).Select(s=>s.Role).SingleAsync(ct));
 [HttpPost("logout")] public async Task<IActionResult> Logout(CancellationToken ct){await service.Logout(Actor,Guid.Parse(User.FindFirstValue("admin_session")!),ct);await HttpContext.SignOutAsync(AdminSetup.Scheme);return NoContent();}
 [HttpGet("photos")] public Task<PhotoReview[]> Photos(Guid? after,CancellationToken ct)=>db.Set<ProfilePhoto>().Where(p=>!p.Deleted && p.State=="pending" && (after==null || p.Id.CompareTo(after.Value)>0)).OrderBy(p=>p.Id).Take(50).Select(p=>new PhotoReview(p.Id,p.UserId,p.CreatedAt)).ToArrayAsync(ct);
 [HttpGet("photos/{id:guid}/content")] public async Task<IActionResult> Photo(Guid id,CancellationToken ct) {
  var photo=await db.Set<ProfilePhoto>().AsNoTracking().SingleOrDefaultAsync(p=>p.Id==id && !p.Deleted && p.State=="pending",ct)??throw new AuthFailure(404,"photo_not_found");
  service.Audit(Actor,id,"photo_view","Admin photo review");await db.SaveChangesAsync(ct);
  Response.Headers["X-Content-Type-Options"]="nosniff";return File(await storage.Get(photo.ObjectKey,ct),"image/jpeg");
 }
 [HttpGet("profiles/photos/{id:guid}/content")] public async Task<IActionResult> ProfilePhoto(Guid id,CancellationToken ct) {
  var photo=await db.Set<ProfilePhoto>().AsNoTracking().SingleOrDefaultAsync(p=>p.Id==id && !p.Deleted,ct)??throw new AuthFailure(404,"photo_not_found");
  service.Audit(Actor,id,"profile_photo_view","Admin profile review");await db.SaveChangesAsync(ct);
  Response.Headers["X-Content-Type-Options"]="nosniff";
  try {
   return File(await storage.Get(photo.ObjectKey,ct),"image/jpeg");
  } catch {
   return NotFound();
  }
 }
 [HttpPost("photos/{id:guid}"),RequestSizeLimit(4096)] public async Task<IActionResult> PhotoReview(Guid id,ReviewRequest input,CancellationToken ct){await service.ReviewPhoto(Actor,id,input,ct);return NoContent();}
 [HttpGet("reports")] public Task<ReportSummary[]> Reports(Guid? after,bool closed,CancellationToken ct) {
  var now=DateTimeOffset.UtcNow;return db.Set<SafetyReport>().Where(r=>r.DeleteAfter>now && (r.ClosedAt!=null)==closed && (after==null || r.Id.CompareTo(after.Value)>0)).OrderBy(r=>r.Id).Take(50).Select(r=>new ReportSummary(r.Id,r.SubjectId,r.Category,r.CreatedAt,r.ClosedAt!=null)).ToArrayAsync(ct);
 }
 [HttpGet("reports/{id:guid}/evidence")] public Task<JsonElement> Evidence(Guid id,CancellationToken ct)=>service.Evidence(Actor,id,ct);
 [HttpPost("reports/{id:guid}"),RequestSizeLimit(4096)] public async Task<IActionResult> Close(Guid id,ReviewRequest input,CancellationToken ct){await service.CloseReport(Actor,id,input,ct);return NoContent();}
 [HttpGet("users/{id:guid}")] public async Task<UserReview> Account(Guid id,CancellationToken ct)=>await (from u in db.Users join p in db.Set<DatingProfile>() on u.Id equals p.UserId into profiles from p in profiles.DefaultIfEmpty() where u.Id==id select new UserReview(u.Id,p==null?"":p.DisplayName,u.IsActive)).SingleOrDefaultAsync(ct)??throw new AuthFailure(404,"user_unavailable");
 [HttpPost("users/{id:guid}"),RequestSizeLimit(4096)] public async Task<IActionResult> Account(Guid id,AccountReview input,CancellationToken ct){await service.Account(Actor,id,input,ct);return NoContent();}
 [HttpDelete("users/{id:guid}")]
 public async Task<IActionResult> DeleteUser(Guid id, [FromQuery] string? reason, CancellationToken ct)
 {
  var effectiveReason = !string.IsNullOrWhiteSpace(reason) ? reason : "Account deleted by administrator";
  await service.DeleteUser(Actor, id, effectiveReason, ct);
  return NoContent();
 }
 [HttpPost("users"), RequestSizeLimit(4096)]
 public async Task<AdminProfileSummary> CreateUser([FromBody] AdminCreateUserRequest input, CancellationToken ct) =>
     await service.CreateUser(Actor, input, ct);
 [HttpPost("users/{id:guid}/crystals"), RequestSizeLimit(4096)]
 public async Task<AdminCrystalAdjustmentResult> AdjustCrystals(Guid id, [FromBody] AdminAdjustCrystalsRequest input, CancellationToken ct) =>
     await service.AdjustCrystals(Actor, id, input, ct);
 [HttpGet("profiles")]
 public async Task<AdminProfileSummary[]> Profiles([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
 {
     var q = from u in db.Users.AsNoTracking()
             join p in db.Set<DatingProfile>().AsNoTracking() on u.Id equals p.UserId into profs
             from p in profs.DefaultIfEmpty()
             where !u.IsDeleted
             select new { User = u, Profile = p };

     if (!string.IsNullOrWhiteSpace(search))
     {
         var term = search.Trim().ToLower();
         q = q.Where(x =>
             (x.User.Email != null && x.User.Email.ToLower().Contains(term)) ||
             (x.Profile != null && x.Profile.DisplayName != null && x.Profile.DisplayName.ToLower().Contains(term)) ||
             (x.Profile != null && x.Profile.City != null && x.Profile.City.ToLower().Contains(term)));
     }

     var skip = Math.Max(0, page - 1) * Math.Clamp(pageSize, 1, 100);
     var items = await q.OrderByDescending(x => x.User.Id).Skip(skip).Take(Math.Clamp(pageSize, 1, 100)).ToListAsync(ct);
     var userIds = items.Select(x => x.User.Id).ToList();
     var photos = await db.Set<ProfilePhoto>().AsNoTracking()
         .Where(ph => userIds.Contains(ph.UserId) && !ph.Deleted)
         .OrderBy(ph => ph.Position)
         .ToListAsync(ct);
     var wallets = await db.Set<UserWallet>().AsNoTracking()
         .Where(w => userIds.Contains(w.UserId))
         .ToDictionaryAsync(w => w.UserId, w => w.Balance, ct);

     var now = DateTimeOffset.UtcNow;
     return items.Select(x =>
     {
         var uPhotos = photos.Where(ph => ph.UserId == x.User.Id).ToList();
         return new AdminProfileSummary(
             x.User.Id,
             x.User.Email ?? "",
             x.Profile?.DisplayName ?? "",
             x.Profile?.Gender ?? "",
             x.Profile?.City ?? "",
             ProfileRules.Age(x.User.DateOfBirth, now),
             x.User.IsActive,
             x.User.EmailConfirmed,
             x.Profile?.Visible ?? false,
             uPhotos.Count,
             uPhotos.FirstOrDefault()?.Id,
             wallets.GetValueOrDefault(x.User.Id, 0)
         );
     }).ToArray();
 }
 [HttpGet("profiles/{id:guid}")]
 public async Task<AdminProfileDetail> ProfileDetail(Guid id, CancellationToken ct)
 {
     var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == id && !u.IsDeleted, ct)
         ?? throw new AuthFailure(404, "user_not_found");

     var p = await db.Set<DatingProfile>().AsNoTracking().SingleOrDefaultAsync(pr => pr.UserId == id, ct);
     var photos = await db.Set<ProfilePhoto>().AsNoTracking()
         .Where(ph => ph.UserId == id && !ph.Deleted)
         .OrderBy(ph => ph.Position)
         .Select(ph => new AdminPhotoDto(ph.Id, ph.State, ph.Position, ph.CreatedAt))
         .ToArrayAsync(ct);

     var wallet = await db.Set<UserWallet>().AsNoTracking().SingleOrDefaultAsync(w => w.UserId == id, ct);
     var now = DateTimeOffset.UtcNow;
     return new AdminProfileDetail(
         user.Id,
         user.Email ?? "",
         user.EmailConfirmed,
         user.IsActive,
         p?.DisplayName ?? "",
         p?.Bio ?? "",
         p?.Gender ?? "",
         p?.DesiredGenders ?? [],
         p?.City ?? "",
         p?.CityKey ?? "",
         user.DateOfBirth,
         ProfileRules.Age(user.DateOfBirth, now),
         p?.Interests ?? [],
         p?.RelationshipGoal ?? "",
         p?.Languages ?? [],
         p?.Visible ?? false,
         p?.MinAge ?? 18,
         p?.MaxAge ?? 99,
         p?.RadiusKm ?? 25,
         p?.LocationMode ?? "city",
         p?.Revision ?? 0,
         photos,
         wallet?.Balance ?? 0
     );
 }
 [HttpGet("audit")] public Task<AuditDto[]> Audit(long? before,CancellationToken ct)=>db.Set<ModerationAudit>().AsNoTracking().Where(a=>before==null || a.Id<before).OrderByDescending(a=>a.Id).Take(50).Select(a=>new AuditDto(a.Id,a.ActorId,a.TargetId,a.Action,a.Reason,a.At)).ToArrayAsync(ct);

 [HttpGet("game-questions")]
 public async Task<GameQuestionDto[]> ListGameQuestions(CancellationToken ct)
 {
     var count = await db.Set<GameQuestion>().CountAsync(ct);
     if (count < 20)
     {
         var now = DateTimeOffset.UtcNow;
         var existingTexts = await db.Set<GameQuestion>().Select(q => q.QuestionText).ToListAsync(ct);
         var seed = GameQuestionCatalog.CreateSeedQuestions(now);
         foreach (var q in seed)
         {
             if (!existingTexts.Contains(q.QuestionText))
             {
                 db.Set<GameQuestion>().Add(q);
             }
         }
         await db.SaveChangesAsync(ct);
     }

     var list = await db.Set<GameQuestion>().AsNoTracking().OrderBy(q => q.CreatedAtUtc).ToListAsync(ct);
     return list.Select(q => new GameQuestionDto(
         q.Id,
         q.QuestionText,
         JsonSerializer.Deserialize<string[]>(q.OptionsJson) ?? Array.Empty<string>(),
         q.Category,
         q.IsActive,
         q.Version,
         q.CreatedAtUtc
     )).ToArray();
 }

 [HttpPost("game-questions"), RequestSizeLimit(4096)]
 public async Task<GameQuestionDto> CreateGameQuestion([FromBody] CreateQuestionRequest input, CancellationToken ct)
 {
     if (input.Options.Length < 3 || input.Options.Length > 4)
         throw new AuthFailure(400, "options_must_be_3_or_4");

     var now = DateTimeOffset.UtcNow;
     var question = new GameQuestion
     {
         Id = Guid.NewGuid(),
         QuestionText = input.QuestionText,
         OptionsJson = JsonSerializer.Serialize(input.Options),
         Category = input.Category,
         IsActive = true,
         Version = 1,
         CreatedAtUtc = now,
         UpdatedAtUtc = now
     };
     db.Set<GameQuestion>().Add(question);
     service.Audit(Actor, question.Id, "create_game_question", $"Created question '{question.QuestionText}'");
     await db.SaveChangesAsync(ct);

     return new GameQuestionDto(question.Id, question.QuestionText, input.Options, question.Category, question.IsActive, question.Version, question.CreatedAtUtc);
 }

 [HttpPut("game-questions/{id:guid}"), RequestSizeLimit(4096)]
 public async Task<GameQuestionDto> UpdateGameQuestion(Guid id, [FromBody] UpdateQuestionRequest input, CancellationToken ct)
 {
     if (input.Options.Length < 3 || input.Options.Length > 4)
         throw new AuthFailure(400, "options_must_be_3_or_4");

     var q = await db.Set<GameQuestion>().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new AuthFailure(404, "question_not_found");
     q.QuestionText = input.QuestionText;
     q.OptionsJson = JsonSerializer.Serialize(input.Options);
     q.Category = input.Category;
     q.IsActive = input.IsActive;
     q.Version++;
     q.UpdatedAtUtc = DateTimeOffset.UtcNow;
     service.Audit(Actor, q.Id, "update_game_question", $"Updated question '{q.QuestionText}'");
     await db.SaveChangesAsync(ct);

     return new GameQuestionDto(q.Id, q.QuestionText, input.Options, q.Category, q.IsActive, q.Version, q.CreatedAtUtc);
 }

 [HttpDelete("game-questions/{id:guid}")]
 public async Task<IActionResult> DeleteGameQuestion(Guid id, CancellationToken ct)
 {
     var q = await db.Set<GameQuestion>().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new AuthFailure(404, "question_not_found");
     q.IsActive = false;
     q.UpdatedAtUtc = DateTimeOffset.UtcNow;
     service.Audit(Actor, q.Id, "deactivate_game_question", $"Deactivated question '{q.QuestionText}'");
     await db.SaveChangesAsync(ct);
     return NoContent();
 }

 [HttpGet("telegram-stats")]
 public async Task<Dating.Api.Features.Notifications.TelegramStatsDto> TelegramStats(CancellationToken ct)
     => await telegramNotifications.GetStatsAsync(ct);

 [HttpPost("broadcast-telegram"), RequestSizeLimit(8192)]
 public async Task<Dating.Api.Features.Notifications.TelegramBroadcastResult> BroadcastTelegram([FromBody] Dating.Api.Features.Notifications.TelegramBroadcastRequest input, CancellationToken ct)
 {
     if (string.IsNullOrWhiteSpace(input.Message))
         throw new AuthFailure(400, "message_required");

     var result = await telegramNotifications.BroadcastAsync(input, ct);
     service.Audit(Actor, Guid.NewGuid(), "telegram_broadcast", $"Broadcast sent: {result.SuccessCount} ok, {result.BlockedCount} blocked, {result.FailedCount} failed");
     await db.SaveChangesAsync(ct);
     return result;
 }

 [HttpGet("transactions")]
 public async Task<AdminTransactionsResponse> Transactions(
     [FromQuery] string? category = "all",
     [FromQuery] string? search = null,
     [FromQuery] int page = 1,
     [FromQuery] int pageSize = 50,
     CancellationToken ct = default)
 {
     var now = DateTimeOffset.UtcNow;
     var normCategory = (category ?? "all").Trim().ToLowerInvariant();
     var term = (search ?? "").Trim().ToLowerInvariant();
     var safePage = Math.Max(1, page);
     var safePageSize = Math.Clamp(pageSize, 1, 100);
     var skip = (safePage - 1) * safePageSize;

     // 1. Overall stats
     var totalSubscriptionsCount = await db.Set<UserSubscription>().CountAsync(ct);
     var totalActiveSubscriptionsCount = await db.Set<UserSubscription>()
         .CountAsync(s => s.IsActive && (s.ExpiresAtUtc == null || s.ExpiresAtUtc > now), ct);

     var subGelRevenue = await db.Set<UserSubscription>()
         .Where(s => s.Currency == "GEL")
         .SumAsync(s => (decimal?)s.PriceAmount, ct) ?? 0m;

     var subStarsRevenue = await db.Set<UserSubscription>()
         .Where(s => s.Currency == "XTR")
         .SumAsync(s => (int?)s.PriceAmount, ct) ?? 0;

     var storeGelRevenue = await db.Set<StorePurchase>()
         .Where(s => s.Status == "Credited" && s.PriceCurrency == "GEL" && s.PriceAmount != null)
         .SumAsync(s => s.PriceAmount, ct) ?? 0m;

     var storeStarsRevenue = await db.Set<StorePurchase>()
         .Where(s => s.Status == "Credited" && s.PriceCurrency == "XTR" && s.PriceAmount != null)
         .SumAsync(s => (int?)s.PriceAmount, ct) ?? 0;

     var totalCrystalsSold = await db.Set<StorePurchase>()
         .Where(s => s.Status == "Credited")
         .SumAsync(s => (int?)s.Amount, ct) ?? 0;

     var payingUsersCount = await db.Set<UserSubscription>()
         .Select(s => s.UserId)
         .Union(db.Set<StorePurchase>().Where(s => s.Status == "Credited").Select(p => p.UserId))
         .Distinct()
         .CountAsync(ct);

     var stats = new AdminTransactionsStatsDto(
         TotalRevenueGel: subGelRevenue + storeGelRevenue,
         TotalRevenueStars: subStarsRevenue + storeStarsRevenue,
         TotalSubscriptionsCount: totalSubscriptionsCount,
         TotalActiveSubscriptionsCount: totalActiveSubscriptionsCount,
         TotalCrystalsSold: totalCrystalsSold,
         TotalPayingUsersCount: payingUsersCount
     );

     // 2. Search IDs
     List<Guid>? matchingUserIds = null;
     if (!string.IsNullOrEmpty(term))
     {
         matchingUserIds = await (
             from u in db.Users.AsNoTracking()
             join p in db.Set<DatingProfile>().AsNoTracking() on u.Id equals p.UserId into profs
             from p in profs.DefaultIfEmpty()
             where (u.Email != null && u.Email.ToLower().Contains(term)) ||
                   (p != null && p.DisplayName != null && p.DisplayName.ToLower().Contains(term))
             select u.Id
         ).Distinct().ToListAsync(ct);
     }

     var includeSubs = normCategory is "all" or "purchases" or "subscriptions" or "subscription" or "everything";
     var includePurchases = normCategory is "all" or "purchases" or "crystals" or "crystal_purchase" or "everything";
     var includeSpends = normCategory is "spends" or "crystal_spend" or "everything";

     var allItems = new List<RawTxRecord>();
     var totalCount = 0;

     if (includeSubs)
     {
         var sq = db.Set<UserSubscription>().AsNoTracking();
         if (!string.IsNullOrEmpty(term))
         {
             sq = sq.Where(s => (matchingUserIds != null && matchingUserIds.Contains(s.UserId)) ||
                                (s.TransactionId != null && s.TransactionId.ToLower().Contains(term)) ||
                                s.PackageId.ToLower().Contains(term) ||
                                s.Platform.ToLower().Contains(term));
         }

         var subCount = await sq.CountAsync(ct);
         if (!includePurchases && !includeSpends)
         {
             totalCount = subCount;
             var list = await sq.OrderByDescending(s => s.CreatedAtUtc).Skip(skip).Take(safePageSize).ToListAsync(ct);
             allItems.AddRange(list.Select(s => new RawTxRecord(
                 s.Id.ToString(),
                 s.UserId,
                 "subscription",
                 FormatSubscriptionTitle(s.PackageId),
                 "VIP პრემიუმ გამოწერა (Arena Black)",
                 s.PriceAmount,
                 s.Currency,
                 null,
                 s.Platform,
                 !s.IsActive ? "inactive" : (s.ExpiresAtUtc == null || s.ExpiresAtUtc > now ? "active" : "expired"),
                 s.TransactionId,
                 s.CreatedAtUtc,
                 s.ExpiresAtUtc
             )));
         }
         else
         {
             totalCount += subCount;
             var list = await sq.OrderByDescending(s => s.CreatedAtUtc).Take(skip + safePageSize).ToListAsync(ct);
             allItems.AddRange(list.Select(s => new RawTxRecord(
                 s.Id.ToString(),
                 s.UserId,
                 "subscription",
                 FormatSubscriptionTitle(s.PackageId),
                 "VIP პრემიუმ გამოწერა (Arena Black)",
                 s.PriceAmount,
                 s.Currency,
                 null,
                 s.Platform,
                 !s.IsActive ? "inactive" : (s.ExpiresAtUtc == null || s.ExpiresAtUtc > now ? "active" : "expired"),
                 s.TransactionId,
                 s.CreatedAtUtc,
                 s.ExpiresAtUtc
             )));
         }
     }

     if (includePurchases)
     {
         var pq = db.Set<StorePurchase>().AsNoTracking();
         if (!string.IsNullOrEmpty(term))
         {
             pq = pq.Where(p => (matchingUserIds != null && matchingUserIds.Contains(p.UserId)) ||
                                (p.TransactionId != null && p.TransactionId.ToLower().Contains(term)) ||
                                p.ProductId.ToLower().Contains(term) ||
                                p.Platform.ToLower().Contains(term));
         }

         var purchaseCount = await pq.CountAsync(ct);
         if (!includeSubs && !includeSpends)
         {
             totalCount = purchaseCount;
             var list = await pq.OrderByDescending(p => p.CreatedAtUtc).Skip(skip).Take(safePageSize).ToListAsync(ct);
             allItems.AddRange(list.Select(p => new RawTxRecord(
                 p.Id.ToString(),
                 p.UserId,
                 "crystal_purchase",
                 FormatCrystalProductTitle(p.ProductId, p.Amount),
                 $"მაღაზიიდან კრისტალების პაკეტი ({p.Amount} 💎)",
                 p.PriceAmount,
                 p.PriceCurrency ?? "GEL",
                 p.Amount,
                 p.Platform,
                 p.Status == "Refunded" ? "refunded" : "completed",
                 p.TransactionId,
                 p.CreatedAtUtc,
                 null
             )));
         }
         else
         {
             totalCount += purchaseCount;
             var list = await pq.OrderByDescending(p => p.CreatedAtUtc).Take(skip + safePageSize).ToListAsync(ct);
             allItems.AddRange(list.Select(p => new RawTxRecord(
                 p.Id.ToString(),
                 p.UserId,
                 "crystal_purchase",
                 FormatCrystalProductTitle(p.ProductId, p.Amount),
                 $"მაღაზიიდან კრისტალების პაკეტი ({p.Amount} 💎)",
                 p.PriceAmount,
                 p.PriceCurrency ?? "GEL",
                 p.Amount,
                 p.Platform,
                 p.Status == "Refunded" ? "refunded" : "completed",
                 p.TransactionId,
                 p.CreatedAtUtc,
                 null
             )));
         }
     }

     if (includeSpends)
     {
         var tq = db.Set<CrystalTransaction>().AsNoTracking();
         if (!string.IsNullOrEmpty(term))
         {
             tq = tq.Where(t => (matchingUserIds != null && matchingUserIds.Contains(t.UserId)) ||
                                (t.Description != null && t.Description.ToLower().Contains(term)) ||
                                t.Type.ToLower().Contains(term));
         }

         var spendCount = await tq.CountAsync(ct);
         if (!includeSubs && !includePurchases)
         {
             totalCount = spendCount;
             var list = await tq.OrderByDescending(t => t.CreatedAtUtc).Skip(skip).Take(safePageSize).ToListAsync(ct);
             allItems.AddRange(list.Select(t => new RawTxRecord(
                 t.Id.ToString(),
                 t.UserId,
                 "crystal_spend",
                 FormatSpendTitle(t.Type),
                 t.Description ?? $"კრისტალების მოძრაობა ({t.Amount:+0;-#})",
                 null,
                 null,
                 t.Amount,
                 "In-App",
                 "completed",
                 t.ReferenceId ?? t.IdempotencyKey,
                 t.CreatedAtUtc,
                 null
             )));
         }
         else
         {
             totalCount += spendCount;
             var list = await tq.OrderByDescending(t => t.CreatedAtUtc).Take(skip + safePageSize).ToListAsync(ct);
             allItems.AddRange(list.Select(t => new RawTxRecord(
                 t.Id.ToString(),
                 t.UserId,
                 "crystal_spend",
                 FormatSpendTitle(t.Type),
                 t.Description ?? $"კრისტალების მოძრაობა ({t.Amount:+0;-#})",
                 null,
                 null,
                 t.Amount,
                 "In-App",
                 "completed",
                 t.ReferenceId ?? t.IdempotencyKey,
                 t.CreatedAtUtc,
                 null
             )));
         }
     }

     List<RawTxRecord> pageItems;
     if (normCategory is "subscriptions" or "subscription" or "crystals" or "crystal_purchase" or "spends" or "crystal_spend")
     {
         pageItems = allItems;
     }
     else
     {
         pageItems = allItems.OrderByDescending(x => x.CreatedAtUtc).Skip(skip).Take(safePageSize).ToList();
     }

     var pageUserIds = pageItems.Select(x => x.UserId).Distinct().ToList();

     var userEmails = await db.Users.AsNoTracking()
         .Where(u => pageUserIds.Contains(u.Id))
         .ToDictionaryAsync(u => u.Id, u => u.Email ?? "", ct);

     var userProfiles = await db.Set<DatingProfile>().AsNoTracking()
         .Where(p => pageUserIds.Contains(p.UserId))
         .ToDictionaryAsync(p => p.UserId, p => p.DisplayName, ct);

     var userPhotos = await db.Set<ProfilePhoto>().AsNoTracking()
         .Where(ph => pageUserIds.Contains(ph.UserId) && !ph.Deleted)
         .OrderBy(ph => ph.Position)
         .ToListAsync(ct);

     var primaryPhotos = userPhotos
         .GroupBy(ph => ph.UserId)
         .ToDictionary(g => g.Key, g => (Guid?)g.First().Id);

     var finalItems = pageItems.Select(x => new AdminTransactionDto(
         Id: x.Id,
         UserId: x.UserId,
         UserEmail: userEmails.GetValueOrDefault(x.UserId, ""),
         UserDisplayName: userProfiles.GetValueOrDefault(x.UserId, "მომხმარებელი"),
         PrimaryPhotoId: primaryPhotos.GetValueOrDefault(x.UserId),
         Category: x.Category,
         ItemTitle: x.ItemTitle,
         ItemDescription: x.ItemDescription,
         PriceAmount: x.PriceAmount,
         Currency: x.Currency,
         Crystals: x.Crystals,
         Platform: x.Platform,
         Status: x.Status,
         TransactionId: x.TransactionId,
         CreatedAtUtc: x.CreatedAtUtc,
         ExpiresAtUtc: x.ExpiresAtUtc
     )).ToArray();

     return new AdminTransactionsResponse(
         Items: finalItems,
         TotalCount: totalCount,
         Page: safePage,
         PageSize: safePageSize,
         Stats: stats
     );
 }

 private static string FormatSubscriptionTitle(string packageId) => packageId.ToLowerInvariant() switch
 {
     "two_weeks" => "Arena Black (2 კვირა VIP)",
     "one_month" => "Arena Black (1 თვე VIP)",
     "three_months" => "Arena Black (3 თვე VIP)",
     "lifetime" => "Arena Black (სამუდამო VIP)",
     _ => $"Arena Black ({packageId})"
 };

 private static string FormatCrystalProductTitle(string productId, int amount) => productId.ToLowerInvariant() switch
 {
     "dating.crystals.100" => "100 💎 კრისტალი",
     "dating.crystals.500" => "500 💎 კრისტალი",
     "dating.crystals.1200" => "1,200 💎 კრისტალი",
     "dating.crystals.2500" => "2,500 💎 კრისტალი",
     _ => $"{amount:N0} 💎 კრისტალი"
 };

 private static string FormatSpendTitle(string type) => type.ToLowerInvariant() switch
 {
     "gift" => "საჩუქრის გაგზავნა 🎁",
     "profile_unlock" => "პროფილის გახსნა 🔓",
     "match_unlock" => "ჩატის გახსნა 💬",
     "super_like" => "სუპერ ლაიქი ⭐",
     "admin_adjust" or "admin_grant" => "ადმინის კორექტირება 🛠️",
     "signup_bonus" => "რეგისტრაციის ბონუსი 🎉",
     "store_purchase" => "კრისტალების ყიდვა 💎",
     "store_refund" => "კრისტალების დაბრუნება ↩️",
     _ => type
 };

 private sealed record RawTxRecord(
     string Id,
     Guid UserId,
     string Category,
     string ItemTitle,
     string ItemDescription,
     decimal? PriceAmount,
     string? Currency,
     int? Crystals,
     string Platform,
     string Status,
     string? TransactionId,
     DateTimeOffset CreatedAtUtc,
     DateTimeOffset? ExpiresAtUtc
 );
}

