namespace Loupedeck.KiroCanPlugin
{
    using System;
    using System.Diagnostics;
    using System.IO;
    using System.Net.Http;

    /// <summary>
    /// Main plugin entry point for KiroCan.
    /// Manages the bridge process and health monitor lifecycle.
    /// </summary>
    public class KiroCanPlugin : Plugin
    {
        public override Boolean UsesApplicationApiOnly => true;
        public override Boolean HasNoApplication => true;

        /// <summary>Shared health monitor instance used by actions.</summary>
        internal BridgeHealthMonitor HealthMonitor { get; private set; }

        private Process _bridgeProcess;
        private static readonly HttpClient _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };

        public KiroCanPlugin()
        {
            PluginLog.Init(this.Log);
            PluginResources.Init(this.Assembly);
        }

        public override void Load()
        {
            StartBridge();

            HealthMonitor = new BridgeHealthMonitor();
            HealthMonitor.Start();
            PluginLog.Info("KiroCan plugin loaded, health monitor started");

            HealthMonitorReady?.Invoke(this, EventArgs.Empty);
        }

        /// <summary>Fired after HealthMonitor is created, so actions can subscribe.</summary>
        internal event EventHandler HealthMonitorReady;

        public override void Unload()
        {
            HealthMonitor?.Stop();
            HealthMonitor?.Dispose();
            HealthMonitor = null;
            StopBridge();
            PluginLog.Info("KiroCan plugin unloaded");
        }

        private void StartBridge()
        {
            try
            {
                if (IsBridgeAlreadyRunning())
                {
                    PluginLog.Info("Bridge already running on port 9848, skipping spawn");
                    return;
                }

                var bridgeDir = FindBridgeDirectory();
                if (bridgeDir == null)
                {
                    PluginLog.Warning("Bridge directory not found");
                    return;
                }

                var nodeExe = Path.Combine(bridgeDir, "node.exe");
                var indexJs = Path.Combine(bridgeDir, "dist", "index.js");

                if (!File.Exists(nodeExe))
                {
                    PluginLog.Warning($"node.exe not found at: {nodeExe}");
                    return;
                }

                if (!File.Exists(indexJs))
                {
                    PluginLog.Warning($"dist/index.js not found at: {indexJs}");
                    return;
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = $"\"{indexJs}\"",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = false,
                    RedirectStandardError = false,
                    WorkingDirectory = bridgeDir
                };

                _bridgeProcess = Process.Start(startInfo);
                PluginLog.Info($"Bridge process started (PID: {_bridgeProcess?.Id}) from {bridgeDir}");
            }
            catch (Exception ex)
            {
                PluginLog.Error($"Failed to start bridge: {ex.Message}");
            }
        }

        private String FindBridgeDirectory()
        {
            // 1. Assembly.Location (dev mode with .link)
            var asmLocation = GetType().Assembly.Location;
            if (!String.IsNullOrEmpty(asmLocation))
            {
                var asmDir = Path.GetDirectoryName(asmLocation);
                if (!String.IsNullOrEmpty(asmDir))
                {
                    var candidate = Path.Combine(asmDir, "bridge");
                    if (File.Exists(Path.Combine(candidate, "node.exe")))
                        return candidate;
                }
            }

            // 2. Installed plugin location
            var pluginDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Logi", "LogiPluginService", "Plugins", "KiroCan", "bin", "bridge");
            if (File.Exists(Path.Combine(pluginDir, "node.exe")))
                return pluginDir;

            return null;
        }

        private void StopBridge()
        {
            try
            {
                if (_bridgeProcess != null && !_bridgeProcess.HasExited)
                {
                    _bridgeProcess.Kill();
                    _bridgeProcess.WaitForExit(3000);
                    PluginLog.Info("Bridge process stopped");
                }
            }
            catch (Exception ex)
            {
                PluginLog.Warning($"Error stopping bridge: {ex.Message}");
            }
            finally
            {
                _bridgeProcess?.Dispose();
                _bridgeProcess = null;
            }
        }

        private Boolean IsBridgeAlreadyRunning()
        {
            try
            {
                var response = _httpClient.GetAsync("http://localhost:9848/health").GetAwaiter().GetResult();
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
    }
}
