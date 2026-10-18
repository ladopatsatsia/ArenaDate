namespace Dating.Api.Features.Matching;

public sealed class DiscoverySuperLike
{
    public Guid Id { get; set; }
    public Guid SenderUserId { get; set; }
    public Guid TargetUserId { get; set; }
    public string? Note { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}
