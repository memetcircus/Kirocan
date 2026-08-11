namespace Loupedeck.KiroCanPlugin;

/// <summary>
/// Main plugin entry point for KiroCan.
/// Registers with Logi Plugin Service under the LogitechCreativeFamily device family.
/// </summary>
public class KiroCanPlugin : Plugin
{
    public static KiroCanPlugin? Instance { get; private set; }
    public KiroCanApplication Application { get; } = new();

    public override void Load()
    {
        Instance = this;
        PluginResources.Init(this.Assembly);
        Application.Start();
    }

    public override void Unload()
    {
        Application.Stop();
        Instance = null;
    }
}
