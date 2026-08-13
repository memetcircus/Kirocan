namespace Loupedeck.KiroCanPlugin
{
    using System;
    using System.Text.Json;

    /// <summary>Opens a structured prompt template in Kiro.</summary>
    public class StructPromptCommand : PluginDynamicCommand
    {
        public StructPromptCommand()
            : base("Struct Prompt", "Open structured prompt template", "Utilities") { }

        protected override async void RunCommand(String actionParameter)
        {
            var body = JsonSerializer.Serialize(new { text = "I want to: [goal]\nContext: [context]\nConstraints: [constraints]" });
            await BridgeClient.PostAsync("/snippet", body);
        }
    }

    /// <summary>Sends screen recording to Kiro chat.</summary>
    public class ScreenRecordCommand : PluginDynamicCommand
    {
        public ScreenRecordCommand()
            : base("Screen Record", "Record screen and send to Kiro", "Utilities") { }

        protected override async void RunCommand(String actionParameter)
        {
            var body = JsonSerializer.Serialize(new { mode = "quick" });
            await BridgeClient.PostAsync("/screen-record", body);
        }
    }

    /// <summary>Sends "understand this workspace" prompt.</summary>
    public class WorkspaceCommand : PromptCommandBase
    {
        public WorkspaceCommand() : base("Workspace", "analyze and explain this workspace structure and architecture") { }
    }

    /// <summary>Starts a Kiro spec session.</summary>
    public class StartSpecCommand : PromptCommandBase
    {
        public StartSpecCommand() : base("Start Spec", "start a new spec for this feature") { }
    }

    /// <summary>Generates a git commit message and commits.</summary>
    public class GitCommitCommand : PromptCommandBase
    {
        public GitCommitCommand() : base("Git Commit", "generate a conventional commit message for the current changes and commit") { }
    }
}
