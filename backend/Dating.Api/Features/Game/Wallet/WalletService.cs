using Dating.Api.Features.Auth;
using Dating.Api.Features.Discovery;
using Dating.Api.Features.Matching;
using Dating.Api.Features.Profiles;
using Dating.Api.Features.Safety;
using Dating.Api.Persistence;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Dating.Api.Features.Game.Wallet;

public sealed class WalletService(
    AppDbContext db,
    TimeProvider clock,
    IHostEnvironment env,
    PairSynchronization pairs,
    IPlatformStoreValidator storeValidator,
    ILogger<WalletService> logger,
    IHubContext<GameHub>? hub = null,
    Dating.Api.Features.Notifications.ITelegramNotificationService? telegramNotifications = null)
{
    private async Task<int> GetBalanceOnlyAsync(Guid userId, CancellationToken ct)
    {
        var wallet = await db.Set<UserWallet>().AsNoTracking().SingleOrDefaultAsync(w => w.UserId == userId, ct);
        return wallet?.Balance ?? 0;
    }

    public async Task<WalletBalanceDto> GetWalletBalanceAsync(Guid userId, CancellationToken ct)
    {
        var wallet = await db.Set<UserWallet>().AsNoTracking().SingleOrDefaultAsync(w => w.UserId == userId, ct);
        var balance = wallet?.Balance ?? 0;

        var txs = await db.Set<CrystalTransaction>().AsNoTracking()
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAtUtc)
            .Take(20)
            .Select(t => new CrystalTransactionDto(
                t.Id,
                t.Amount,
                t.BalanceAfter,
                t.Type,
                t.ReferenceId,
                t.Description,
                t.CreatedAtUtc
            ))
            .ToArrayAsync(ct);

        return new WalletBalanceDto(balance, wallet?.OutstandingDebt ?? 0, txs);
    }

    public async Task<WalletBalanceDto> DevGrantAsync(Guid userId, DevGrantRequest request, CancellationToken ct)
    {
        if (!env.IsDevelopment() && !env.IsEnvironment("Testing"))
        {
            throw new AuthFailure(403, "dev_grants_disabled_in_production");
        }

        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new AuthFailure(400, "invalid_idempotency_key");
        }

        await using var dbTx = await db.Database.BeginTransactionAsync(ct);

        var existingTx = await db.Set<CrystalTransaction>().AsNoTracking()
            .SingleOrDefaultAsync(t => t.UserId == userId && t.IdempotencyKey == request.IdempotencyKey, ct);
        if (existingTx != null)
        {
            await dbTx.CommitAsync(ct);
            return await GetWalletBalanceAsync(userId, ct);
        }

        var wallet = await db.Set<UserWallet>()
            .FromSqlInterpolated($"""SELECT "UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc", xmin FROM "UserWallets" WHERE "UserId" = {userId} FOR UPDATE""")
            .SingleOrDefaultAsync(ct);

        if (wallet is null)
        {
            wallet = new UserWallet
            {
                UserId = userId,
                Balance = 0,
                OutstandingDebt = 0,
                UpdatedAtUtc = clock.GetUtcNow()
            };
            db.Add(wallet);
            await db.SaveChangesAsync(ct);
        }

        var debtRepaid = 0;
        if (wallet.OutstandingDebt > 0)
        {
            debtRepaid = Math.Min(wallet.OutstandingDebt, request.Amount);
            wallet.OutstandingDebt -= debtRepaid;
        }

        wallet.Balance += (request.Amount - debtRepaid);
        wallet.UpdatedAtUtc = clock.GetUtcNow();

        var tx = new CrystalTransaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Amount = request.Amount,
            BalanceAfter = wallet.Balance,
            Type = "DevGrant",
            ReferenceId = null,
            IdempotencyKey = request.IdempotencyKey,
            Description = $"ტესტური კრისტალები (+{request.Amount})",
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.Add(tx);

        await db.SaveChangesAsync(ct);
        await dbTx.CommitAsync(ct);

        logger.LogInformation("Granted {Amount} crystals to user {UserId}. New balance: {Balance}", request.Amount, userId, wallet.Balance);
        return await GetWalletBalanceAsync(userId, ct);
    }

    public async Task<UnlockMatchConversationResult> UnlockMatchConversationAsync(
        Guid userId,
        Guid matchId,
        UnlockMatchConversationRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new AuthFailure(400, "invalid_idempotency_key");
        }

        await using var dbTx = await db.Database.BeginTransactionAsync(ct);

        var match = await db.Set<DatingMatch>().SingleOrDefaultAsync(m => m.Id == matchId, ct);
        if (match is null || (match.FirstId != userId && match.SecondId != userId))
        {
            throw new AuthFailure(404, "match_unavailable");
        }

        await pairs.Lock(match.FirstId, match.SecondId, ct);
        await db.Entry(match).ReloadAsync(ct);

        if (!match.Active)
        {
            throw new AuthFailure(400, "match_inactive");
        }

        var isBlocked = await db.Set<UserBlock>().AnyAsync(b =>
            (b.BlockerId == match.FirstId && b.BlockedId == match.SecondId) ||
            (b.BlockerId == match.SecondId && b.BlockedId == match.FirstId), ct);
        if (isBlocked)
        {
            throw new AuthFailure(403, "pair_blocked");
        }

        var isUnmatched = await db.Set<UnmatchedPair>().AnyAsync(p =>
            (p.FirstId == match.FirstId && p.SecondId == match.SecondId) ||
            (p.FirstId == match.SecondId && p.SecondId == match.FirstId), ct);
        if (isUnmatched)
        {
            throw new AuthFailure(403, "pair_unmatched");
        }

        var conv = await db.Set<Conversation>().SingleAsync(c => c.MatchId == match.Id, ct);

        // If match already has chat entitlement (unlocked by partner in a race or by discovery swipe)
        if (match.HasChatEntitlement)
        {
            var bal = await GetBalanceOnlyAsync(userId, ct);
            await dbTx.CommitAsync(ct);
            return new UnlockMatchConversationResult(true, 0, bal, true, match.Id, conv.Id, "already_open");
        }

        // Check if idempotency key was already processed
        var existingTx = await db.Set<CrystalTransaction>().AsNoTracking()
            .SingleOrDefaultAsync(t => t.UserId == userId && t.IdempotencyKey == request.IdempotencyKey, ct);
        if (existingTx != null)
        {
            await dbTx.CommitAsync(ct);
            return new UnlockMatchConversationResult(true, 0, existingTx.BalanceAfter, true, match.Id, conv.Id, "already_open");
        }

        // Lock wallet and check balance
        var wallet = await db.Set<UserWallet>()
            .FromSqlInterpolated($"""SELECT "UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc", xmin FROM "UserWallets" WHERE "UserId" = {userId} FOR UPDATE""")
            .SingleOrDefaultAsync(ct);

        if (wallet is null || wallet.Balance < 25)
        {
            throw new AuthFailure(400, "insufficient_crystals");
        }

        wallet.Balance -= 25;
        wallet.UpdatedAtUtc = clock.GetUtcNow();

        var tx = new CrystalTransaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Amount = -25,
            BalanceAfter = wallet.Balance,
            Type = "MatchUnlock",
            ReferenceId = matchId.ToString(),
            IdempotencyKey = request.IdempotencyKey,
            Description = "არენის მატჩის ჩატის გახსნა (25 კრისტალი)",
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.Add(tx);

        match.HasChatEntitlement = true;

        await db.SaveChangesAsync(ct);
        await dbTx.CommitAsync(ct);

        logger.LogInformation("User {UserId} unlocked match {MatchId} for 25 crystals. New balance: {Balance}", userId, matchId, wallet.Balance);
        return new UnlockMatchConversationResult(true, 25, wallet.Balance, false, match.Id, conv.Id, "unlocked_successfully");
    }

    public async Task<UnlockProfileResult> UnlockProfileAsync(
        Guid viewerUserId,
        Guid targetUserId,
        UnlockProfileRequest request,
        CancellationToken ct)
    {
        if (viewerUserId == targetUserId)
        {
            throw new AuthFailure(400, "cannot_unlock_own_profile");
        }

        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new AuthFailure(400, "invalid_idempotency_key");
        }

        await using var dbTx = await db.Database.BeginTransactionAsync(ct);

        var (first, second) = PairSynchronization.Order(viewerUserId, targetUserId);
        await pairs.Lock(first, second, ct);

        var targetUser = await db.Users.SingleOrDefaultAsync(u => u.Id == targetUserId && u.IsActive && u.EmailConfirmed, ct);
        if (targetUser is null)
        {
            throw new AuthFailure(404, "target_user_unavailable");
        }

        var isBlocked = await db.Set<UserBlock>().AnyAsync(b =>
            (b.BlockerId == first && b.BlockedId == second) ||
            (b.BlockerId == second && b.BlockedId == first), ct);
        if (isBlocked)
        {
            throw new AuthFailure(403, "pair_blocked");
        }

        var isUnmatched = await db.Set<UnmatchedPair>().AnyAsync(p =>
            (p.FirstId == first && p.SecondId == second) ||
            (p.FirstId == second && p.SecondId == first), ct);
        if (isUnmatched)
        {
            throw new AuthFailure(403, "pair_unmatched");
        }

        var targetSettings = await db.Set<UserGameSettings>().SingleOrDefaultAsync(s => s.UserId == targetUserId, ct);
        if (targetSettings != null && !targetSettings.AllowProfileUnlockInArena)
        {
            throw new AuthFailure(403, "profile_unlock_disabled");
        }

        // Check if already unlocked
        var existingUnlock = await db.Set<GameProfileUnlock>().SingleOrDefaultAsync(u =>
            u.ViewerUserId == viewerUserId && u.TargetUserId == targetUserId, ct);
        if (existingUnlock != null)
        {
            var bal = await GetBalanceOnlyAsync(viewerUserId, ct);
            var profile = await GetFullGameProfileDtoAsync(viewerUserId, targetUserId, ct);
            await dbTx.CommitAsync(ct);
            return new UnlockProfileResult(true, 0, bal, true, "already_unlocked", profile);
        }

        // Check if idempotency key was already used
        var existingTx = await db.Set<CrystalTransaction>().AsNoTracking()
            .SingleOrDefaultAsync(t => t.UserId == viewerUserId && t.IdempotencyKey == request.IdempotencyKey, ct);
        if (existingTx != null)
        {
            var profile = await GetFullGameProfileDtoAsync(viewerUserId, targetUserId, ct);
            await dbTx.CommitAsync(ct);
            return new UnlockProfileResult(true, 0, existingTx.BalanceAfter, true, "already_unlocked", profile);
        }

        // Lock viewer wallet
        var wallet = await db.Set<UserWallet>()
            .FromSqlInterpolated($"""SELECT "UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc", xmin FROM "UserWallets" WHERE "UserId" = {viewerUserId} FOR UPDATE""")
            .SingleOrDefaultAsync(ct);

        if (wallet is null || wallet.Balance < 25)
        {
            throw new AuthFailure(400, "insufficient_crystals");
        }

        wallet.Balance -= 25;
        wallet.UpdatedAtUtc = clock.GetUtcNow();

        var tx = new CrystalTransaction
        {
            Id = Guid.NewGuid(),
            UserId = viewerUserId,
            Amount = -25,
            BalanceAfter = wallet.Balance,
            Type = "ProfileUnlock",
            ReferenceId = targetUserId.ToString(),
            IdempotencyKey = request.IdempotencyKey,
            Description = "სრული პროფილის გახსნა (25 კრისტალი)",
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.Add(tx);

        var unlock = new GameProfileUnlock
        {
            Id = Guid.NewGuid(),
            ViewerUserId = viewerUserId,
            TargetUserId = targetUserId,
            Cost = 25,
            TransactionId = tx.Id,
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.Add(unlock);

        var viewerProfile = await db.Set<DatingProfile>().SingleOrDefaultAsync(p => p.UserId == viewerUserId, ct);
        var notice = new GameProfileViewNotice
        {
            Id = Guid.NewGuid(),
            TargetUserId = targetUserId,
            ViewerUserId = viewerUserId,
            ViewerDisplayName = viewerProfile?.DisplayName ?? "არენის მოთამაშე",
            CreatedAtUtc = clock.GetUtcNow(),
            Seen = false
        };
        db.Add(notice);

        await db.SaveChangesAsync(ct);
        await dbTx.CommitAsync(ct);

        logger.LogInformation("User {Viewer} unlocked profile of {Target} for 25 crystals. New balance: {Balance}", viewerUserId, targetUserId, wallet.Balance);
        var unlockedProfile = await GetFullGameProfileDtoAsync(viewerUserId, targetUserId, ct);
        return new UnlockProfileResult(true, 25, wallet.Balance, false, "unlocked_successfully", unlockedProfile);
    }

    public async Task<GameProfileDto> GetGameProfileAsync(Guid viewerUserId, Guid targetUserId, CancellationToken ct)
    {
        var targetUser = await db.Users.SingleOrDefaultAsync(u => u.Id == targetUserId && u.IsActive && u.EmailConfirmed, ct);
        if (targetUser is null)
        {
            throw new AuthFailure(404, "profile_unavailable");
        }

        var (first, second) = PairSynchronization.Order(viewerUserId, targetUserId);
        var isBlocked = await db.Set<UserBlock>().AnyAsync(b =>
            (b.BlockerId == first && b.BlockedId == second) ||
            (b.BlockerId == second && b.BlockedId == first), ct);
        if (isBlocked)
        {
            throw new AuthFailure(404, "profile_unavailable");
        }

        var isUnmatched = await db.Set<UnmatchedPair>().AnyAsync(p =>
            (p.FirstId == first && p.SecondId == second) ||
            (p.FirstId == second && p.SecondId == first), ct);
        if (isUnmatched)
        {
            throw new AuthFailure(404, "profile_unavailable");
        }

        var isSelf = viewerUserId == targetUserId;
        var isDirectUnlocked = await db.Set<GameProfileUnlock>().AnyAsync(u =>
            u.ViewerUserId == viewerUserId && u.TargetUserId == targetUserId, ct);
        var isMatchedWithEntitlement = await db.Set<DatingMatch>().AnyAsync(m =>
            m.Active && m.HasChatEntitlement &&
            ((m.FirstId == viewerUserId && m.SecondId == targetUserId) ||
             (m.FirstId == targetUserId && m.SecondId == viewerUserId)), ct);

        var hasFullAccess = isSelf || isDirectUnlocked || isMatchedWithEntitlement;

        if (hasFullAccess)
        {
            return await GetFullGameProfileDtoAsync(viewerUserId, targetUserId, ct);
        }

        // Preview access: primary photo only, summary fields, no interests or relationship goal
        var profile = await db.Set<DatingProfile>().SingleOrDefaultAsync(p => p.UserId == targetUserId, ct);
        if (profile is null)
        {
            throw new AuthFailure(404, "profile_unavailable");
        }

        var primaryPhoto = await db.Set<ProfilePhoto>().AsNoTracking()
            .Where(p => p.UserId == targetUserId && !p.Deleted && p.State == "approved")
            .OrderBy(p => p.Position)
            .Select(p => new PhotoDto(p.Id, p.State, p.Position, p.Width, p.Height))
            .FirstOrDefaultAsync(ct);

        var photos = primaryPhoto is not null ? new[] { primaryPhoto } : Array.Empty<PhotoDto>();
        var age = ProfileRules.Age(targetUser.DateOfBirth, clock.GetUtcNow());

        // Bio snippet for preview (up to 80 chars)
        var bioSnippet = profile.Bio;
        if (bioSnippet.Length > 80)
        {
            bioSnippet = bioSnippet[..80] + "...";
        }

        return new GameProfileDto(
            UserId: targetUserId,
            DisplayName: profile.DisplayName,
            Age: age,
            City: profile.City,
            Bio: bioSnippet,
            Gender: profile.Gender,
            RelationshipGoal: "", // Masked in preview
            Interests: [], // Masked in preview
            Photos: photos,
            IsFullAccess: false,
            UnlockPrice: 25
        );
    }

    private async Task<GameProfileDto> GetFullGameProfileDtoAsync(Guid viewerUserId, Guid targetUserId, CancellationToken ct)
    {
        var targetUser = await db.Users.SingleAsync(u => u.Id == targetUserId, ct);
        var profile = await db.Set<DatingProfile>().SingleAsync(p => p.UserId == targetUserId, ct);

        var photos = await db.Set<ProfilePhoto>().AsNoTracking()
            .Where(p => p.UserId == targetUserId && !p.Deleted && p.State == "approved")
            .OrderBy(p => p.Position)
            .Select(p => new PhotoDto(p.Id, p.State, p.Position, p.Width, p.Height))
            .ToArrayAsync(ct);

        var age = ProfileRules.Age(targetUser.DateOfBirth, clock.GetUtcNow());

        var kissesCount = await db.Set<GameKiss>().AsNoTracking()
            .CountAsync(k => k.RecipientUserId == targetUserId, ct);

        var giftsCount = await db.Set<GameGift>().AsNoTracking()
            .CountAsync(g => g.RecipientUserId == targetUserId, ct);

        return new GameProfileDto(
            UserId: targetUserId,
            DisplayName: profile.DisplayName,
            Age: age,
            City: profile.City,
            Bio: profile.Bio,
            Gender: profile.Gender,
            RelationshipGoal: profile.RelationshipGoal,
            Interests: profile.Interests ?? [],
            Photos: photos,
            IsFullAccess: true,
            UnlockPrice: 0,
            KissesReceivedCount: kissesCount,
            GiftsReceivedCount: giftsCount
        );
    }

    public async Task<GameProfileViewNoticeDto[]> GetProfileViewNoticesAsync(Guid userId, CancellationToken ct)
    {
        return await db.Set<GameProfileViewNotice>().AsNoTracking()
            .Where(n => n.TargetUserId == userId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .Take(50)
            .Select(n => new GameProfileViewNoticeDto(
                n.Id,
                n.ViewerUserId,
                n.ViewerDisplayName,
                n.CreatedAtUtc,
                n.Seen
            ))
            .ToArrayAsync(ct);
    }

    public async Task AcknowledgeProfileViewNoticesAsync(Guid userId, CancellationToken ct)
    {
        await db.Set<GameProfileViewNotice>()
            .Where(n => n.TargetUserId == userId && !n.Seen)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.Seen, true), ct);
    }

    public StoreProductDto[] GetStoreProducts() => storeValidator.GetProducts();

    public async Task<StorePurchaseResult> ProcessStorePurchaseAsync(Guid userId, StorePurchaseRequest request, CancellationToken ct)
    {
        var validation = await storeValidator.ValidatePurchaseAsync(request, ct);
        if (!validation.IsValid)
        {
            throw new AuthFailure(400, validation.FailureReason ?? "invalid_store_receipt");
        }

        await using var dbTx = await db.Database.BeginTransactionAsync(ct);

        var existingPurchase = await db.Set<StorePurchase>().AsNoTracking()
            .SingleOrDefaultAsync(p => p.Platform == request.Platform.ToLowerInvariant() && p.TransactionId == request.TransactionId, ct);

        if (existingPurchase != null)
        {
            if (existingPurchase.UserId != userId)
            {
                throw new AuthFailure(409, "transaction_claimed_by_another_account");
            }

            var currentWallet = await db.Set<UserWallet>().AsNoTracking().SingleOrDefaultAsync(w => w.UserId == userId, ct);
            await dbTx.CommitAsync(ct);
            return new StorePurchaseResult(
                true,
                currentWallet?.Balance ?? 0,
                currentWallet?.OutstandingDebt ?? 0,
                0,
                0,
                true,
                "already_processed"
            );
        }

        var wallet = await db.Set<UserWallet>()
            .FromSqlInterpolated($"""SELECT "UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc", xmin FROM "UserWallets" WHERE "UserId" = {userId} FOR UPDATE""")
            .SingleOrDefaultAsync(ct);

        if (wallet is null)
        {
            wallet = new UserWallet
            {
                UserId = userId,
                Balance = 0,
                OutstandingDebt = 0,
                UpdatedAtUtc = clock.GetUtcNow()
            };
            db.Add(wallet);
            await db.SaveChangesAsync(ct);
        }

        var rawCrystals = validation.CrystalAmount;
        var debtRepaid = 0;
        if (wallet.OutstandingDebt > 0)
        {
            debtRepaid = Math.Min(wallet.OutstandingDebt, rawCrystals);
            wallet.OutstandingDebt -= debtRepaid;
        }

        var crystalsCredited = rawCrystals - debtRepaid;
        wallet.Balance += crystalsCredited;
        wallet.UpdatedAtUtc = clock.GetUtcNow();

        var purchase = new StorePurchase
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Platform = request.Platform.ToLowerInvariant(),
            ProductId = request.ProductId,
            TransactionId = request.TransactionId,
            PurchaseToken = request.PurchaseToken,
            Status = "Credited",
            Amount = rawCrystals,
            PriceCurrency = request.Currency,
            PriceAmount = request.Price,
            Environment = validation.Environment,
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.Set<StorePurchase>().Add(purchase);

        var tx = new CrystalTransaction
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Amount = rawCrystals,
            BalanceAfter = wallet.Balance,
            Type = "StorePurchase",
            ReferenceId = request.TransactionId,
            IdempotencyKey = $"{request.Platform.ToLowerInvariant()}:{request.TransactionId}",
            Description = $"კრისტალების შეძენა ({rawCrystals} 💎, {request.Platform})",
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.Add(tx);

        await db.SaveChangesAsync(ct);
        await dbTx.CommitAsync(ct);

        logger.LogInformation("Processed store purchase {TransactionId} on {Platform} for user {UserId}. Credited: {Credited}, DebtRepaid: {DebtRepaid}, Balance: {Balance}",
            request.TransactionId, request.Platform, userId, crystalsCredited, debtRepaid, wallet.Balance);

        return new StorePurchaseResult(
            true,
            wallet.Balance,
            wallet.OutstandingDebt,
            crystalsCredited,
            debtRepaid,
            false,
            "purchase_completed_successfully"
        );
    }

    public async Task<StoreRefundResult> ProcessStoreRefundAsync(StoreRefundRequest request, CancellationToken ct)
    {
        await using var dbTx = await db.Database.BeginTransactionAsync(ct);

        var purchase = await db.Set<StorePurchase>()
            .SingleOrDefaultAsync(p => p.Platform == request.Platform.ToLowerInvariant() && p.TransactionId == request.TransactionId, ct);

        if (purchase == null)
        {
            throw new AuthFailure(404, "store_purchase_not_found");
        }

        var wallet = await db.Set<UserWallet>()
            .FromSqlInterpolated($"""SELECT "UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc", xmin FROM "UserWallets" WHERE "UserId" = {purchase.UserId} FOR UPDATE""")
            .SingleOrDefaultAsync(ct);

        if (purchase.Status == "Refunded")
        {
            await dbTx.CommitAsync(ct);
            return new StoreRefundResult(true, wallet?.Balance ?? 0, wallet?.OutstandingDebt ?? 0, 0, true, "already_refunded");
        }

        if (wallet is null)
        {
            wallet = new UserWallet
            {
                UserId = purchase.UserId,
                Balance = 0,
                OutstandingDebt = 0,
                UpdatedAtUtc = clock.GetUtcNow()
            };
            db.Add(wallet);
            await db.SaveChangesAsync(ct);
        }

        var toRevoke = purchase.Amount;
        if (wallet.Balance >= toRevoke)
        {
            wallet.Balance -= toRevoke;
        }
        else
        {
            var deficit = toRevoke - wallet.Balance;
            wallet.Balance = 0;
            wallet.OutstandingDebt += deficit;
        }
        wallet.UpdatedAtUtc = clock.GetUtcNow();

        purchase.Status = "Refunded";
        purchase.RefundedAtUtc = clock.GetUtcNow();
        purchase.RefundReason = request.Reason;

        var tx = new CrystalTransaction
        {
            Id = Guid.NewGuid(),
            UserId = purchase.UserId,
            Amount = -purchase.Amount,
            BalanceAfter = wallet.Balance,
            Type = "StoreRefund",
            ReferenceId = request.RefundId,
            IdempotencyKey = $"refund:{request.Platform.ToLowerInvariant()}:{request.RefundId}",
            Description = $"თანხის დაბრუნება/გაუქმება (-{purchase.Amount} 💎)",
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.Add(tx);

        await db.SaveChangesAsync(ct);
        await dbTx.CommitAsync(ct);

        logger.LogInformation("Processed store refund for transaction {TransactionId}. Revoked {Amount} crystals. Balance: {Balance}, Debt: {Debt}",
            request.TransactionId, purchase.Amount, wallet.Balance, wallet.OutstandingDebt);

        return new StoreRefundResult(true, wallet.Balance, wallet.OutstandingDebt, purchase.Amount, false, "refund_processed_successfully");
    }

    public static readonly GiftCatalogItemDto[] GiftCatalog =
    [
        new("rose", "ვარდი", "🌹", 1),
        new("coffee", "ყავა", "☕", 5),
        new("chocolate", "შოკოლადი", "🍫", 15),
        new("cocktail", "კოქტეილი", "🍹", 30),
        new("bouquet", "თაიგული", "💐", 50),
        new("teddy", "დათუნია", "🧸", 100),
        new("diamond", "ბრილიანტი", "💎", 250),
        new("crown", "სამეფო გვირგვინი", "👑", 500)
    ];

    public async Task<SendGiftResult> SendGiftAsync(
        Guid senderUserId,
        SendGiftRequest request,
        CancellationToken ct)
    {
        if (senderUserId == request.RecipientUserId)
        {
            throw new AuthFailure(400, "cannot_gift_self");
        }

        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new AuthFailure(400, "invalid_idempotency_key");
        }

        var giftDef = GiftCatalog.FirstOrDefault(g => g.Id == request.GiftId)
            ?? throw new AuthFailure(400, "invalid_gift_id");

        await using var dbTx = await db.Database.BeginTransactionAsync(ct);

        var (first, second) = PairSynchronization.Order(senderUserId, request.RecipientUserId);
        await pairs.Lock(first, second, ct);

        var recipientUser = await db.Users.SingleOrDefaultAsync(u => u.Id == request.RecipientUserId && u.IsActive && u.EmailConfirmed, ct)
            ?? throw new AuthFailure(404, "recipient_user_unavailable");

        var recipientProfile = await db.Set<DatingProfile>().SingleOrDefaultAsync(p => p.UserId == request.RecipientUserId, ct);
        var senderProfile = await db.Set<DatingProfile>().SingleOrDefaultAsync(p => p.UserId == senderUserId, ct);

        var isBlocked = await db.Set<UserBlock>().AnyAsync(b =>
            (b.BlockerId == first && b.BlockedId == second) ||
            (b.BlockerId == second && b.BlockedId == first), ct);
        if (isBlocked)
        {
            throw new AuthFailure(403, "pair_blocked");
        }

        var isUnmatched = await db.Set<UnmatchedPair>().AnyAsync(p =>
            (p.FirstId == first && p.SecondId == second) ||
            (p.FirstId == second && p.SecondId == first), ct);
        if (isUnmatched)
        {
            throw new AuthFailure(403, "pair_unmatched");
        }

        // Check if idempotency key was already used
        var existingTx = await db.Set<CrystalTransaction>().AsNoTracking()
            .SingleOrDefaultAsync(t => t.UserId == senderUserId && t.IdempotencyKey == request.IdempotencyKey, ct);
        if (existingTx != null)
        {
            var existingGift = await db.Set<GameGift>().AsNoTracking()
                .SingleOrDefaultAsync(g => g.TransactionId == existingTx.Id, ct);
            await dbTx.CommitAsync(ct);
            return new SendGiftResult(
                Success: true,
                GiftRecordId: existingGift?.Id ?? Guid.Empty,
                GiftId: giftDef.Id,
                GiftName: giftDef.Name,
                GiftIcon: giftDef.Icon,
                CrystalCost: giftDef.Price,
                Balance: existingTx.BalanceAfter,
                RecipientDisplayName: recipientProfile?.DisplayName ?? "Player",
                Message: "already_sent"
            );
        }

        // Lock sender wallet
        var wallet = await db.Set<UserWallet>()
            .FromSqlInterpolated($"""SELECT "UserId", "Balance", "OutstandingDebt", "UpdatedAtUtc", xmin FROM "UserWallets" WHERE "UserId" = {senderUserId} FOR UPDATE""")
            .SingleOrDefaultAsync(ct);

        if (wallet is null || wallet.Balance < giftDef.Price)
        {
            throw new AuthFailure(400, "insufficient_crystals");
        }

        wallet.Balance -= giftDef.Price;
        wallet.UpdatedAtUtc = clock.GetUtcNow();

        var tx = new CrystalTransaction
        {
            Id = Guid.NewGuid(),
            UserId = senderUserId,
            Amount = -giftDef.Price,
            BalanceAfter = wallet.Balance,
            Type = "GiftSent",
            ReferenceId = request.RecipientUserId.ToString(),
            IdempotencyKey = request.IdempotencyKey,
            Description = $"საჩუქარი: {giftDef.Icon} {giftDef.Name} ({giftDef.Price} 💎)",
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.Add(tx);

        var giftRecord = new GameGift
        {
            Id = Guid.NewGuid(),
            SenderUserId = senderUserId,
            RecipientUserId = request.RecipientUserId,
            GiftId = giftDef.Id,
            GiftName = giftDef.Name,
            GiftIcon = giftDef.Icon,
            CrystalCost = giftDef.Price,
            RoomId = request.RoomId,
            TransactionId = tx.Id,
            CreatedAtUtc = clock.GetUtcNow()
        };
        db.Add(giftRecord);

        await db.SaveChangesAsync(ct);
        await dbTx.CommitAsync(ct);

        logger.LogInformation("User {Sender} sent gift {GiftId} to {Recipient} costing {Cost} crystals. New balance: {Balance}",
            senderUserId, giftDef.Id, request.RecipientUserId, giftDef.Price, wallet.Balance);

        if (telegramNotifications != null)
        {
            try
            {
                var senderName = senderProfile?.DisplayName ?? "მოთამაშე";

                _ = telegramNotifications.SendToUserAsync(
                    request.RecipientUserId,
                    $"🎁 <b>თქვენ მიიღეთ საჩუქარი Arena-ში!</b>\n\n<b>{senderName}</b>-მ გადმოგცათ საჩუქარი: <b>{giftDef.Icon} {giftDef.Name}</b>!\nგადადით მაგიდასთან და უპასუხეთ სიმპათიით 💋",
                    buttonText: "🍾 Arena-ს გახსნა",
                    webAppPath: "/arena",
                    ct: CancellationToken.None
                );
            }
            catch
            {
            }
        }

        if (hub != null && request.RoomId.HasValue)
        {
            try
            {
                await hub.Clients.Group(GameHub.RoomGroup(request.RoomId.Value)).SendAsync("GameGiftSent", new
                {
                    id = giftRecord.Id,
                    senderUserId = senderUserId,
                    recipientUserId = request.RecipientUserId,
                    giftId = giftDef.Id,
                    giftName = giftDef.Name,
                    giftIcon = giftDef.Icon,
                    crystalCost = giftDef.Price,
                    createdAtUtc = giftRecord.CreatedAtUtc
                }, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to broadcast GameGiftSent to room {RoomId}", request.RoomId.Value);
            }
        }

        return new SendGiftResult(
            Success: true,
            GiftRecordId: giftRecord.Id,
            GiftId: giftDef.Id,
            GiftName: giftDef.Name,
            GiftIcon: giftDef.Icon,
            CrystalCost: giftDef.Price,
            Balance: wallet.Balance,
            RecipientDisplayName: recipientProfile?.DisplayName ?? "Player",
            Message: "gift_sent_successfully"
        );
    }

    public async Task<UserGiftsDto> GetUserGiftsAsync(Guid userId, CancellationToken ct)
    {
        var received = await db.Set<GameGift>().AsNoTracking()
            .Where(g => g.RecipientUserId == userId)
            .OrderByDescending(g => g.CreatedAtUtc)
            .Take(50)
            .ToListAsync(ct);

        var sent = await db.Set<GameGift>().AsNoTracking()
            .Where(g => g.SenderUserId == userId)
            .OrderByDescending(g => g.CreatedAtUtc)
            .Take(50)
            .ToListAsync(ct);

        var allOtherUserIds = received.Select(g => g.SenderUserId)
            .Concat(sent.Select(g => g.RecipientUserId))
            .Distinct()
            .ToList();

        var profiles = await db.Set<DatingProfile>().AsNoTracking()
            .Where(p => allOtherUserIds.Contains(p.UserId))
            .ToDictionaryAsync(p => p.UserId, ct);

        var photos = await db.Set<ProfilePhoto>().AsNoTracking()
            .Where(p => allOtherUserIds.Contains(p.UserId) && !p.Deleted && p.State == "approved" && p.Position == 0)
            .ToDictionaryAsync(p => p.UserId, p => new PhotoDto(p.Id, p.State, p.Position, p.Width, p.Height), ct);

        var receivedDtos = received.Select(g =>
        {
            profiles.TryGetValue(g.SenderUserId, out var p);
            photos.TryGetValue(g.SenderUserId, out var photo);
            return new GiftItemDto(
                Id: g.Id,
                OtherUserId: g.SenderUserId,
                OtherDisplayName: p?.DisplayName ?? "Player",
                OtherPhoto: photo,
                GiftId: g.GiftId,
                GiftName: g.GiftName,
                GiftIcon: g.GiftIcon,
                CrystalCost: g.CrystalCost,
                CreatedAtUtc: g.CreatedAtUtc
            );
        }).ToArray();

        var sentDtos = sent.Select(g =>
        {
            profiles.TryGetValue(g.RecipientUserId, out var p);
            photos.TryGetValue(g.RecipientUserId, out var photo);
            return new GiftItemDto(
                Id: g.Id,
                OtherUserId: g.RecipientUserId,
                OtherDisplayName: p?.DisplayName ?? "Player",
                OtherPhoto: photo,
                GiftId: g.GiftId,
                GiftName: g.GiftName,
                GiftIcon: g.GiftIcon,
                CrystalCost: g.CrystalCost,
                CreatedAtUtc: g.CreatedAtUtc
            );
        }).ToArray();

        var totalReceivedCount = await db.Set<GameGift>().AsNoTracking()
            .CountAsync(g => g.RecipientUserId == userId, ct);

        var totalSentCount = await db.Set<GameGift>().AsNoTracking()
            .CountAsync(g => g.SenderUserId == userId, ct);

        var totalReceivedValue = await db.Set<GameGift>().AsNoTracking()
            .Where(g => g.RecipientUserId == userId)
            .SumAsync(g => (int?)g.CrystalCost, ct) ?? 0;

        return new UserGiftsDto(
            ReceivedGifts: receivedDtos,
            SentGifts: sentDtos,
            TotalReceivedCount: totalReceivedCount,
            TotalSentCount: totalSentCount,
            TotalReceivedCrystalsValue: totalReceivedValue
        );
    }
}
