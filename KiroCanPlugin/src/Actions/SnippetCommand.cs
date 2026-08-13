namespace Loupedeck.KiroCanPlugin
{
    using System;
    using System.Text.Json;

    /// <summary>
    /// A command that appends a snippet qualifier to the Kiro chat input without sending.
    /// Each instance is configured with a display name and snippet text.
    /// </summary>
    public abstract class SnippetCommandBase : PluginDynamicCommand
    {
        private readonly String _snippetText;

        protected SnippetCommandBase(String displayName, String snippetText, String description = null)
            : base(displayName, description ?? $"Append \"{snippetText}\" to chat", "Snippets")
        {
            _snippetText = snippetText;
        }

        protected override async void RunCommand(String actionParameter)
        {
            var body = JsonSerializer.Serialize(new { text = _snippetText });
            await BridgeClient.PostAsync("/snippet", body);
        }
    }

    /// <summary>Appends "be honest and critical" to chat.</summary>
    public class BeHonestCommand : SnippetCommandBase
    {
        public BeHonestCommand() : base("Be Honest", "be honest and critical") { }
    }

    /// <summary>Appends "don't write code yet, just explain the approach" to chat.</summary>
    public class DontCodeYetCommand : SnippetCommandBase
    {
        public DontCodeYetCommand() : base("Don't Code Yet", "don't write code yet, just explain the approach") { }
    }

    /// <summary>Appends "show me multiple options" to chat.</summary>
    public class ShowOptionsCommand : SnippetCommandBase
    {
        public ShowOptionsCommand() : base("Show Options", "show me multiple options") { }
    }

    /// <summary>Appends "explain why this is the best approach" to chat.</summary>
    public class ExplainWhyCommand : SnippetCommandBase
    {
        public ExplainWhyCommand() : base("Explain Why", "explain why this is the best approach") { }
    }

    /// <summary>Appends "keep it short and concise" to chat.</summary>
    public class KeepShortCommand : SnippetCommandBase
    {
        public KeepShortCommand() : base("Keep Short", "keep it short and concise") { }
    }

    /// <summary>Appends "no tests needed" to chat.</summary>
    public class NoTestsCommand : SnippetCommandBase
    {
        public NoTestsCommand() : base("No Tests", "no tests needed") { }
    }
}
