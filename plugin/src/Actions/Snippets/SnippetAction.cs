namespace Loupedeck.KiroCanPlugin.Actions.Snippets;

/// <summary>
/// Generic action for snippet buttons (Page 1).
/// Appends text to Kiro chat input without submitting.
/// </summary>
public class SnippetAction : PluginDynamicCommand
{
    public SnippetAction() : base() { }

    protected override void RunCommand(string actionParameter)
    {
        var app = KiroCanPlugin.Instance?.Application;
        if (app == null || !app.IsBridgeConnected) return;

        // "Go" button sends Enter without typing — uses /go endpoint
        if (actionParameter == "Go")
        {
            _ = app.SendBridgeRequest("/go");
            return;
        }

        if (!PageLayout.SnippetTexts.TryGetValue(actionParameter, out var snippetText)) return;

        var json = System.Text.Json.JsonSerializer.Serialize(new { text = snippetText });
        _ = app.SendBridgeRequest("/snippet", json);
    }
}
