using Dating.Api.Features.AccountLifecycle;
using Dating.Api.Features.Notifications;
using Dating.Api.Features.Chat;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Auth.Email;
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
    }
}
