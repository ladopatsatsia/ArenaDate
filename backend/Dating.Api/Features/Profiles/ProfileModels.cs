using System.ComponentModel.DataAnnotations;
using Dating.Api.Features.Auth;
namespace Dating.Api.Features.Profiles;
public sealed class DatingProfile
{
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public string DisplayName { get; set; } = "";
    public string Bio { get; set; } = "";
    public string Gender { get; set; } = "";
    public string[] DesiredGenders { get; set; } = [];
    public string City { get; set; } = "";
    public string[] Interests { get; set; } = [];
    public string RelationshipGoal { get; set; } = "";
    public bool Visible { get; set; }
    public long Revision { get; set; }
    public long DiscoverySequence { get; set; }
    public string CityKey { get; set; } = "";
    public int MinAge { get; set; } = 18;
    public int MaxAge { get; set; } = 99;
    public int RadiusKm { get; set; } = 25;
    public string LocationMode { get; set; } = "city";
    public NetTopologySuite.Geometries.Point? Location { get; set; }
}
public sealed class ProfilePhoto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public Guid RequestId { get; set; }
    public string ObjectKey { get; set; } = "";
    public string ThumbnailKey { get; set; } = "";
    public string State { get; set; } = "uploading";
    public int Position { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public bool Deleted { get; set; }
    public bool ObjectsDeleted { get; set; }
}
// Shared exclusion record. User-facing block actions belong to the safety stage.
public sealed class UserBlock { public Guid BlockerId { get; set; } public Guid BlockedId { get; set; } }
public sealed record ProfileUpdate(long Revision,
    [Required, StringLength(50, MinimumLength = 2)] string DisplayName,
    [Required, StringLength(500, MinimumLength = 10)] string Bio,
    [Required] string Gender, [Required, MinLength(1), MaxLength(3)] string[] DesiredGenders,
    [Required, StringLength(80, MinimumLength = 2)] string City,
    [Required, MinLength(1), MaxLength(5)] string[] Interests,
    [Required] string RelationshipGoal, bool Visible);
public sealed record PhotoDto(Guid Id, string State, int Position, int Width, int Height);
public sealed record OwnProfileDto(long Revision, string DisplayName, int Age, string Bio, string Gender,
    string[] DesiredGenders, string City, string[] Interests, string RelationshipGoal, bool Visible, bool Complete, PhotoDto[] Photos);
public sealed record ProfileChoices(string[] Genders, string[] Interests, string[] RelationshipGoals);
public sealed record UploadRequest(Guid RequestId);
public sealed record ReorderRequest(long Revision, [Required, MaxLength(6)] Guid[] PhotoIds);
public sealed record ModerateRequest([Required] string State);
public sealed record MediaGrant(string Ticket, DateTimeOffset ExpiresAt);
public static class ProfileRules
{
    public static readonly string[] Genders = ["woman", "man", "nonbinary"];
    public static readonly string[] Interests = ["music", "books", "travel", "cooking", "sport", "art", "gaming", "nature", "film", "technology"];
    public static readonly string[] Goals = ["long_term", "short_term", "open_to_either", "figuring_out"];
    public static int Age(DateOnly dob, DateTimeOffset now)
    { var today = DateOnly.FromDateTime(now.UtcDateTime); return today.Year - dob.Year - (dob > today.AddYears(-(today.Year - dob.Year)) ? 1 : 0); }
    public static bool Complete(DatingProfile p) => p.DisplayName.Trim().Length >= 2 && p.Bio.Trim().Length >= 10 &&
        Genders.Contains(p.Gender) && p.DesiredGenders.Length > 0 && p.City.Trim().Length >= 2 &&
        p.Interests.Length > 0 && Goals.Contains(p.RelationshipGoal);
    public static void Validate(ProfileUpdate r)
    {
        if (r.DisplayName.Trim().Length < 2 || r.Bio.Trim().Length < 10 || r.City.Trim().Length < 2 ||
            !Genders.Contains(r.Gender) || !Goals.Contains(r.RelationshipGoal) ||
            r.DesiredGenders.Any(x => !Genders.Contains(x)) || r.DesiredGenders.Distinct().Count() != r.DesiredGenders.Length ||
            r.Interests.Any(x => !Interests.Contains(x)) || r.Interests.Distinct().Count() != r.Interests.Length)
            throw new AuthFailure(400, "invalid_profile");
    }
}
