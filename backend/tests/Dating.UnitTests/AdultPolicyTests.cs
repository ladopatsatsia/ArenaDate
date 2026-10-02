using Dating.Api.Features.Auth;
using Xunit;
namespace Dating.UnitTests;
public class AdultPolicyTests
{
    [Theory]
    [InlineData("2008-09-30", "2026-09-30T00:00:00Z", true)]
    [InlineData("2008-10-01", "2026-09-30T23:59:59Z", false)]
    [InlineData("2008-09-30", "2026-09-29T23:59:59Z", false)]
    [InlineData("2008-02-29", "2026-02-28T12:00:00Z", false)]
    [InlineData("2008-02-29", "2026-03-01T00:00:00Z", true)]
    [InlineData("2027-01-01", "2026-09-30T00:00:00Z", false)]
    [InlineData("1900-01-01", "2026-09-30T00:00:00Z", false)]
    public void Adult_boundary_is_computed_using_utc(string dob, string now, bool expected) =>
        Assert.Equal(expected, AdultPolicy.IsAdult(DateOnly.Parse(dob), DateTimeOffset.Parse(now)));
}
