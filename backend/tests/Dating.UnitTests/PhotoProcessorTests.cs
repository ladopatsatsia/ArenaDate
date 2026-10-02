using System.Text;
using Dating.Api.Features.Auth;
using Dating.Api.Features.Profiles;
using SkiaSharp;
using Xunit;
namespace Dating.UnitTests;
public class PhotoProcessorTests
{
    [Fact]
    public async Task Reencoding_strips_metadata_and_applies_EXIF_orientation_with_aspect_preserved()
    {
        using var bitmap = new SKBitmap(600, 400); bitmap.Erase(SKColors.Green);
        using var image = SKImage.FromBitmap(bitmap); using var data = image.Encode(SKEncodedImageFormat.Jpeg, 90);
        var jpeg = data.ToArray();
        byte[] tiff = [0x45,0x78,0x69,0x66,0,0, 0x49,0x49,0x2a,0,8,0,0,0,1,0,0x12,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0];
        var metadata = tiff.Concat(Encoding.ASCII.GetBytes("PRIVATE-GPS-CANARY")).ToArray();
        var input = jpeg[..2].Concat(new byte[] { 0xff, 0xe1, (byte)((metadata.Length+2)>>8), (byte)(metadata.Length+2) }).Concat(metadata).Concat(jpeg[2..]).ToArray();
        var result = await new PhotoProcessor().Process(input, CancellationToken.None);
        Assert.Equal(400, result.Width); Assert.Equal(600, result.Height);
        Assert.DoesNotContain("PRIVATE-GPS-CANARY", Encoding.Latin1.GetString(result.Image));
        Assert.DoesNotContain("Exif", Encoding.Latin1.GetString(result.Image));
        Assert.DoesNotContain("Exif", Encoding.Latin1.GetString(result.Thumbnail));
        using var thumbnail = SKBitmap.Decode(result.Thumbnail);
        Assert.Equal(400, thumbnail.Height); Assert.InRange(thumbnail.Width, 266, 267);
    }
    [Fact]
    public async Task Decoded_dimensions_and_byte_limits_are_enforced()
    {
        var processor = new PhotoProcessor();
        await Assert.ThrowsAsync<AuthFailure>(() => processor.Process(new byte[PhotoProcessor.MaxBytes+1], CancellationToken.None));
        using var bitmap = new SKBitmap(6001, 320); bitmap.Erase(SKColors.White);
        using var image = SKImage.FromBitmap(bitmap); using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        await Assert.ThrowsAsync<AuthFailure>(() => processor.Process(data.ToArray(), CancellationToken.None));
    }
}
