namespace Loupedeck.KiroCanPlugin
{
    using System;

    /// <summary>Stops/cancels the current Kiro generation (same as Cancel but for Page 1 layout).</summary>
    public class StopCommand : PluginDynamicCommand
    {
        public StopCommand()
            : base("Stop", "Stop current Kiro generation", "Snippets") { }

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/cancel");
        }
    }
}
