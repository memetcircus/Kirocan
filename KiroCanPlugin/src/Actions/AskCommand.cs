namespace Loupedeck.KiroCanPlugin
{
    using System;

    /// <summary>Flushes all queued clipboard basket items into Kiro chat immediately.</summary>
    public class AskCommand : PluginDynamicCommand
    {
        public AskCommand()
            : base("Paste To Kiro", "Paste all queued clipboard items into chat now", "Utilities") { }

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/flush-basket");
        }
    }
}
