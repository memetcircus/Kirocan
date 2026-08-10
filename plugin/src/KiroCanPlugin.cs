namespace Loupedeck.KiroCanPlugin
{
    public class KiroCanPlugin : Plugin
    {
        public override void Load()
        {
            PluginResources.Init(this.Assembly);
        }

        public override void Unload()
        {
        }
    }
}
