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

    /// <summary>Tile 1: Appends "be honest and critical" to chat.</summary>
    public class BeHonestCommand : SnippetCommandBase
    {
        public BeHonestCommand() : base("Be Honest", "be honest and critical", 1) { }
    }

    /// <summary>Tile 2: Appends "don't write code yet, just explain the approach" to chat.</summary>
    public class DontCodeYetCommand : SnippetCommandBase
    {
        public DontCodeYetCommand() : base("Don't Code Yet", "don't write code yet, just explain the approach", 2) { }
    }

    /// <summary>Tile 3: Appends "show me multiple options" to chat.</summary>
    public class ShowOptionsCommand : SnippetCommandBase
    {
        public ShowOptionsCommand() : base("Show Options", "show me multiple options", 3) { }
    }

    /// <summary>Tile 4: Appends "explain why this is the best approach" to chat.</summary>
    public class ExplainWhyCommand : SnippetCommandBase
    {
        public ExplainWhyCommand() : base("Explain Why", "explain why this is the best approach", 4) { }
    }

    /// <summary>Tile 6: Appends "keep it short and concise" to chat.</summary>
    public class KeepShortCommand : SnippetCommandBase
    {
        public KeepShortCommand() : base("Keep Short", "keep it short and concise", 6) { }
    }

    /// <summary>Tile 7: Appends "no tests needed" to chat.</summary>
    public class NoTestsCommand : SnippetCommandBase
    {
        public NoTestsCommand() : base("No Tests", "no tests needed", 7) { }
    }
}
