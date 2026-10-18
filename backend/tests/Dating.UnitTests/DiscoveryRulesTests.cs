using Dating.Api.Features.Auth;
using Dating.Api.Features.Discovery;
using Xunit;
namespace Dating.UnitTests;
public class DiscoveryRulesTests
{
    [Theory]
    [InlineData("  Tbilisi  ", "TBILISI")]
    [InlineData("New   York", "NEW YORK")]
    [InlineData("new\tyork", "NEW YORK")]
    [InlineData("თბილისი", "TBILISI")]
    [InlineData("ბათუმი", "BATUMI")]
    [InlineData("ქუთაისი", "KUTAISI")]
    [InlineData("სოხუმი", "SOKHUMI")]
    [InlineData("ცხინვალი", "TSKHINVALI")]
    [InlineData("აფხაზეთი", "ABKHAZIA")]
    [InlineData("Tiflis", "TBILISI")]
    public void Cities_have_explicit_case_and_whitespace_normalization(string city,string expected)=>Assert.Equal(expected,DiscoveryRules.CityKey(city));
    [Theory]
    [InlineData(91,0)]
    [InlineData(0,181)]
    [InlineData(double.NaN,0)]
    public void Invalid_coordinates_are_rejected(double lat,double lon)=>Assert.Throws<AuthFailure>(()=>DiscoveryRules.Coarsen(lat,lon));
    [Theory]
    [InlineData(9999,"under_10")]
    [InlineData(10000,"10_25")]
    [InlineData(25000,"25_50")]
    [InlineData(50000,"50_100")]
    public void Distance_is_only_a_coarse_bucket(double meters,string bucket)=>Assert.Equal(bucket,DiscoveryRules.Bucket(meters));
}
