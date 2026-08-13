namespace Loupedeck.KiroCanPlugin
{
    using System;

    /// <summary>
    /// Main plugin entry point for KiroCan.
    /// Manages the bridge health monitor lifecycle.
    /// </summary>
    public class KiroCanPlugin : Plugin
    {
        public override Boolean UsesApplicationApiOnly => true;
        public override Boolean HasNoApplication => true;

        /// <summary>Shared health monitor instance used by actions.</summary>
        internal BridgeHealthMonitor HealthMonitor { get; private set; }

        public KiroCanPlugin()
        {
            PluginLog.Init(this.Log);
            PluginResources.Init(this.Assembly);
        }

        public override void Load()
        {
            HealthMonitor = new BridgeHealthMonitor();
            HealthMonitor.Start();
            PluginLog.Info("KiroCan plugin loaded, health monitor started");
        }

        public override void Unload()
        {
            HealthMonitor?.Stop();
            HealthMonitor?.Dispose();
            HealthMonitor = null;
            PluginLog.Info("KiroCan plugin unloaded");
        }
    }
}
