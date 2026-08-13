namespace Loupedeck.KiroCanPlugin
{
    using System;

    /// <summary>Tile 5 (Middle-Right): Stops/cancels the current Kiro generation.</summary>
    public class StopCommand : AnimatedTileCommand
    {
        public StopCommand()
            : base("Stop", "Stop current Kiro generation", "Snippets") { }

        protected override Int32 TileIndex => 5;
        protected override String IdleLabel => "Stop";

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/cancel");
        }
    }
}
