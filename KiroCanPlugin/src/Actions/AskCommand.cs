namespace Loupedeck.KiroCanPlugin
{
    using System;

    /// <summary>Copies selection and sends to Kiro chat.</summary>
    public class AskCommand : PluginDynamicCommand
    {
        public AskCommand()
            : base("Ask Kiro", "Copy selection and send to Kiro chat", "Kiro Commands") { }

        protected override async void RunCommand(String actionParameter)
        {
            await BridgeClient.PostAsync("/ask");
        }
    }
}
