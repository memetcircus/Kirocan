namespace Loupedeck.KiroMxConsolePlugin
{
    using System;

    /// <summary>Tile 8 (Bottom-Right): Submits the current chat input (press Enter).</summary>
    public class GoCommand : AnimatedTileCommand
    {
        public GoCommand()
            : base("Go!", "Submit current chat input", "Snippets") { }

        protected override Int32 TileIndex => 8;
        protected override String IdleLabel => "Go!";

        protected override async void RunCommand(String actionParameter)
        {
            var body = System.Text.Json.JsonSerializer.Serialize(new { text = "Go!" });
            await BridgeClient.PostAsync("/prompt", body);
        }
    }
}
