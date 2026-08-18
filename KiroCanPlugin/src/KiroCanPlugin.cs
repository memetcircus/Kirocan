namespace Loupedeck.KiroMxConsolePlugin
{
    using System;
    using System.Diagnostics;
    using System.IO;
    using System.Net.Http;

    /// <summary>
    /// Main plugin entry point for KiroCan.
    /// Manages the embedded bridge process and health monitor lifecycle.
    /// Bridge exe is embedded as a resource, extracted to %LOCALAPPDATA%\KiroCan\ on first load,
    /// and spawned from there. This bypasses Assembly.Location being empty in .lplug4 installs.
    /// </summary>
    public class KiroMxConsolePlugin : Plugin
    {
        public override Boolean UsesApplicationApiOnly => true;
        public override Boolean HasNoApplication => true;

        /// <summary>Shared health monitor instance used by actions.</summary>
        internal BridgeHealthMonitor HealthMonitor { get; private set; }

        /// <summary>The embedded bridge process spawned by this plugin.</summary>
        private Process _bridgeProcess;

        /// <summary>HTTP client for health checks.</summary>
        private static readonly HttpClient _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };

        /// <summary>Bridge executable filename.</summary>
        private const String BridgeExeName = "kirocan-bridge.exe";

        /// <summary>Bridge health endpoint.</summary>
        private const String BridgeHealthUrl = "http://localhost:9848/health";

        /// <summary>Plugin version — used to detect when bridge exe needs re-extraction.</summary>
        private const String PluginVersion = "1.3";

        public KiroMxConsolePlugin()
        {
            PluginLog.Init(this.Log);
            PluginResources.Init(this.Assembly);
        }

        public override void Load()
        {
            // Start the embedded bridge process
            StartBridge();

            HealthMonitor = new BridgeHealthMonitor();
            HealthMonitor.Start();
            PluginLog.Info("KiroCan plugin loaded, health monitor started");

            // Notify all already-loaded actions that the monitor is ready
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

        /// <summary>
        /// Starts the bridge executable. First checks if it's already running,
        /// then finds or extracts the exe, then spawns it.
        /// </summary>
        private void StartBridge()
        {
            try
            {
                // Check if bridge is already running (e.g., developer running it manually)
                if (IsBridgeAlreadyRunning())
                {
                    PluginLog.Info("Bridge already running on port 9848, skipping spawn");
                    return;
                }

                var bridgePath = FindBridgePath();
                if (bridgePath == null)
                {
                    // Try extracting from embedded resource
                    bridgePath = EnsureBridgeExtracted();
                }

                if (bridgePath == null)
                {
                    PluginLog.Warning("Bridge executable not found and could not be extracted");
                    return;
                }

                var startInfo = new ProcessStartInfo
                {
                    FileName = bridgePath,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = false,
                    RedirectStandardError = false,
                    WorkingDirectory = Path.GetDirectoryName(bridgePath)
                };

                _bridgeProcess = Process.Start(startInfo);
                PluginLog.Info($"Bridge process started (PID: {_bridgeProcess?.Id}) from {bridgePath}");
            }
            catch (Exception ex)
            {
                PluginLog.Error($"Failed to start bridge: {ex.Message}");
            }
        }

        /// <summary>
        /// Finds the bridge executable using a fallback chain.
        /// </summary>
        private String FindBridgePath()
        {
            // 1. Try Assembly.Location (works in dev/link mode)
            var asmLocation = GetType().Assembly.Location;
            if (!String.IsNullOrEmpty(asmLocation))
            {
                var asmDir = Path.GetDirectoryName(asmLocation);
                if (!String.IsNullOrEmpty(asmDir))
                {
                    var candidate = Path.Combine(asmDir, BridgeExeName);
                    if (File.Exists(candidate))
                    {
                        PluginLog.Info($"Bridge found via Assembly.Location: {candidate}");
                        return candidate;
                    }
                }
            }

            // 2. Try %LOCALAPPDATA%\KiroCan\ (known fixed extraction location)
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var fixedPath = Path.Combine(localAppData, "KiroCan", BridgeExeName);
            if (File.Exists(fixedPath))
            {
                PluginLog.Info($"Bridge found at fixed location: {fixedPath}");
                return fixedPath;
            }

            // 3. Try AppContext.BaseDirectory
            var baseDir = AppContext.BaseDirectory;
            if (!String.IsNullOrEmpty(baseDir))
            {
                var baseDirCandidate = Path.Combine(baseDir, BridgeExeName);
                if (File.Exists(baseDirCandidate))
                {
                    PluginLog.Info($"Bridge found via AppContext.BaseDirectory: {baseDirCandidate}");
                    return baseDirCandidate;
                }
            }

            return null;
        }

        /// <summary>
        /// Extracts the bridge exe from embedded resources to %LOCALAPPDATA%\KiroCan\.
        /// Only re-extracts if version has changed or file is missing.
        /// </summary>
        private String EnsureBridgeExtracted()
        {
            try
            {
                var targetDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "KiroCan");
                var targetPath = Path.Combine(targetDir, BridgeExeName);
                var versionFile = Path.Combine(targetDir, ".version");

                Directory.CreateDirectory(targetDir);

                // Check if already extracted and same version
                if (File.Exists(targetPath) && File.Exists(versionFile)
                    && File.ReadAllText(versionFile).Trim() == PluginVersion)
                {
                    PluginLog.Info($"Bridge already extracted (v{PluginVersion}): {targetPath}");
                    return targetPath;
                }

                // Extract from embedded resource
                using var stream = GetType().Assembly.GetManifestResourceStream(BridgeExeName);
                if (stream == null)
                {
                    // List available resources for debugging
                    var names = GetType().Assembly.GetManifestResourceNames();
                    PluginLog.Warning($"Bridge exe not found as embedded resource. Available: {String.Join(", ", names)}");
                    return null;
                }

                PluginLog.Info($"Extracting bridge exe ({stream.Length / 1024 / 1024}MB) to {targetPath}...");

                using (var fs = File.Create(targetPath))
                {
                    stream.CopyTo(fs);
                }

                File.WriteAllText(versionFile, PluginVersion);
                PluginLog.Info($"Bridge extracted successfully to {targetPath}");

                return targetPath;
            }
            catch (Exception ex)
            {
                PluginLog.Error($"Failed to extract bridge: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Stops the bridge process if we spawned it.
        /// </summary>
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

        /// <summary>
        /// Checks if the bridge is already listening on port 9848.
        /// </summary>
        private Boolean IsBridgeAlreadyRunning()
        {
            try
            {
                var response = _httpClient.GetAsync(BridgeHealthUrl).GetAwaiter().GetResult();
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
    }
}
