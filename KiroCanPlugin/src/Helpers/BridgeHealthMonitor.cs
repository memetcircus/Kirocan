namespace Loupedeck.KiroCanPlugin
{
    using System;
    using System.Text.Json;
    using System.Text.Json.Serialization;
    using System.Timers;

    /// <summary>
    /// Polls the Bridge /health endpoint every 500ms and exposes current state.
    /// Fires events when state changes so actions can update their display.
    /// </summary>
    internal sealed class BridgeHealthMonitor : IDisposable
    {
        private Timer _timer;
        private const Int32 PollIntervalMs = 500;
        private const Int32 MaxFailures = 3;
        private Int32 _consecutiveFailures;

        public String State { get; private set; } = "idle";
        public String HealthLevel { get; private set; } = "normal";
        public Int32 ContextPercentage { get; private set; } = 0;
        public Boolean IsConnected { get; private set; } = false;

        /// <summary>Fires when state, health level, or connection status changes.</summary>
        public event EventHandler StateChanged;

        public void Start()
        {
            _timer = new Timer(PollIntervalMs);
            _timer.Elapsed += async (_, _) => await Poll();
            _timer.AutoReset = true;
            _timer.Start();
        }

        public void Stop()
        {
            _timer?.Stop();
            _timer?.Dispose();
            _timer = null;
        }

        public void Dispose() => Stop();

        private async System.Threading.Tasks.Task Poll()
        {
            var json = await BridgeClient.GetAsync("/health");
            if (json == null)
            {
                _consecutiveFailures++;
                if (_consecutiveFailures >= MaxFailures && IsConnected)
                {
                    IsConnected = false;
                    StateChanged?.Invoke(this, EventArgs.Empty);
                }
                return;
            }

            try
            {
                var health = JsonSerializer.Deserialize<HealthData>(json);
                if (health == null) return;

                var changed = State != health.state ||
                              HealthLevel != health.healthLevel ||
                              !IsConnected;

                State = health.state ?? "idle";
                HealthLevel = health.healthLevel ?? "normal";
                ContextPercentage = Math.Clamp(health.contextPercentage, 0, 100);

                if (!IsConnected)
                {
                    IsConnected = true;
                    _consecutiveFailures = 0;
                    changed = true;
                }
                else
                {
                    _consecutiveFailures = 0;
                }

                if (changed)
                {
                    StateChanged?.Invoke(this, EventArgs.Empty);
                }
            }
            catch (Exception ex)
            {
                PluginLog.Warning(ex, "Failed to parse health response");
            }
        }

        private sealed class HealthData
        {
            [JsonPropertyName("state")]
            public String state { get; set; }

            [JsonPropertyName("healthLevel")]
            public String healthLevel { get; set; }

            [JsonPropertyName("contextPercentage")]
            public Int32 contextPercentage { get; set; }
        }
    }
}
