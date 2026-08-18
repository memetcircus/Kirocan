namespace Loupedeck.KiroMxConsolePlugin
{
    using System;
    using System.Text.Json;

    /// <summary>
    /// A command that types a prompt into Kiro chat and submits it.
    /// Each instance is configured with a display name and prompt text.
    /// </summary>
    public abstract class PromptCommandBase : PluginDynamicCommand
    {
        private readonly String _promptText;

        protected PromptCommandBase(String displayName, String promptText, String description = null)
            : base(displayName, description ?? $"Send \"{promptText}\" prompt", "Prompts")
        {
            _promptText = promptText;
        }

        protected override async void RunCommand(String actionParameter)
        {
            var body = JsonSerializer.Serialize(new { text = _promptText });
            await BridgeClient.PostAsync("/prompt", body);
        }
    }

    /// <summary>Send "criticize this code" prompt.</summary>
    public class CriticizeCommand : PromptCommandBase
    {
        public CriticizeCommand() : base("Criticize", "criticize this code, find problems and suggest improvements") { }
    }

    /// <summary>Send "refactor this" prompt.</summary>
    public class RefactorCommand : PromptCommandBase
    {
        public RefactorCommand() : base("Refactor", "refactor this code for clarity and maintainability") { }
    }

    /// <summary>Send "write tests" prompt.</summary>
    public class WriteTestsCommand : PromptCommandBase
    {
        public WriteTestsCommand() : base("Write Tests", "write comprehensive tests for this code") { }
    }

    /// <summary>Send "explain this" prompt.</summary>
    public class ExplainCommand : PromptCommandBase
    {
        public ExplainCommand() : base("Explain", "explain this code step by step") { }
    }

    /// <summary>Send "fix this bug" prompt.</summary>
    public class FixBugCommand : PromptCommandBase
    {
        public FixBugCommand() : base("Fix Bug", "find and fix the bug in this code") { }
    }

    /// <summary>Send "optimize" prompt.</summary>
    public class OptimizeCommand : PromptCommandBase
    {
        public OptimizeCommand() : base("Optimize", "optimize this code for performance") { }
    }

    /// <summary>Send "review" prompt.</summary>
    public class ReviewCommand : PromptCommandBase
    {
        public ReviewCommand() : base("Review", "review this code and provide feedback") { }
    }

    /// <summary>Send "document" prompt.</summary>
    public class DocumentCommand : PromptCommandBase
    {
        public DocumentCommand() : base("Document", "add documentation and comments to this code") { }
    }

    /// <summary>Send "simplify" prompt.</summary>
    public class SimplifyCommand : PromptCommandBase
    {
        public SimplifyCommand() : base("Simplify", "simplify this code, remove unnecessary complexity") { }
    }
}
