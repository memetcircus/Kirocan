namespace Loupedeck.KiroCanPlugin.Actions.Prompts;

using Loupedeck.KiroCanPlugin.Models;

/// <summary>
/// Generic action for prompt command buttons (Page 3).
/// Each instance handles one prompt: types the text into Kiro and submits.
/// Starts ghost animation on press, stops on idle.
/// </summary>
public class PromptCommandAction : PluginDynamicCommand
{
    public PromptCommandAction() : base() { }

    protected override void RunCommand(string actionParameter)
    {
        // Get the app instance
        var app = KiroCanPlugin.Instance?.Application;
        if (app == null || !app.IsBridgeConnected) return;

        // Ignore if already working
        if (app.CurrentState == BridgeState.Working) return;

        // Get the prompt text for this button
        if (!PageLayout.PromptTexts.TryGetValue(actionParameter, out var promptText)) return;

        // Send to Bridge via /prompt endpoint
        var json = System.Text.Json.JsonSerializer.Serialize(new { text = promptText });
        _ = app.SendBridgeRequest("/prompt", json);
    }
}
