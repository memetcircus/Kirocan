namespace Loupedeck.KiroMxConsolePlugin
{
    using System;

    /// <summary>Saves all open files in Kiro IDE (Ctrl+K S).</summary>
    public class SaveAllCommand : PluginDynamicCommand
    {
        public SaveAllCommand()
            : base("Save All", "Save all open files", "Utilities") { }

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/save-all");
        }
    }
}
