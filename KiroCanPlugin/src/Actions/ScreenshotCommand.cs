namespace Loupedeck.KiroCanPlugin
{
    using System;

    /// <summary>Captures a screen region and sends to Kiro chat.</summary>
    public class ScreenshotCommand : PluginDynamicCommand
    {
        public ScreenshotCommand()
            : base("Screenshot", "Capture screen region for Kiro", "Kiro Commands") { }

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/screenshot");
        }
    }
}
