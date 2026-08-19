namespace Loupedeck.KiroCanPlugin
{
    using System;

    /// <summary>
    /// Dial adjustment for navigating between Kiro sessions.
    /// Rotate right = next session, rotate left = previous session.
    /// Press = new session.
    /// </summary>
    public class SessionNavigateAdjustment : PluginDynamicAdjustment
    {
        public SessionNavigateAdjustment()
            : base("Navigate Sessions", "Rotate to switch sessions, press for new", "Kiro Commands", hasReset: false) { }

        protected override async void ApplyAdjustment(String actionParameter, Int32 diff)
        {
            if (diff > 0)
            {
                await BridgeClient.PostAsync("/session/next");
            }
            else if (diff < 0)
            {
                await BridgeClient.PostAsync("/session/previous");
            }
        }

        protected override async void RunCommand(String actionParameter)
        {
            // Press the dial = new session
            await BridgeClient.PostAsync("/new-session");
        }

        protected override String GetAdjustmentValue(String actionParameter) => "Sessions";
    }
}
