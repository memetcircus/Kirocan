namespace Loupedeck.KiroCanPlugin.Actions;

/// <summary>
/// Generic action for utility buttons.
/// Routes each button to its corresponding Bridge endpoint.
/// Stop button uses debounce to discard rapid repeat presses within 1 second.
/// </summary>
public class UtilityAction : PluginDynamicCommand
{
    private readonly ButtonDebounce _stopDebounce = new(TimeSpan.FromSeconds(1));

    public UtilityAction() : base() { }

    protected override void RunCommand(string actionParameter)
    {
        var app = KiroCanPlugin.Instance?.Application;
        if (app == null || !app.IsBridgeConnected) return;

        // Stop button has 1-second debounce
        if (actionParameter == "Stop")
        {
            if (!_stopDebounce.ShouldProcess()) return;
        }

        // Check if this is a utility that sends a fixed prompt
        if (PageLayout.UtilityPromptTexts.TryGetValue(actionParameter, out var promptText))
        {
            var json = System.Text.Json.JsonSerializer.Serialize(new { text = promptText });
            _ = app.SendBridgeRequest("/prompt", json);
            return;
        }

        // Check if this maps to a direct endpoint
        if (PageLayout.UtilityEndpoints.TryGetValue(actionParameter, out var endpoint))
        {
            // ScreenRecord needs a mode - default to quick
            if (actionParameter == "ScreenRecord")
            {
                var json = System.Text.Json.JsonSerializer.Serialize(new { mode = "quick" });
                _ = app.SendBridgeRequest(endpoint, json);
            }
            else
            {
                _ = app.SendBridgeRequest(endpoint);
            }
            return;
        }
    }
}
