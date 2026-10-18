using System.Diagnostics;

namespace Dating.Api.Features.Game.Ai;

public sealed class DeterministicAiCommentaryProvider : IAiCommentaryProvider
{
    private static readonly string[] MatchTemplates =
    [
        "ორივემ «{0}» აირჩიეთ — შესანიშნავი საერთო ხედვაა!",
        "სრული თანხვედრა: «{0}»! საერთო გემოვნება ყოველთვის კარგი დასაწყისია.",
        "ერთსულოვანი არჩევანი: «{0}» — პირველივე ნაბიჯზე ერთი ტალღაა.",
        "ორივეს სიმპათია «{0}»-სკენაა — საინტერესო დამთხვევაა!"
    ];

    private static readonly string[] DifferenceTemplates =
    [
        "ერთი ირჩევს «{0}», მეორე — «{1}». განსხვავებული ხედვები ურთიერთობას აცოცხლებს!",
        "კონტრასტული არჩევანი: «{0}» და «{1}» — საინტერესო დისკუსიის კარგი საბაბი.",
        "მრავალფეროვნება ყოველთვის ამაღელვებელია: «{0}» vs «{1}».",
        "სხვადასხვა პრიორიტეტები: «{0}» და «{1}» — ახალი თემები საუბრისთვის!"
    ];

    public Task<AiCommentaryResult> GenerateQuestionCommentaryAsync(QuestionCommentaryContext context, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        string text;
        if (context.IsMatch)
        {
            var templateIndex = Math.Abs((context.SpinnerOptionIndex * 31 + context.QuestionText.GetHashCode()) % MatchTemplates.Length);
            var template = MatchTemplates[templateIndex];
            text = string.Format(template, context.SpinnerOptionText);
        }
        else
        {
            var templateIndex = Math.Abs((context.SpinnerOptionIndex * 17 + context.TargetOptionIndex * 37 + context.QuestionText.GetHashCode()) % DifferenceTemplates.Length);
            var template = DifferenceTemplates[templateIndex];
            text = string.Format(template, context.SpinnerOptionText, context.TargetOptionText);
        }

        sw.Stop();
        return Task.FromResult(new AiCommentaryResult(
            Success: true,
            Commentary: text,
            Provider: "DeterministicFallback",
            IsFallback: true,
            LatencyMs: sw.ElapsedMilliseconds
        ));
    }

    public Task<AiCommentaryResult> GenerateRoundSummaryAsync(RoundSummaryContext context, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();

        string text;
        if (context.AnsweredQuestionsCount == 0)
        {
            text = "ამ რაუნდში კითხვებზე პასუხები გამოტოვებული იყო — შემდეგ რაუნდში უკეთ შეძლებთ ერთმანეთის გაცნობას!";
        }
        else if (context.AnsweredQuestionsCount < context.TotalQuestionsCount)
        {
            // Partial completed round
            if (context.MatchesCount == 0)
            {
                text = $"{context.AnsweredQuestionsCount} დასრულებული კითხვიდან განსხვავებული არჩევანი დაფიქსირდა — მრავალფეროვანი შეხედულებები საუბარს უფრო საინტერესოს ხდის!";
            }
            else
            {
                text = $"{context.AnsweredQuestionsCount} დასრულებული კითხვიდან {context.MatchesCount} თანხვედრა — მოკლე, მაგრამ შთამბეჭდავი რაუნდი!";
            }
        }
        else
        {
            // Full 5 questions answered
            if (context.MatchesCount == 0)
            {
                text = "5-ვე კითხვაზე განსხვავებული ხედვები დაფიქსირდა — კონტრასტული შეხედულებები საუკეთესო საუბრის თემებს ქმნის!";
            }
            else if (context.MatchesCount <= 2)
            {
                text = $"5 კითხვიდან {context.MatchesCount} თანხვედრა — სასიამოვნო ბალანსი მსგავსებებსა და თავისებურებებს შორის.";
            }
            else if (context.MatchesCount <= 4)
            {
                text = $"5 კითხვიდან {context.MatchesCount} თანხვედრა — საკმაოდ ბევრი საერთო ინტერესი გამოიკვეთა!";
            }
            else
            {
                text = "5-დან 5-ვე თანხვედრა! იშვიათი ერთსულოვნება ყველა თემაზე.";
            }
        }

        sw.Stop();
        return Task.FromResult(new AiCommentaryResult(
            Success: true,
            Commentary: text,
            Provider: "DeterministicFallback",
            IsFallback: true,
            LatencyMs: sw.ElapsedMilliseconds
        ));
    }
}
