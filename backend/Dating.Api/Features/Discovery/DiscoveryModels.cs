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

        // Countries for Global & Country (VIP Passport) Discovery
        ["საქართველო"] = "GE", ["GEORGIA"] = "GE", ["GE"] = "GE", ["ГРУЗИЯ"] = "GE",
        ["აშშ"] = "US", ["USA"] = "US", ["US"] = "US", ["AMERICA"] = "US", ["UNITED STATES"] = "US", ["США"] = "US",
        ["გერმანია"] = "DE", ["GERMANY"] = "DE", ["DE"] = "DE", ["DEUTSCHLAND"] = "DE", ["ГЕРМАНИЯ"] = "DE",
        ["დიდი ბრიტანეთი"] = "GB", ["UNITED KINGDOM"] = "GB", ["UK"] = "GB", ["GB"] = "GB", ["ENGLAND"] = "GB", ["ВЕЛИКОБРИТАНИЯ"] = "GB",
        ["უკრაინა"] = "UA", ["UKRAINE"] = "UA", ["UA"] = "UA", ["УКРАИНА"] = "UA",
        ["თურქეთი"] = "TR", ["TURKEY"] = "TR", ["TR"] = "TR", ["TURKIYE"] = "TR", ["ТУРЦИЯ"] = "TR",
        ["საფრანგეთი"] = "FR", ["FRANCE"] = "FR", ["FR"] = "FR", ["ФРАНЦИЯ"] = "FR",
        ["იტალია"] = "IT", ["ITALY"] = "IT", ["IT"] = "IT", ["ITALIA"] = "IT", ["ИТАЛИЯ"] = "IT",
        ["ესპანეთი"] = "ES", ["SPAIN"] = "ES", ["ES"] = "ES", ["ESPANA"] = "ES", ["ИСПАНИЯ"] = "ES",
        ["პოლონეთი"] = "PL", ["POLAND"] = "PL", ["PL"] = "PL", ["ПОЛЬША"] = "PL",
        ["კანადა"] = "CA", ["CANADA"] = "CA", ["CA"] = "CA", ["КАНАДА"] = "CA",
        ["ნიდერლანდები"] = "NL", ["NETHERLANDS"] = "NL", ["NL"] = "NL", ["HOLLAND"] = "NL", ["НИДЕРЛАНДЫ"] = "NL",
        ["საბერძნეთი"] = "GR", ["GREECE"] = "GR", ["GR"] = "GR", ["ГРЕЦИЯ"] = "GR",
        ["ისრაელი"] = "IL", ["ISRAEL"] = "IL", ["IL"] = "IL", ["ИЗРАИЛЬ"] = "IL",
        ["აზერბაიჯანი"] = "AZ", ["AZERBAIJAN"] = "AZ", ["AZ"] = "AZ", ["АЗЕРБАЙДЖАН"] = "AZ",
        ["სომხეთი"] = "AM", ["ARMENIA"] = "AM", ["AM"] = "AM", ["АРМЕНИЯ"] = "AM",
        ["ყაზახეთი"] = "KZ", ["KAZAKHSTAN"] = "KZ", ["KZ"] = "KZ", ["КАЗАХСТАН"] = "KZ",
        ["საამიროები"] = "AE", ["UAE"] = "AE", ["AE"] = "AE", ["DUBAI"] = "AE", ["არაბთა გაერთიანებული საამიროები"] = "AE", ["ОАЭ"] = "AE",
        ["შვეიცარია"] = "CH", ["SWITZERLAND"] = "CH", ["CH"] = "CH", ["SCHWEIZ"] = "CH", ["ШВЕЙЦАРИЯ"] = "CH",
        ["ავსტრია"] = "AT", ["AUSTRIA"] = "AT", ["AT"] = "AT", ["OSTERREICH"] = "AT", ["АВСТРИЯ"] = "AT",
        ["შვედეთი"] = "SE", ["SWEDEN"] = "SE", ["SE"] = "SE", ["SVERIGE"] = "SE", ["ШВЕЦИЯ"] = "SE",
        ["ნორვეგია"] = "NO", ["NORWAY"] = "NO", ["NO"] = "NO", ["NORGE"] = "NO", ["НОРВЕГИЯ"] = "NO",
        ["ჩეხეთი"] = "CZ", ["CZECH REPUBLIC"] = "CZ", ["CZECHIA"] = "CZ", ["CZ"] = "CZ", ["ЧЕХИЯ"] = "CZ",
        ["პორტუგალია"] = "PT", ["PORTUGAL"] = "PT", ["PT"] = "PT", ["ПОРТУГАЛИЯ"] = "PT",
        ["კვიპროსი"] = "CY", ["CYPRUS"] = "CY", ["CY"] = "CY", ["КИПР"] = "CY",
        ["ლიეტუვა"] = "LT", ["LITHUANIA"] = "LT", ["LT"] = "LT", ["ЛИТВА"] = "LT",
        ["ლატვია"] = "LV", ["LATVIA"] = "LV", ["LV"] = "LV", ["ЛАТВИЯ"] = "LV",
        ["ესტონეთი"] = "EE", ["ESTONIA"] = "EE", ["EE"] = "EE", ["ЭСТОНИЯ"] = "EE",
    };

    public static readonly string[] GeorgianCityKeys = [
        "TBILISI", "BATUMI", "KUTAISI", "RUSTAVI", "SOKHUMI", "TSKHINVALI", "ABKHAZIA",
        "GAGRA", "GUDAUTA", "OCHAMCHIRE", "GALI", "TQVARCHELI", "BICHVINTA", "AKHALI_ATONI",
        "JAVA", "ZUGDIDI", "GORI", "POTI", "TELAVI", "MTSKHETA", "KHASHURI", "SAMTREDIA",
        "SENAKI", "ZESTAFONI", "MARNEULI", "AKHALTSIKHE", "KOBULETI", "OZURGETI", "KASPI",
        "CHIATURA", "TSQALTUBO", "SAGAREJO", "GARDABANI", "BORJOMI", "STEPANTSMINDA",
        "BAKURIANI", "GUDAURI", "SIGHNAGHI", "DUSHETI", "AKHALKALAKI", "AKHMETA", "QVARELI",
        "BOLNISI", "DMANISI", "TSALKA", "LAGODEKHI", "DEDOPLISTSQARO", "KHOBI", "CHKHOROTSQOU",
        "MARTVILI", "TSALENJIKHA", "ONI", "AMBROLAURI", "MESTIA", "GE", "GEORGIA"
    ];

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
