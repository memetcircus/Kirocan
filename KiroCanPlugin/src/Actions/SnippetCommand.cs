namespace Loupedeck.KiroCanPlugin
{
    using System;
    using System.Text.Json;

    /// <summary>
    /// Base for snippet commands on Page 1 that show animated tiles when Kiro is working.
    /// </summary>
    public abstract class SnippetCommandBase : AnimatedTileCommand
    {
        private readonly String _snippetText;

        protected SnippetCommandBase(String displayName, String snippetText, Int32 tileIndex)
            : base(displayName, $"Append \"{snippetText}\" to chat", "Snippets")
        {
            _snippetText = snippetText;
            _tileIndex = tileIndex;
        }

        private readonly Int32 _tileIndex;
        protected override Int32 TileIndex => _tileIndex;
        protected override String IdleLabel => this.DisplayName;

        protected override async void RunCommand(String actionParameter)
        {
            var body = JsonSerializer.Serialize(new { text = _snippetText });
            await BridgeClient.PostAsync("/snippet", body);
        }
    }

    /// <summary>Tile 1: Appends "be honest" qualifier to chat.</summary>
    public class BeHonestCommand : SnippetCommandBase
    {
        public BeHonestCommand() : base("Be Honest", " Be direct and critical. Point out problems, don't sugarcoat.", 1) { }
    }

    /// <summary>Tile 2: Appends "don't code yet" qualifier to chat.</summary>
    public class DontCodeYetCommand : SnippetCommandBase
    {
        public DontCodeYetCommand() : base("Don't Code Yet", " Don't write code yet. Explain the approach first, then wait for approval.", 2) { }
    }

    /// <summary>Tile 3: Appends "show options" qualifier to chat.</summary>
    public class ShowOptionsCommand : SnippetCommandBase
    {
        public ShowOptionsCommand() : base("Show Options", " Show me 2-3 different approaches with tradeoffs before picking one.", 3) { }
    }

    /// <summary>Tile 4: Appends "explain why" qualifier to chat.</summary>
    public class ExplainWhyCommand : SnippetCommandBase
    {
        public ExplainWhyCommand() : base("Explain Why", " Explain your reasoning. Why this approach over alternatives?", 4) { }
    }

    /// <summary>Tile 6: Appends "keep short" qualifier to chat.</summary>
    public class KeepShortCommand : SnippetCommandBase
    {
        public KeepShortCommand() : base("Keep Short", " Keep it concise. No boilerplate, no filler, just the essential changes.", 6) { }
    }

    /// <summary>Tile 7: Appends "no tests" qualifier to chat.</summary>
    public class NoTestsCommand : SnippetCommandBase
    {
        public NoTestsCommand() : base("No Tests", " Don't add tests. Focus only on the implementation.", 7) { }
    }
}
