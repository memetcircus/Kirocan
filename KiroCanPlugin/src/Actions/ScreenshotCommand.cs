namespace Loupedeck.KiroCanPlugin
{
    using System;

    /// <summary>Tile 0 (Top-Left): Captures a screen region and sends to Kiro chat.</summary>
    public class ScreenshotCommand : AnimatedTileCommand
    {
        public ScreenshotCommand()
            : base("Screenshot", "Capture screen region for Kiro", "Snippets") { }

        protected override Int32 TileIndex => 0;
        protected override String IdleLabel => "Screenshot";

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/screenshot");
        }
    }
}
