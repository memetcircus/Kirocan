namespace Loupedeck.KiroCanPlugin;

/// <summary>
/// Defines the 3-page LCD button layout for the MX Creative Console.
/// Each page has 9 buttons (3x3 grid, left-to-right, top-to-bottom).
/// </summary>
public static class PageLayout
{
    /// <summary>
    /// Page 1: Snippets &amp; Controls.
    /// Ghost animation renders on these buttons while state is "working".
    /// </summary>
    public static readonly string[] Page1 =
    {
        "Screenshot", "BeHonest", "DontCodeYet",
        "ShowOptions", "ExplainWhy", "Stop",
        "KeepShort", "NoTests", "Go"
    };

    /// <summary>
    /// Page 2: Utility Controls.
    /// NO ghost animation on these buttons regardless of state.
    /// </summary>
    public static readonly string[] Page2 =
    {
        "NewSession", "StructPrompt", "InlineChat",
        "TerminalToChat", "ScreenRecord", "AskKiro",
        "UnderstandWorkspace", "StartSpec", "GitCommit"
    };

    /// <summary>
    /// Page 3: Prompt Commands.
    /// Ghost animation renders on these buttons while state is "working".
    /// </summary>
    public static readonly string[] Page3 =
    {
        "Criticize", "Refactor", "WriteTests",
        "Explain", "FixBug", "Optimize",
        "Review", "Document", "Simplify"
    };

    /// <summary>
    /// Maps snippet button names to their text content.
    /// These are appended to chat input without sending.
    /// </summary>
    public static readonly Dictionary<string, string> SnippetTexts = new()
    {
        { "BeHonest", "Be honest, criticize. Suggest better alternatives." },
        { "DontCodeYet", "Don't write code yet. Let's discuss first." },
        { "ShowOptions", "Give me 2-3 options to choose from." },
        { "ExplainWhy", "Explain your reasoning." },
        { "KeepShort", "Be concise, short answer." },
        { "NoTests", "Don't add tests unless I ask." }
    };

    /// <summary>
    /// Maps prompt button names to their command text.
    /// These are typed into chat and submitted with Enter.
    /// </summary>
    public static readonly Dictionary<string, string> PromptTexts = new()
    {
        { "Criticize", "Criticize this code" },
        { "Refactor", "Refactor this code" },
        { "WriteTests", "Write tests for this code" },
        { "Explain", "Explain this code" },
        { "FixBug", "Fix the bug in this code" },
        { "Optimize", "Optimize this code" },
        { "Review", "Review this code" },
        { "Document", "Document this code" },
        { "Simplify", "Simplify this code" }
    };

    /// <summary>
    /// Maps utility button names to their Bridge endpoints.
    /// </summary>
    public static readonly Dictionary<string, string> UtilityEndpoints = new()
    {
        { "NewSession", "/new-session" },
        { "StructPrompt", "/prompt" },
        { "InlineChat", "/inline" },
        { "TerminalToChat", "/terminal" },
        { "ScreenRecord", "/screen-record" },
        { "AskKiro", "/ask" },
        { "Screenshot", "/screenshot" },
        { "Stop", "/cancel" },
        { "Go", "/go" }
    };

    /// <summary>
    /// Maps utility buttons that send fixed prompts to their text.
    /// </summary>
    public static readonly Dictionary<string, string> UtilityPromptTexts = new()
    {
        { "UnderstandWorkspace", "Analyze and summarize this project structure" },
        { "StartSpec", "Start a spec workflow for this feature" },
        { "GitCommit", "Generate a commit message from current git diff and commit" }
    };

    /// <summary>
    /// Returns whether a page supports ghost animation overlay.
    /// Pages 1 and 3 animate; Page 2 does not.
    /// </summary>
    public static bool PageSupportsAnimation(int pageNumber) => pageNumber != 2;
}
