namespace Loupedeck.KiroCanPlugin
{
    using System;

    /// <summary>Submits the current chat input (press Enter).</summary>
    public class GoCommand : PluginDynamicCommand
    {
        public GoCommand()
            : base("Go!", "Submit current chat input", "Kiro Commands") { }

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/go");
        }
    }
}
