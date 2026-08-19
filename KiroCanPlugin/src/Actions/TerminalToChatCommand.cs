namespace Loupedeck.KiroCanPlugin
{
    using System;

    /// <summary>Sends terminal output to Kiro chat.</summary>
    public class TerminalToChatCommand : PluginDynamicCommand
    {
        public TerminalToChatCommand()
            : base("Terminal to Chat", "Send terminal output to Kiro chat", "Kiro Commands") { }

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/terminal");
        }
    }
}
