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
    string RelationshipGoal, string? DistanceBucket, Dating.Api.Features.Profiles.PhotoDto[] Photos, string[]? Languages = null);
public sealed record DiscoveryPage(DiscoveryCard[] Items, string? NextCursor);
public static class DiscoveryRules
{
    public static readonly int[] Radii = [10, 25, 50, 100];
    private static readonly Dictionary<string, string> CanonicalCities = new(StringComparer.OrdinalIgnoreCase)
    {
        ["თბილისი"] = "TBILISI",
        ["ბათუმი"] = "BATUMI",
        ["ქუთაისი"] = "KUTAISI",
        ["რუსთავი"] = "RUSTAVI",
        ["სოხუმი"] = "SOKHUMI",
        ["ცხინვალი"] = "TSKHINVALI",
        ["აფხაზეთი"] = "ABKHAZIA",
        ["სამაჩაბლო"] = "TSKHINVALI",
        ["გაგრა"] = "GAGRA",
        ["გუდაუთა"] = "GUDAUTA",
        ["ოჩამჩირე"] = "OCHAMCHIRE",
        ["გალი"] = "GALI",
        ["ტყვარჩელი"] = "TQVARCHELI",
        ["ბიჭვინთა"] = "BICHVINTA",
        ["ახალი ათონი"] = "AKHALI_ATONI",
        ["ჯავა"] = "JAVA",
        ["ზუგდიდი"] = "ZUGDIDI",
        ["გორი"] = "GORI",
        ["ფოთი"] = "POTI",
        ["თელავი"] = "TELAVI",
        ["მცხეთა"] = "MTSKHETA",
        ["ხაშური"] = "KHASHURI",
        ["სამტრედია"] = "SAMTREDIA",
        ["სენაკი"] = "SENAKI",
        ["ზესტაფონი"] = "ZESTAFONI",
        ["მარნეული"] = "MARNEULI",
        ["ახალციხე"] = "AKHALTSIKHE",
        ["ქობულეთი"] = "KOBULETI",
        ["ოზურგეთი"] = "OZURGETI",
        ["კასპი"] = "KASPI",
        ["ჭიათურა"] = "CHIATURA",
        ["წყალტუბო"] = "TSQALTUBO",
        ["საგარეჯო"] = "SAGAREJO",
        ["გარდაბანი"] = "GARDABANI",
        ["ბორჯომი"] = "BORJOMI",
        ["სტეფანწმინდა"] = "STEPANTSMINDA",
        ["ყაზბეგი"] = "STEPANTSMINDA",
        ["ბაკურიანი"] = "BAKURIANI",
        ["გუდაური"] = "GUDAURI",
        ["სიღნაღი"] = "SIGHNAGHI",
        ["დუშეთი"] = "DUSHETI",
        ["ახალქალაქი"] = "AKHALKALAKI",
        ["ახმეტა"] = "AKHMETA",
        ["ყვარელი"] = "QVARELI",
        ["ბოლნისი"] = "BOLNISI",
        ["დმანისი"] = "DMANISI",
        ["წალკა"] = "TSALKA",
        ["ლაგოდეხი"] = "LAGODEKHI",
        ["დედოფლისწყარო"] = "DEDOPLISTSQARO",
        ["ხობი"] = "KHOBI",
        ["ჩხოროწყუ"] = "CHKHOROTSQOU",
        ["მარტვილი"] = "MARTVILI",
        ["წალენჯიხა"] = "TSALENJIKHA",
        ["ონი"] = "ONI",
        ["ამბროლაური"] = "AMBROLAURI",
        ["მესტია"] = "MESTIA",
        ["TIFLIS"] = "TBILISI",
        ["KAZBEGI"] = "STEPANTSMINDA",
        ["SOKHUMI"] = "SOKHUMI",
        ["SUKHUMI"] = "SOKHUMI",
        ["SUKHUM"] = "SOKHUMI",
        ["TSKHINVALI"] = "TSKHINVALI",
        ["ABKHAZIA"] = "ABKHAZIA",
        ["SAMACHABLO"] = "TSKHINVALI",
        ["GAGRA"] = "GAGRA",
        ["GUDAUTA"] = "GUDAUTA",
        ["OCHAMCHIRE"] = "OCHAMCHIRE",
        ["GALI"] = "GALI",
        ["TQVARCHELI"] = "TQVARCHELI",
        ["BICHVINTA"] = "BICHVINTA",
        ["PITSUNDA"] = "BICHVINTA",
        ["JAVA"] = "JAVA",
    };

    public static string CityKey(string city)
    {
        var cleaned = string.Join(' ', city.Normalize(NormalizationForm.FormKC)
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).Trim();
        if (CanonicalCities.TryGetValue(cleaned, out var canonical))
            return canonical;
        var upper = cleaned.ToUpperInvariant();
        if (CanonicalCities.TryGetValue(upper, out canonical))
            return canonical;
        return upper;
    }
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
