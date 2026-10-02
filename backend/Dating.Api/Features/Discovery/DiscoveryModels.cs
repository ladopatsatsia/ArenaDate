using System.ComponentModel.DataAnnotations;
using System.Text;
using Dating.Api.Features.Auth;
using NetTopologySuite.Geometries;
namespace Dating.Api.Features.Discovery;
// Durable exclusion inputs only; decision/unmatch mutation APIs belong to later stages.
public sealed class DiscoveryDecision { public Guid UserId { get; set; } public Guid TargetId { get; set; } public string Kind { get; set; } = ""; }
public sealed class UnmatchedPair { public Guid FirstId { get; set; } public Guid SecondId { get; set; } }
public sealed record DiscoverySettings(long Revision, int MinAge, int MaxAge, string[] DesiredGenders, int RadiusKm, string Mode, string City, bool HasLocation);
public sealed record SettingsRequest(long Revision, [Range(18,120)] int MinAge, [Range(18,120)] int MaxAge,
    [Required, MinLength(1), MaxLength(3)] string[] DesiredGenders, int RadiusKm, [Required] string Mode, [Required, StringLength(80, MinimumLength = 2)] string City);
public sealed record LocationRequest(double Latitude, double Longitude, bool Consent);
public sealed record DiscoveryCard(Guid Id, string DisplayName, int Age, string Bio, string Gender, string City, string[] Interests,
    string RelationshipGoal, string? DistanceBucket, Dating.Api.Features.Profiles.PhotoDto[] Photos);
public sealed record DiscoveryPage(DiscoveryCard[] Items, string? NextCursor);
public static class DiscoveryRules
{
    public static readonly int[] Radii = [10, 25, 50, 100];
    public static string CityKey(string city) => string.Join(' ', city.Normalize(NormalizationForm.FormKC).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();
    public static Point Coarsen(double latitude, double longitude)
    {
        if (!double.IsFinite(latitude) || !double.IsFinite(longitude) || latitude is < -90 or > 90 || longitude is < -180 or > 180)
            throw new AuthFailure(400, "invalid_location");
        // Approximate 2 km grid. Precise source coordinates are discarded, not saved.
        var lat = Math.Clamp(Math.Round(latitude / 0.02) * 0.02, -90, 90);
        var step = 0.02 / Math.Max(0.0001, Math.Cos(lat * Math.PI / 180));
        var lon = Math.Clamp(Math.Round(longitude / step) * step, -180, 180);
        return new Point(lon, lat) { SRID = 4326 };
    }
    public static string? Bucket(double? meters) => meters switch { null => null, < 10000 => "under_10", < 25000 => "10_25", < 50000 => "25_50", _ => "50_100" };
}
