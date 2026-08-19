namespace Loupedeck.KiroCanPlugin
{
    using System;

    /// <summary>Cancels the current Kiro generation.</summary>
    public class CancelCommand : PluginDynamicCommand
    {
        public CancelCommand()
            : base("Cancel", "Cancel current Kiro generation", "Kiro Commands") { }

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/cancel");
        }
    }
}
