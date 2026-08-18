namespace Loupedeck.KiroMxConsolePlugin
{
    using System;

    /// <summary>Adds clipboard content to the basket queue for pasting into Kiro chat.</summary>
    public class AskCommand : PluginDynamicCommand
    {
        public AskCommand()
            : base("Paste To Kiro", "Add clipboard to Kiro chat basket", "Kiro Commands") { }

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/ask");
        }
    }
}
