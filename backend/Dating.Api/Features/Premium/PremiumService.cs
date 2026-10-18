using Dating.Api.Features.Auth;
using Dating.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Dating.Api.Features.Premium;

public sealed class PremiumService(AppDbContext db, TimeProvider clock) : IPremiumService
{
    public static readonly PremiumPackageDto[] AvailablePackages =
    [
        new(
            Id: "two_weeks",
            Name: "2 კვირა",
            Description: "სწრაფი წვდომა 14 დღით",
            DurationDays: 14,
            PriceAmount: 2.90m,
            Currency: "GEL",
            PriceDisplay: "2.90 ₾"
        ),
        new(
            Id: "one_month",
            Name: "1 თვე",
            Description: "ყველაზე პოპულარული არჩევანი",
            DurationDays: 30,
            PriceAmount: 4.90m,
            Currency: "GEL",
            PriceDisplay: "4.90 ₾",
            Badge: "პოპულარული",
            IsPopular: true
        ),
        new(
            Id: "three_months",
            Name: "3 თვე",
            Description: "ეკონომიური პაკეტი",
            DurationDays: 90,
            PriceAmount: 10.00m,
            Currency: "GEL",
            PriceDisplay: "10.00 ₾",
            Badge: "ეკონომია"
        ),
        new(
            Id: "lifetime",
            Name: "ულიმიტო",
            Description: "ერთხელ გადახდა, სამუდამო Arena Black წვდომა",
            DurationDays: null,
            PriceAmount: 40.00m,
            Currency: "GEL",
            PriceDisplay: "40.00 ₾",
            Badge: "საუკეთესო"
        )
    ];

    public PremiumPackageDto[] GetPackages() => AvailablePackages;

    public async Task<bool> HasActivePremiumAsync(Guid userId, CancellationToken ct = default)
    {
        var now = clock.GetUtcNow();
        return await db.Set<UserSubscription>()
            .AsNoTracking()
            .AnyAsync(s => s.UserId == userId && s.IsActive && (s.ExpiresAtUtc == null || s.ExpiresAtUtc > now), ct);
    }

    public async Task<PremiumStatusDto> GetStatusAsync(Guid userId, CancellationToken ct = default)
    {
        var now = clock.GetUtcNow();
        var activeSub = await db.Set<UserSubscription>()
            .AsNoTracking()
            .Where(s => s.UserId == userId && s.IsActive && (s.ExpiresAtUtc == null || s.ExpiresAtUtc > now))
            .OrderByDescending(s => s.ExpiresAtUtc == null) // Lifetime first
            .ThenByDescending(s => s.ExpiresAtUtc)
            .FirstOrDefaultAsync(ct);

        if (activeSub == null)
        {
            return new PremiumStatusDto(
                HasPremium: false,
                ActivePackageId: null,
                ExpiresAtUtc: null,
                IsLifetime: false,
                Packages: AvailablePackages
            );
        }

        return new PremiumStatusDto(
            HasPremium: true,
            ActivePackageId: activeSub.PackageId,
            ExpiresAtUtc: activeSub.ExpiresAtUtc,
            IsLifetime: activeSub.ExpiresAtUtc == null,
            Packages: AvailablePackages
        );
    }

    public async Task<SubscribeResultDto> SubscribeAsync(Guid userId, SubscribePackageRequest request, CancellationToken ct = default)
    {
        var pkg = AvailablePackages.FirstOrDefault(p => string.Equals(p.Id, request.PackageId, StringComparison.OrdinalIgnoreCase));
        if (pkg == null)
        {
            throw new AuthFailure(400, "invalid_package");
        }

        var now = clock.GetUtcNow();

        // Check if user already has an active subscription
        var existing = await db.Set<UserSubscription>()
            .Where(s => s.UserId == userId && s.IsActive && (s.ExpiresAtUtc == null || s.ExpiresAtUtc > now))
            .OrderByDescending(s => s.ExpiresAtUtc == null)
            .ThenByDescending(s => s.ExpiresAtUtc)
            .FirstOrDefaultAsync(ct);

        DateTimeOffset startedAt = now;
        DateTimeOffset? expiresAt = null;

        if (pkg.DurationDays.HasValue)
        {
            // Extension: if existing subscription is active and has an expiration, extend from that expiration date!
            var baseDate = existing is { ExpiresAtUtc: not null } && existing.ExpiresAtUtc.Value > now
                ? existing.ExpiresAtUtc.Value
                : now;

            expiresAt = baseDate.AddDays(pkg.DurationDays.Value);
        }
        else
        {
            // Lifetime package: no expiration
            expiresAt = null;
        }

        var sub = new UserSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            PackageId = pkg.Id,
            PriceAmount = pkg.PriceAmount,
            Currency = pkg.Currency,
            StartedAtUtc = startedAt,
            ExpiresAtUtc = expiresAt,
            IsActive = true,
            Platform = string.IsNullOrWhiteSpace(request.Platform) ? "Mobile" : request.Platform.Trim(),
            TransactionId = request.TransactionId ?? Guid.NewGuid().ToString("N"),
            CreatedAtUtc = now
        };

        db.Set<UserSubscription>().Add(sub);
        await db.SaveChangesAsync(ct);

        var status = await GetStatusAsync(userId, ct);
        return new SubscribeResultDto(
            Success: true,
            Message: "პრემიუმ პაკეტი წარმატებით გააქტიურდა!",
            Status: status
        );
    }
}
