using Dating.Api.Features.Auth;
using SkiaSharp;
namespace Dating.Api.Features.Profiles;
public sealed record ProcessedPhoto(byte[] Image, byte[] Thumbnail, int Width, int Height);
public sealed class PhotoProcessor
{
    public const int MaxBytes = 8 * 1024 * 1024;
    private readonly SemaphoreSlim slots = new(2);
    public async Task<ProcessedPhoto> Process(byte[] input, CancellationToken ct)
    {
        if (input.Length is 0 or > MaxBytes) throw new AuthFailure(400, "invalid_photo");
        if (!await slots.WaitAsync(0, ct)) throw new AuthFailure(429, "image_busy");
        try
        {
            using var data = SKData.CreateCopy(input);
            using var codec = SKCodec.Create(data);
            if (codec is null || codec.EncodedFormat is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp) ||
                codec.Info.Width < 320 || codec.Info.Height < 320 || codec.Info.Width > 6000 || codec.Info.Height > 6000 ||
                (long)codec.Info.Width * codec.Info.Height > 12_000_000 || codec.FrameCount > 1)
                throw new AuthFailure(400, "invalid_photo");
            using var bitmap = new SKBitmap(new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Premul));
            if (codec.GetPixels(bitmap.Info, bitmap.GetPixels()) != SKCodecResult.Success) throw new AuthFailure(400, "invalid_photo");
            var swapped = (int)codec.EncodedOrigin >= 5;
            var width = swapped ? bitmap.Height : bitmap.Width;
            var height = swapped ? bitmap.Width : bitmap.Height;
            byte[] Encode(int maxSide)
            {
                var scale = Math.Min(1f, (float)maxSide / Math.Max(width, height));
                using var target = new SKBitmap(Math.Max(1, (int)(width * scale)), Math.Max(1, (int)(height * scale)));
                using var canvas = new SKCanvas(target);
                canvas.Clear(SKColors.White);
                canvas.Scale(scale);
                var w = bitmap.Width; var h = bitmap.Height;
                var matrix = (int)codec.EncodedOrigin switch {
                    2 => new SKMatrix(-1, 0, w, 0, 1, 0, 0, 0, 1),
                    3 => new SKMatrix(-1, 0, w, 0, -1, h, 0, 0, 1),
                    4 => new SKMatrix(1, 0, 0, 0, -1, h, 0, 0, 1),
                    5 => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
                    6 => new SKMatrix(0, -1, h, 1, 0, 0, 0, 0, 1),
                    7 => new SKMatrix(0, -1, h, -1, 0, w, 0, 0, 1),
                    8 => new SKMatrix(0, 1, 0, -1, 0, w, 0, 0, 1),
                    _ => SKMatrix.Identity };
                canvas.Concat(matrix);
                using var image = SKImage.FromBitmap(bitmap);
                canvas.DrawImage(image, 0, 0, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));
                using var encoded = SKImage.FromBitmap(target);
                using var jpeg = encoded.Encode(SKEncodedImageFormat.Jpeg, 85);
                return jpeg.ToArray();
            }
            var ratio = Math.Min(1f, 1600f / Math.Max(width, height));
            return new(Encode(1600), Encode(400), (int)(width * ratio), (int)(height * ratio));
        }
        finally { slots.Release(); }
    }
}
