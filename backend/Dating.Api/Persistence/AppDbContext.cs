using Dating.Api.Features.AccountLifecycle;
using Dating.Api.Features.Notifications;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Auth.Email;
using Dating.Api.Features.Game;
using Dating.Api.Features.TodayPlans;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Dating.Api.Persistence;
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<AuthSession> Sessions => Set<AuthSession>();
    public DbSet<RefreshCredential> RefreshCredentials => Set<RefreshCredential>();
    public DbSet<AuthEmail> AuthEmails => Set<AuthEmail>();
    public DbSet<AccountDeletionJob> AccountDeletionJobs => Set<AccountDeletionJob>();
    public DbSet<DeletionTombstone> DeletionTombstones => Set<DeletionTombstone>();
    public DbSet<GameRoom> GameRooms => Set<GameRoom>();
    public DbSet<GameMembership> GameMemberships => Set<GameMembership>();
    public DbSet<GameOutboxEvent> GameOutboxEvents => Set<GameOutboxEvent>();
    public DbSet<GameQuestion> GameQuestions => Set<GameQuestion>();
    public DbSet<GameRound> GameRounds => Set<GameRound>();
    public DbSet<GameRoundAnswer> GameRoundAnswers => Set<GameRoundAnswer>();
    public DbSet<GameKiss> GameKisses => Set<GameKiss>();
    public DbSet<UserGameSettings> UserGameSettings => Set<UserGameSettings>();
    public DbSet<Dating.Api.Features.Game.Wallet.UserWallet> UserWallets => Set<Dating.Api.Features.Game.Wallet.UserWallet>();
    public DbSet<Dating.Api.Features.Game.Wallet.CrystalTransaction> CrystalTransactions => Set<Dating.Api.Features.Game.Wallet.CrystalTransaction>();
    public DbSet<Dating.Api.Features.Game.Wallet.GameProfileUnlock> GameProfileUnlocks => Set<Dating.Api.Features.Game.Wallet.GameProfileUnlock>();
    public DbSet<Dating.Api.Features.Game.Wallet.GameProfileViewNotice> GameProfileViewNotices => Set<Dating.Api.Features.Game.Wallet.GameProfileViewNotice>();
    public DbSet<Dating.Api.Features.Game.Wallet.StorePurchase> StorePurchases => Set<Dating.Api.Features.Game.Wallet.StorePurchase>();
    public DbSet<UserProfileView> UserProfileViews => Set<UserProfileView>();
    public DbSet<GameDirectMatchRequest> GameDirectMatchRequests => Set<GameDirectMatchRequest>();
    public DbSet<Dating.Api.Features.Game.Wallet.GameGift> GameGifts => Set<Dating.Api.Features.Game.Wallet.GameGift>();
    public DbSet<Dating.Api.Features.Premium.UserSubscription> UserSubscriptions => Set<Dating.Api.Features.Premium.UserSubscription>();
    public DbSet<DiscoverySuperLike> DiscoverySuperLikes => Set<DiscoverySuperLike>();
    public DbSet<TelegramSubscriber> TelegramSubscribers => Set<TelegramSubscriber>();
    public DbSet<TodayPlan> TodayPlans => Set<TodayPlan>();
    public DbSet<TodayPlanResponse> TodayPlanResponses => Set<TodayPlanResponse>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Dating.Api.Features.Moderation.StaffAccount>().HasKey(s=>s.UserId);
        modelBuilder.Entity<Dating.Api.Features.Moderation.AdminMfaUse>().HasKey(s=>new{s.UserId,s.CodeHash});
        modelBuilder.Entity<Dating.Api.Features.Moderation.StaffAccount>().HasOne<AppUser>().WithMany().HasForeignKey(s=>s.UserId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Dating.Api.Features.Moderation.AdminSession>().HasOne<AppUser>().WithMany().HasForeignKey(s=>s.UserId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Dating.Api.Features.Moderation.AdminSession>().HasIndex(s=>s.UserId);
        modelBuilder.Entity<Dating.Api.Features.Moderation.ModerationAudit>().HasIndex(a=>a.At);
        modelBuilder.Entity<PushDevice>().HasIndex(d=>d.TokenHash).IsUnique().HasFilter("\"TokenHash\" <> ''");
        modelBuilder.Entity<PushDevice>().HasIndex(d=>d.UserId);
        modelBuilder.Entity<PushDevice>().HasOne<AuthSession>().WithMany().HasForeignKey(d=>d.SessionId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PushPreference>().HasKey(p=>p.UserId);
        modelBuilder.Entity<PushPreference>().HasOne<AppUser>().WithMany().HasForeignKey(p=>p.UserId);
        modelBuilder.Entity<PushDelivery>().HasIndex(d=>new {d.EventId,d.Kind,d.DeviceId,d.DeviceRevision}).IsUnique();
        modelBuilder.Entity<PushDelivery>().HasIndex(d=>d.NextAttemptAt).HasFilter("\"FinishedAt\" IS NULL AND \"DeadLetterAt\" IS NULL");
        modelBuilder.Entity<PushDelivery>().HasOne<PushDevice>().WithMany().HasForeignKey(d=>d.DeviceId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PushDelivery>().HasOne<Conversation>().WithMany().HasForeignKey(d=>d.ConversationId);

        modelBuilder.Entity<Dating.Api.Features.Safety.SafetyReceipt>().HasKey(r=>new {r.ActorId,r.RequestId});
        modelBuilder.Entity<Dating.Api.Features.Safety.SafetyReceipt>().HasIndex(r=>r.CreatedAt);
        modelBuilder.Entity<Dating.Api.Features.Safety.SafetyReport>().HasIndex(r=>new {r.ReporterId,r.CreatedAt});
        modelBuilder.Entity<Dating.Api.Features.Safety.SafetyReport>().HasIndex(r=>r.DeleteAfter);
        modelBuilder.Entity<ChatEvent>().Property(e=>e.Kind).HasDefaultValue("changed");
        modelBuilder.Entity<ChatMessage>().HasIndex(m=>new {m.ConversationId,m.Sequence}).IsUnique();
        modelBuilder.Entity<ChatMessage>().HasIndex(m=>new {m.SenderId,m.ConversationId,m.ClientMessageId}).IsUnique();
        modelBuilder.Entity<ChatMessage>().HasIndex(m=>new {m.SenderId,m.SentAt});
        modelBuilder.Entity<ChatMessage>().Property(m=>m.Text).HasMaxLength(2000);
        modelBuilder.Entity<ChatMessage>().HasOne<Conversation>().WithMany().HasForeignKey(m=>m.ConversationId);
        modelBuilder.Entity<ChatMessage>().HasOne<AppUser>().WithMany().HasForeignKey(m=>m.SenderId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ChatRead>().HasKey(r=>new {r.ConversationId,r.UserId});
        modelBuilder.Entity<ChatRead>().HasOne<Conversation>().WithMany().HasForeignKey(r=>r.ConversationId);
        modelBuilder.Entity<ChatRead>().HasOne<AppUser>().WithMany().HasForeignKey(r=>r.UserId);
        modelBuilder.Entity<ChatEvent>().HasOne<Conversation>().WithMany().HasForeignKey(e=>e.ConversationId);
        modelBuilder.Entity<ChatEvent>().HasIndex(e=>e.NextAttemptAt).HasFilter("\"ProcessedAt\" IS NULL AND \"DeadLetterAt\" IS NULL");

        modelBuilder.Entity<DiscoveryDecision>().ToTable(t => {
            t.HasCheckConstraint("CK_Decision_Kind", "\"Kind\" IN ('like','pass')");
            t.HasCheckConstraint("CK_Decision_Self", "\"UserId\" <> \"TargetId\"");
        });
        modelBuilder.Entity<SwipeReceipt>().HasKey(r => new { r.UserId, r.RequestId });
        modelBuilder.Entity<SwipeReceipt>().HasIndex(r => new { r.UserId, r.TargetId }).IsUnique();
        modelBuilder.Entity<SwipeReceipt>().HasOne<AppUser>().WithMany().HasForeignKey(r=>r.UserId);
        modelBuilder.Entity<SwipeReceipt>().HasOne<DatingMatch>().WithMany().HasForeignKey(r=>r.MatchId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<DatingMatch>().HasIndex(m=>new {m.FirstId,m.SecondId}).IsUnique();
        modelBuilder.Entity<DatingMatch>().ToTable(t=>t.HasCheckConstraint("CK_Match_Ordered", "\"FirstId\" < \"SecondId\""));
        modelBuilder.Entity<DatingMatch>().HasOne<AppUser>().WithMany().HasForeignKey(m=>m.FirstId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<DatingMatch>().HasOne<AppUser>().WithMany().HasForeignKey(m=>m.SecondId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<DatingMatch>().Property(m => m.Origin).HasMaxLength(30).HasDefaultValue("Discovery");
        modelBuilder.Entity<DatingMatch>().Property(m => m.HasChatEntitlement).HasDefaultValue(true);
        modelBuilder.Entity<Conversation>().HasIndex(c=>c.MatchId).IsUnique();
        modelBuilder.Entity<Conversation>().HasOne<DatingMatch>().WithOne().HasForeignKey<Conversation>(c=>c.MatchId);
        modelBuilder.Entity<MatchEvent>().HasIndex(e=>e.MatchId).IsUnique();
        modelBuilder.Entity<MatchEvent>().HasIndex(e=>e.CreatedAt).HasFilter("\"ProcessedAt\" IS NULL");
        modelBuilder.Entity<MatchEvent>().HasOne<DatingMatch>().WithOne().HasForeignKey<MatchEvent>(e=>e.MatchId);
        modelBuilder.Entity<MatchNotice>().HasKey(n=>new {n.EventId,n.UserId});
        modelBuilder.Entity<MatchNotice>().HasOne<MatchEvent>().WithMany().HasForeignKey(n=>n.EventId);
        modelBuilder.Entity<MatchNotice>().HasOne<AppUser>().WithMany().HasForeignKey(n=>n.UserId);
        modelBuilder.Entity<MatchNotice>().HasOne<DatingMatch>().WithMany().HasForeignKey(n=>n.MatchId);

        modelBuilder.Entity<DatingProfile>().HasKey(p => p.UserId);
        modelBuilder.Entity<DatingProfile>().Property(p => p.DiscoverySequence).UseIdentityByDefaultColumn();
        modelBuilder.Entity<DatingProfile>().HasIndex(p => p.DiscoverySequence).IsUnique();
        modelBuilder.Entity<DatingProfile>().HasIndex(p => p.CityKey);
        modelBuilder.Entity<DatingProfile>().Property(p => p.Location).HasColumnType("geography (point, 4326)");
        modelBuilder.Entity<DatingProfile>().HasIndex(p => p.Location).HasMethod("gist");
        modelBuilder.Entity<DiscoveryDecision>().HasKey(p => new { p.UserId, p.TargetId });
        modelBuilder.Entity<UnmatchedPair>().HasKey(p => new { p.FirstId, p.SecondId });
        modelBuilder.Entity<DatingProfile>().HasOne(p => p.User).WithOne().HasForeignKey<DatingProfile>(p => p.UserId);
        modelBuilder.Entity<DatingProfile>().Property(p => p.DisplayName).HasMaxLength(50);
        modelBuilder.Entity<DatingProfile>().Property(p => p.Bio).HasMaxLength(500);
        modelBuilder.Entity<DatingProfile>().Property(p => p.City).HasMaxLength(80);
        modelBuilder.Entity<ProfilePhoto>().HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId);
        modelBuilder.Entity<ProfilePhoto>().HasIndex(p => new { p.UserId, p.RequestId }).IsUnique();
        modelBuilder.Entity<ProfilePhoto>().HasIndex(p => new { p.UserId, p.Position }).IsUnique().HasFilter("NOT \"Deleted\"");
        modelBuilder.Entity<ProfilePhoto>().HasIndex(p => p.CreatedAt);
        modelBuilder.Entity<UserBlock>().HasKey(p => new { p.BlockerId, p.BlockedId });
        modelBuilder.HasPostgresExtension("postgis");
        modelBuilder.Entity<AppUser>().HasIndex(u => u.NormalizedEmail).IsUnique();
        modelBuilder.Entity<AppUser>().Property(u => u.DateOfBirth).HasColumnType("date");
        modelBuilder.Entity<AuthSession>().HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId);
        modelBuilder.Entity<AuthSession>().HasIndex(s => s.UserId);
        modelBuilder.Entity<RefreshCredential>().HasKey(r => r.Hash);
        modelBuilder.Entity<RefreshCredential>().Property(r => r.Hash).HasMaxLength(64);
        modelBuilder.Entity<RefreshCredential>().HasOne(r => r.Session).WithMany().HasForeignKey(r => r.SessionId);
        modelBuilder.Entity<AuthEmail>().HasIndex(e => e.NextAttemptAt);

        modelBuilder.Entity<AccountDeletionJob>().HasKey(j => j.Id);
        modelBuilder.Entity<AccountDeletionJob>().HasIndex(j => j.NextAttemptAt).HasFilter("\"CompletedAt\" IS NULL");
        modelBuilder.Entity<AccountDeletionJob>().HasIndex(j => j.UserId);
        modelBuilder.Entity<AccountDeletionJob>().Property(j => j.State).HasMaxLength(32);
        modelBuilder.Entity<AccountDeletionJob>().Property(j => j.LastError).HasMaxLength(1024);

        modelBuilder.Entity<DeletionTombstone>().HasKey(t => t.UserId);
        modelBuilder.Entity<DeletionTombstone>().HasIndex(t => t.EmailHash);
        modelBuilder.Entity<DeletionTombstone>().Property(t => t.EmailHash).HasMaxLength(64);

        modelBuilder.Entity<GameRoom>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Title).HasMaxLength(60);
            entity.Property(r => r.State).HasConversion<string>().HasMaxLength(20);
            entity.HasIndex(r => r.State);
            entity.HasIndex(r => r.CreatedAtUtc);
        });

        modelBuilder.Entity<GameMembership>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Gender).HasMaxLength(20);
            entity.Property(m => m.Status).HasConversion<string>().HasMaxLength(20);
            entity.HasOne(m => m.Room).WithMany(r => r.Memberships).HasForeignKey(m => m.RoomId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(m => new { m.RoomId, m.Status });
            entity.HasIndex(m => m.UserId).IsUnique().HasFilter("\"Status\" IN ('Active', 'Disconnected')");
        });

        modelBuilder.Entity<GameOutboxEvent>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EventType).HasMaxLength(50);
            entity.HasIndex(e => new { e.RoomId, e.Sequence }).IsUnique();
            entity.HasIndex(e => e.DispatchedAtUtc).HasFilter("\"DispatchedAtUtc\" IS NULL");
        });

        modelBuilder.Entity<GameQuestion>(entity =>
        {
            entity.HasKey(q => q.Id);
            entity.Property(q => q.QuestionText).HasMaxLength(300);
            entity.Property(q => q.Category).HasMaxLength(50);
            entity.HasIndex(q => q.IsActive);
        });

        modelBuilder.Entity<GameRound>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.State).HasMaxLength(30);
            entity.HasOne(r => r.Room).WithMany().HasForeignKey(r => r.RoomId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(r => r.RoomId);
        });

        modelBuilder.Entity<GameRoundAnswer>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.IdempotencyKey).HasMaxLength(64);
            entity.HasOne(a => a.Round).WithMany(r => r.Answers).HasForeignKey(a => a.RoundId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(a => new { a.RoundId, a.QuestionIndex, a.UserId }).IsUnique();
            entity.HasIndex(a => new { a.RoundId, a.QuestionIndex, a.IdempotencyKey }).IsUnique();
        });

        modelBuilder.Entity<GameKiss>(entity =>
        {
            entity.HasKey(k => k.Id);
            entity.Property(k => k.Status).HasMaxLength(20);
            entity.Property(k => k.IdempotencyKey).HasMaxLength(64);
            entity.HasOne(k => k.Room).WithMany().HasForeignKey(k => k.RoomId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(k => k.Round).WithMany(r => r.Kisses).HasForeignKey(k => k.RoundId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(k => new { k.RoomId, k.SenderUserId, k.RecipientUserId });
            entity.HasIndex(k => new { k.RoundId, k.SenderUserId, k.IdempotencyKey }).IsUnique();
        });

        modelBuilder.Entity<UserGameSettings>(entity =>
        {
            entity.HasKey(s => s.UserId);
            entity.HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Dating.Api.Features.Game.Wallet.UserWallet>(entity =>
        {
            entity.HasKey(w => w.UserId);
            entity.HasOne(w => w.User).WithMany().HasForeignKey(w => w.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.ToTable(t =>
            {
                t.HasCheckConstraint("CK_UserWallets_Balance", "\"Balance\" >= 0");
                t.HasCheckConstraint("CK_UserWallets_OutstandingDebt", "\"OutstandingDebt\" >= 0");
            });
            entity.Property(w => w.Version).IsRowVersion();
        });

        modelBuilder.Entity<Dating.Api.Features.Game.Wallet.StorePurchase>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Platform).HasMaxLength(20);
            entity.Property(p => p.ProductId).HasMaxLength(64);
            entity.Property(p => p.TransactionId).HasMaxLength(128);
            entity.Property(p => p.PurchaseToken).HasMaxLength(4096);
            entity.Property(p => p.Status).HasMaxLength(20);
            entity.Property(p => p.PriceCurrency).HasMaxLength(10);
            entity.Property(p => p.Environment).HasMaxLength(20);
            entity.Property(p => p.RefundReason).HasMaxLength(200);
            entity.HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(p => new { p.Platform, p.TransactionId }).IsUnique();
            entity.HasIndex(p => p.UserId);
        });

        modelBuilder.Entity<Dating.Api.Features.Game.Wallet.CrystalTransaction>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Type).HasMaxLength(30);
            entity.Property(t => t.ReferenceId).HasMaxLength(64);
            entity.Property(t => t.IdempotencyKey).HasMaxLength(64);
            entity.Property(t => t.Description).HasMaxLength(200);
            entity.HasOne(t => t.User).WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(t => new { t.UserId, t.IdempotencyKey }).IsUnique();
            entity.HasIndex(t => new { t.UserId, t.CreatedAtUtc });
        });

        modelBuilder.Entity<Dating.Api.Features.Game.Wallet.GameProfileUnlock>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.HasOne(u => u.ViewerUser).WithMany().HasForeignKey(u => u.ViewerUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(u => u.TargetUser).WithMany().HasForeignKey(u => u.TargetUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(u => u.Transaction).WithMany().HasForeignKey(u => u.TransactionId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(u => new { u.ViewerUserId, u.TargetUserId }).IsUnique();
            entity.ToTable(t => t.HasCheckConstraint("CK_GameProfileUnlocks_NotSelf", "\"ViewerUserId\" <> \"TargetUserId\""));
        });

        modelBuilder.Entity<Dating.Api.Features.Game.Wallet.GameProfileViewNotice>(entity =>
        {
            entity.HasKey(n => n.Id);
            entity.Property(n => n.ViewerDisplayName).HasMaxLength(50);
            entity.HasOne(n => n.TargetUser).WithMany().HasForeignKey(n => n.TargetUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(n => new { n.TargetUserId, n.CreatedAtUtc });
        });

        modelBuilder.Entity<UserProfileView>(entity =>
        {
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => new { v.ViewerUserId, v.TargetUserId }).IsUnique();
            entity.HasIndex(v => new { v.TargetUserId, v.ViewedAt });
            entity.HasIndex(v => new { v.ViewerUserId, v.ViewedAt });
        });

        modelBuilder.Entity<GameDirectMatchRequest>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Message).HasMaxLength(300);
            entity.Property(r => r.Status).HasMaxLength(20);
            entity.Property(r => r.IdempotencyKey).HasMaxLength(64);
            entity.HasIndex(r => new { r.SenderUserId, r.TargetUserId }).IsUnique();
            entity.HasIndex(r => new { r.TargetUserId, r.Status });
            entity.HasIndex(r => r.RoomId);
        });

        modelBuilder.Entity<Dating.Api.Features.Game.Wallet.GameGift>(entity =>
        {
            entity.HasKey(g => g.Id);
            entity.Property(g => g.GiftId).HasMaxLength(50);
            entity.Property(g => g.GiftName).HasMaxLength(100);
            entity.Property(g => g.GiftIcon).HasMaxLength(20);
            entity.HasOne(g => g.SenderUser).WithMany().HasForeignKey(g => g.SenderUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(g => g.RecipientUser).WithMany().HasForeignKey(g => g.RecipientUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(g => g.Transaction).WithMany().HasForeignKey(g => g.TransactionId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(g => new { g.RecipientUserId, g.CreatedAtUtc });
            entity.HasIndex(g => new { g.SenderUserId, g.CreatedAtUtc });
            entity.HasIndex(g => g.RoomId);
            entity.ToTable(t => t.HasCheckConstraint("CK_GameGifts_NotSelf", "\"SenderUserId\" <> \"RecipientUserId\""));
        });

        modelBuilder.Entity<Dating.Api.Features.Premium.UserSubscription>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.PackageId).HasMaxLength(32);
            entity.Property(s => s.Currency).HasMaxLength(8);
            entity.Property(s => s.Platform).HasMaxLength(32);
            entity.Property(s => s.TransactionId).HasMaxLength(128);
            entity.HasIndex(s => s.UserId);
            entity.HasIndex(s => new { s.UserId, s.IsActive });
            entity.HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DiscoverySuperLike>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.HasIndex(s => new { s.SenderUserId, s.TargetUserId }).IsUnique();
            entity.HasIndex(s => new { s.TargetUserId, s.CreatedAtUtc });
            entity.HasIndex(s => new { s.SenderUserId, s.CreatedAtUtc });
            entity.HasOne<AppUser>().WithMany().HasForeignKey(s => s.SenderUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<AppUser>().WithMany().HasForeignKey(s => s.TargetUserId).OnDelete(DeleteBehavior.Cascade);
            entity.Property(s => s.Note).HasMaxLength(300);
            entity.ToTable(t => t.HasCheckConstraint("CK_DiscoverySuperLike_NotSelf", "\"SenderUserId\" <> \"TargetUserId\""));
        });

        modelBuilder.Entity<TelegramSubscriber>(entity =>
        {
            entity.HasKey(s => s.ChatId);
            entity.HasIndex(s => s.TelegramUserId);
            entity.HasIndex(s => s.UserId);
            entity.HasIndex(s => s.IsActive);
            entity.Property(s => s.Username).HasMaxLength(64);
            entity.Property(s => s.FirstName).HasMaxLength(128);
            entity.Property(s => s.LastName).HasMaxLength(128);
        });

        modelBuilder.Entity<TodayPlan>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.City).HasMaxLength(60).IsRequired();
            entity.Property(p => p.District).HasMaxLength(100);
            entity.Property(p => p.Activity).HasMaxLength(30).IsRequired();
            entity.Property(p => p.Title).HasMaxLength(100).IsRequired();
            entity.Property(p => p.Description).HasMaxLength(500);
            entity.Property(p => p.Currency).HasMaxLength(8).HasDefaultValue("GEL");
            entity.Property(p => p.State).HasMaxLength(20).HasDefaultValue("Open");
            entity.Property(p => p.Version).IsRowVersion();

            entity.HasIndex(p => new { p.City, p.Activity, p.State, p.ExpiresAtUtc });
            entity.HasIndex(p => new { p.AuthorUserId, p.State });
            entity.HasIndex(p => new { p.State, p.ExpiresAtUtc });
            entity.HasIndex(p => p.StartsAtUtc);

            entity.HasOne<AppUser>().WithMany().HasForeignKey(p => p.AuthorUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<AppUser>().WithMany().HasForeignKey(p => p.SelectedCompanionUserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<TodayPlanResponse>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Message).HasMaxLength(300);
            entity.Property(r => r.State).HasMaxLength(20).HasDefaultValue("Pending");

            entity.HasOne(r => r.Plan)
                .WithMany(p => p.Responses)
                .HasForeignKey(r => r.PlanId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne<AppUser>()
                .WithMany()
                .HasForeignKey(r => r.ApplicantUserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(r => new { r.PlanId, r.ApplicantUserId }).IsUnique();
            entity.HasIndex(r => new { r.ApplicantUserId, r.CreatedAtUtc });
            entity.HasIndex(r => new { r.PlanId, r.State });
        });
    }
}
