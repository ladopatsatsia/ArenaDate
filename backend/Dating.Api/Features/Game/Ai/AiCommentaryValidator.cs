using System.Text.RegularExpressions;

namespace Dating.Api.Features.Game.Ai;

public static class AiCommentaryValidator
{
    private static readonly Regex GeorgianScriptRegex = new(@"[\u10D0-\u10FF]", RegexOptions.Compiled);

    private static readonly string[] RefusalPhrases =
    [
        "i cannot",
        "i can't",
        "as an ai",
        "language model",
        "sorry",
        "ბოდიში",
        "ვერ შევძლებ",
        "როგორც ხელოვნური ინტელექტი",
        "როგორც ai"
    ];

    private static readonly string[] ProhibitedAttractionPhrases =
    [
        "თავსებადობაა",
        "თავსებადობა 100",
        "იდეალური წყვილი ხართ",
        "ბედისწერაა",
        "ნამდვილი სიყვარულია",
        "სიყვარულს იპოვით",
        "დაქორწინდებით",
        "შეუფერებლები ხართ",
        "არაფერი გამოვა",
        "ცუდი არჩევანია",
        "სამწუხარო არჩევანია"
    ];

    private static readonly string[] ProhibitedPressurePhrases =
    [
        "აკოცე",
        "კოცნის დროა",
        "კოცნა აუცილებელია",
        "უნდა აკოცო",
        "კრისტალი",
        "გადაიხადე",
        "იყიდე",
        "დახარჯე"
    ];

    public static (bool IsValid, string? RejectionReason) Validate(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return (false, "Commentary text is empty or whitespace.");
        }

        var trimmed = text.Trim();

        if (trimmed.Length < 8)
        {
            return (false, $"Commentary too short ({trimmed.Length} chars). Minimum is 8.");
        }

        if (trimmed.Length > 250)
        {
            return (false, $"Commentary too long ({trimmed.Length} chars). Maximum is 250.");
        }

        var lower = trimmed.ToLowerInvariant();

        foreach (var refusal in RefusalPhrases)
        {
            if (lower.Contains(refusal))
            {
                return (false, $"Refusal phrase detected: '{refusal}'.");
            }
        }

        if (!GeorgianScriptRegex.IsMatch(trimmed))
        {
            return (false, "Commentary must contain Georgian characters.");
        }

        foreach (var attraction in ProhibitedAttractionPhrases)
        {
            if (lower.Contains(attraction))
            {
                return (false, $"Prohibited attraction/compatibility diagnosis detected: '{attraction}'.");
            }
        }

        foreach (var pressure in ProhibitedPressurePhrases)
        {
            if (lower.Contains(pressure))
            {
                return (false, $"Prohibited pressure or monetization phrase detected: '{pressure}'.");
            }
        }

        return (true, null);
    }
}
