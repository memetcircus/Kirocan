namespace Loupedeck.KiroMxConsolePlugin
{
    using System;

    /// <summary>Opens a new Kiro session.</summary>
    public class NewSessionCommand : PluginDynamicCommand
    {
        public NewSessionCommand()
            : base("New Session", "Open a new Kiro session", "Kiro Commands") { }

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/new-session");
        }
    }
}
