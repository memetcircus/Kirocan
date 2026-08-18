namespace Loupedeck.KiroMxConsolePlugin
{
    using System;

    /// <summary>Opens Kiro inline chat (Ctrl+I).</summary>
    public class InlineChatCommand : PluginDynamicCommand
    {
        public InlineChatCommand()
            : base("Inline Chat", "Open Kiro inline chat", "Kiro Commands") { }

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/inline");
        }
    }
}
