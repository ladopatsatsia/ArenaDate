using System.Net;
using System.Net.Http.Json;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Game.Wallet;
using Dating.Api.Features.Profiles;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Dating.IntegrationTests;

public class StorePurchaseTests
{
    private static async Task<HttpResponseMessage> Send(AuthHarness h, TokenResponse user, HttpMethod method, string path, object? value = null)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new("Bearer", user.AccessToken);
        if (value is not null) request.Content = JsonContent.Create(value);
        return await h.Client.SendAsync(request);
    }

    private static ProfilePhoto ApprovedPhoto(Guid owner) => new()
    {
        Id = Guid.NewGuid(),
        UserId = owner,
        RequestId = Guid.NewGuid(),
        ObjectKey = Guid.NewGuid().ToString("N") + ".jpg",
        ThumbnailKey = Guid.NewGuid().ToString("N") + ".jpg",
        State = "approved",
        Width = 600,
        Height = 400,
        Position = 0,
        CreatedAt = DateTimeOffset.UtcNow
    };

    private static async Task<TokenResponse> CreateDirectUser(AuthHarness h, string email)
    {
        var id = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var user = new AppUser
        {
            Id = id,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            EmailConfirmed = true,
            IsActive = true,
            DateOfBirth = new DateOnly(1995, 1, 1),
            SecurityStamp = Guid.NewGuid().ToString("N")
        };
        var session = new AuthSession
        {
            Id = Guid.NewGuid(),
            UserId = id,
            ExpiresAt = now.AddDays(30)
        };
        var profile = new DatingProfile
        {
            UserId = id,
            DisplayName = "Store Tester",
            Bio = "Testing store purchases and virtual currency ledger.",
            Gender = "woman",
            DesiredGenders = ["man"],
            City = "Tbilisi",
            CityKey = "tbilisi",
            Interests = ["music"],
            RelationshipGoal = "long_term",
            Visible = true
        };
        var photo = ApprovedPhoto(id);

        await h.Db(async db =>
        {
            db.Users.Add(user);
            db.Sessions.Add(session);
            db.Set<DatingProfile>().Add(profile);
            db.Set<ProfilePhoto>().Add(photo);
            await db.SaveChangesAsync();
        });

        using var scope = h.Factory.Services.CreateScope();
        var jwt = scope.ServiceProvider.GetRequiredService<JwtTokens>();
        return jwt.Issue(user, session, JwtTokens.NewRefresh(), now);
    }

    [Fact]
    public async Task StoreProducts_ReturnsAvailableCrystalPackages_IncludingStarterOffer()
    {
        await using var h = await AuthHarness.Create();
        var user = await CreateDirectUser(h, "store_catalog@example.com");

        var res = await Send(h, user, HttpMethod.Get, "/api/game/store/products");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var products = await res.Content.ReadFromJsonAsync<StoreProductDto[]>();
        Assert.NotNull(products);
        Assert.NotEmpty(products);

        // Verify starter pack: 100 crystals for ~1 GEL
        var starter = Assert.Single(products, p => p.ProductId == "dating.crystals.100");
        Assert.Equal(100, starter.CrystalAmount);
        Assert.Contains("100", starter.Title);
        Assert.Equal("~1 GEL", starter.TierApproximateGEL);
    }

    [Fact]
    public async Task StorePurchase_ValidReceipt_CreditsLedgerOnce()
    {
        await using var h = await AuthHarness.Create();
        var user = await CreateDirectUser(h, "store_buyer@example.com");

        // 1. Initial wallet: 0 balance
        var wRes1 = await Send(h, user, HttpMethod.Get, "/api/game/wallet");
        var w1 = await wRes1.Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(w1);
        Assert.Equal(0, w1.Balance);
        Assert.Equal(0, w1.OutstandingDebt);

        // 2. Buy starter pack
        var txId = "apple_tx_" + Guid.NewGuid().ToString("N");
        var purchaseReq = new StorePurchaseRequest(
            Platform: "apple",
            ProductId: "dating.crystals.100",
            TransactionId: txId,
            PurchaseToken: "token_sandbox_" + txId,
            Currency: "GEL",
            Price: 0.99m
        );

        var pRes = await Send(h, user, HttpMethod.Post, "/api/game/store/purchase", purchaseReq);
        Assert.Equal(HttpStatusCode.OK, pRes.StatusCode);

        var result = await pRes.Content.ReadFromJsonAsync<StorePurchaseResult>();
        Assert.NotNull(result);
        Assert.True(result.Success);
        Assert.Equal(100, result.Balance);
        Assert.Equal(0, result.OutstandingDebt);
        Assert.Equal(100, result.CrystalsCredited);
        Assert.Equal(0, result.DebtRepaid);
        Assert.False(result.AlreadyProcessed);

        // 3. Database state verification
        await h.Db(async db =>
        {
            var wallet = await db.Set<UserWallet>().SingleAsync(w => w.UserId == user.Account.Id);
            Assert.Equal(100, wallet.Balance);
            Assert.Equal(0, wallet.OutstandingDebt);

            var purchase = await db.Set<StorePurchase>().SingleAsync(p => p.TransactionId == txId);
            Assert.Equal("Credited", purchase.Status);
            Assert.Equal(100, purchase.Amount);
            Assert.Equal("apple", purchase.Platform);

            var tx = await db.Set<CrystalTransaction>().SingleAsync(t => t.ReferenceId == txId);
            Assert.Equal("StorePurchase", tx.Type);
            Assert.Equal(100, tx.Amount);
            Assert.Equal(100, tx.BalanceAfter);
        });
    }

    [Fact]
    public async Task StorePurchase_IdempotentReplay_ReturnsSameBalance_ZeroDuplicateCredit()
    {
        await using var h = await AuthHarness.Create();
        var user = await CreateDirectUser(h, "store_replay@example.com");

        var txId = "google_tx_" + Guid.NewGuid().ToString("N");
        var purchaseReq = new StorePurchaseRequest(
            Platform: "google",
            ProductId: "dating.crystals.100",
            TransactionId: txId,
            PurchaseToken: "token_google_" + txId,
            Currency: "GEL",
            Price: 0.99m
        );

        // First purchase call
        var res1 = await Send(h, user, HttpMethod.Post, "/api/game/store/purchase", purchaseReq);
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var r1 = await res1.Content.ReadFromJsonAsync<StorePurchaseResult>();
        Assert.NotNull(r1);
        Assert.Equal(100, r1.Balance);
        Assert.False(r1.AlreadyProcessed);

        // Replay of same transaction (interrupted flow or duplicate client post)
        var res2 = await Send(h, user, HttpMethod.Post, "/api/game/store/purchase", purchaseReq);
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);
        var r2 = await res2.Content.ReadFromJsonAsync<StorePurchaseResult>();
        Assert.NotNull(r2);
        Assert.Equal(100, r2.Balance); // still 100, not 200!
        Assert.True(r2.AlreadyProcessed);

        // Ledger check: exactly 1 transaction and 1 purchase record
        await h.Db(async db =>
        {
            var countPurchases = await db.Set<StorePurchase>().CountAsync(p => p.TransactionId == txId);
            Assert.Equal(1, countPurchases);

            var countTxs = await db.Set<CrystalTransaction>().CountAsync(t => t.ReferenceId == txId);
            Assert.Equal(1, countTxs);
        });
    }

    [Fact]
    public async Task StorePurchase_CrossAccountClaim_Returns409Conflict()
    {
        await using var h = await AuthHarness.Create();
        var userA = await CreateDirectUser(h, "buyer_a@example.com");
        var userB = await CreateDirectUser(h, "buyer_b@example.com");

        var txId = "tx_shared_" + Guid.NewGuid().ToString("N");
        var purchaseReq = new StorePurchaseRequest(
            Platform: "apple",
            ProductId: "dating.crystals.100",
            TransactionId: txId,
            PurchaseToken: "token_apple_" + txId
        );

        // User A successfully claims transaction
        var resA = await Send(h, userA, HttpMethod.Post, "/api/game/store/purchase", purchaseReq);
        Assert.Equal(HttpStatusCode.OK, resA.StatusCode);

        // User B attempts to claim the exact same transaction ID
        var resB = await Send(h, userB, HttpMethod.Post, "/api/game/store/purchase", purchaseReq);
        Assert.Equal(HttpStatusCode.Conflict, resB.StatusCode);

        // User B balance remains 0
        var balB = await (await Send(h, userB, HttpMethod.Get, "/api/game/wallet")).Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(balB);
        Assert.Equal(0, balB.Balance);
    }

    [Fact]
    public async Task StorePurchase_InvalidOrWrongEnvironmentReceipt_Returns400()
    {
        await using var h = await AuthHarness.Create();
        var user = await CreateDirectUser(h, "store_invalid@example.com");

        // 1. Invalid receipt token
        var invalidReq = new StorePurchaseRequest(
            Platform: "apple",
            ProductId: "dating.crystals.100",
            TransactionId: "tx_invalid",
            PurchaseToken: "test_invalid"
        );
        var res1 = await Send(h, user, HttpMethod.Post, "/api/game/store/purchase", invalidReq);
        Assert.Equal(HttpStatusCode.BadRequest, res1.StatusCode);

        // 2. Unsupported product ID
        var wrongProductReq = new StorePurchaseRequest(
            Platform: "apple",
            ProductId: "unsupported.package.999",
            TransactionId: "tx_wrong_prod",
            PurchaseToken: "token_test"
        );
        var res2 = await Send(h, user, HttpMethod.Post, "/api/game/store/purchase", wrongProductReq);
        Assert.Equal(HttpStatusCode.BadRequest, res2.StatusCode);

        // 3. Balance remains 0
        var wallet = await (await Send(h, user, HttpMethod.Get, "/api/game/wallet")).Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(wallet);
        Assert.Equal(0, wallet.Balance);
    }

    [Fact]
    public async Task StoreRefund_RevokesCrystals_IdempotentReversal()
    {
        await using var h = await AuthHarness.Create();
        var user = await CreateDirectUser(h, "refund_user@example.com");

        var txId = "tx_refund_" + Guid.NewGuid().ToString("N");
        var purchaseReq = new StorePurchaseRequest(
            Platform: "apple",
            ProductId: "dating.crystals.100",
            TransactionId: txId,
            PurchaseToken: "token_apple_" + txId
        );

        // 1. Purchase 100 crystals
        await Send(h, user, HttpMethod.Post, "/api/game/store/purchase", purchaseReq);

        // 2. Process refund webhook
        var refundReq = new StoreRefundRequest(
            Platform: "apple",
            TransactionId: txId,
            RefundId: "ref_" + Guid.NewGuid().ToString("N"),
            Reason: "Customer requested cancellation"
        );

        var refRes1 = await Send(h, user, HttpMethod.Post, "/api/game/store/refund", refundReq);
        Assert.Equal(HttpStatusCode.OK, refRes1.StatusCode);
        var r1 = await refRes1.Content.ReadFromJsonAsync<StoreRefundResult>();
        Assert.NotNull(r1);
        Assert.True(r1.Success);
        Assert.Equal(0, r1.Balance);
        Assert.Equal(0, r1.OutstandingDebt);
        Assert.Equal(100, r1.CrystalsRevoked);
        Assert.False(r1.AlreadyProcessed);

        // 3. Replay refund: idempotent 200
        var refRes2 = await Send(h, user, HttpMethod.Post, "/api/game/store/refund", refundReq);
        Assert.Equal(HttpStatusCode.OK, refRes2.StatusCode);
        var r2 = await refRes2.Content.ReadFromJsonAsync<StoreRefundResult>();
        Assert.NotNull(r2);
        Assert.True(r2.AlreadyProcessed);
        Assert.Equal(0, r2.Balance);
    }

    [Fact]
    public async Task StoreRefund_WhenCreditsAlreadySpent_HandlesOutstandingDebtExplicitly()
    {
        await using var h = await AuthHarness.Create();
        var user = await CreateDirectUser(h, "debt_user@example.com");
        var targetUser = await CreateDirectUser(h, "target_unlock@example.com");

        var txId = "tx_spent_" + Guid.NewGuid().ToString("N");
        var purchaseReq = new StorePurchaseRequest(
            Platform: "apple",
            ProductId: "dating.crystals.100",
            TransactionId: txId,
            PurchaseToken: "token_apple_" + txId
        );

        // 1. Purchase 100 crystals -> Balance = 100
        await Send(h, user, HttpMethod.Post, "/api/game/store/purchase", purchaseReq);

        // 2. Spend 25 crystals on profile unlock -> Balance = 75
        var unlockRes = await Send(h, user, HttpMethod.Post, $"/api/game/profiles/{targetUser.Account.Id}/unlock",
            new UnlockProfileRequest(Guid.NewGuid().ToString("N")));
        Assert.Equal(HttpStatusCode.OK, unlockRes.StatusCode);

        var balBeforeRefund = await (await Send(h, user, HttpMethod.Get, "/api/game/wallet")).Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(balBeforeRefund);
        Assert.Equal(75, balBeforeRefund.Balance);
        Assert.Equal(0, balBeforeRefund.OutstandingDebt);

        // 3. Store refund of 100 crystals arrives:
        // User has only 75 available; 100 revoked leaves Balance = 0, OutstandingDebt = 25!
        var refundReq = new StoreRefundRequest(
            Platform: "apple",
            TransactionId: txId,
            RefundId: "ref_spent_" + Guid.NewGuid().ToString("N"),
            Reason: "Fraudulent charge dispute"
        );

        var refRes = await Send(h, user, HttpMethod.Post, "/api/game/store/refund", refundReq);
        Assert.Equal(HttpStatusCode.OK, refRes.StatusCode);
        var refResult = await refRes.Content.ReadFromJsonAsync<StoreRefundResult>();
        Assert.NotNull(refResult);
        Assert.True(refResult.Success);
        Assert.Equal(0, refResult.Balance);
        Assert.Equal(25, refResult.OutstandingDebt); // Debt handled explicitly!

        // Database constraint check: Balance >= 0 and OutstandingDebt >= 0 strictly intact
        await h.Db(async db =>
        {
            var wallet = await db.Set<UserWallet>().SingleAsync(w => w.UserId == user.Account.Id);
            Assert.Equal(0, wallet.Balance);
            Assert.Equal(25, wallet.OutstandingDebt);
        });

        // 4. User makes subsequent purchase of 100 crystals:
        // Automatically repays 25 debt first; 75 credited to balance!
        var txId2 = "tx_repay_" + Guid.NewGuid().ToString("N");
        var purchase2 = new StorePurchaseRequest(
            Platform: "apple",
            ProductId: "dating.crystals.100",
            TransactionId: txId2,
            PurchaseToken: "token_apple_" + txId2
        );

        var p2Res = await Send(h, user, HttpMethod.Post, "/api/game/store/purchase", purchase2);
        Assert.Equal(HttpStatusCode.OK, p2Res.StatusCode);
        var p2Result = await p2Res.Content.ReadFromJsonAsync<StorePurchaseResult>();
        Assert.NotNull(p2Result);
        Assert.True(p2Result.Success);
        Assert.Equal(75, p2Result.Balance);
        Assert.Equal(0, p2Result.OutstandingDebt);
        Assert.Equal(75, p2Result.CrystalsCredited);
        Assert.Equal(25, p2Result.DebtRepaid);

        // Wallet check
        var finalWallet = await (await Send(h, user, HttpMethod.Get, "/api/game/wallet")).Content.ReadFromJsonAsync<WalletBalanceDto>();
        Assert.NotNull(finalWallet);
        Assert.Equal(75, finalWallet.Balance);
        Assert.Equal(0, finalWallet.OutstandingDebt);
    }
}
