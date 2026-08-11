namespace Loupedeck.KiroCanPlugin;

using System.Net.Http;
using System.Text.Json;
using System.Timers;
using Loupedeck.KiroCanPlugin.Models;

/// <summary>
/// Application-level manager for the KiroCan plugin.
/// Polls the Bridge /health endpoint every 500ms and maintains shared state.
/// </summary>
public class KiroCanApplication
{
    private static readonly HttpClient _httpClient = new()
    {
        Timeout = TimeSpan.FromMilliseconds(2000)
    };

    private Timer? _pollTimer;
    private const int PollIntervalMs = 500;
    private const int MaxConsecutiveFailures = 2;
    private const string BridgeUrl = "http://localhost:9848";

    // Shared state
    public BridgeState CurrentState { get; private set; } = BridgeState.Idle;
    public HealthLevel CurrentHealthLevel { get; private set; } = HealthLevel.Normal;
    public int ContextPercentage { get; private set; } = 0;
    public bool IsBridgeConnected { get; private set; } = true;
    private int _consecutiveFailures = 0;

    // Events
    public event EventHandler? OnStateChanged;
    public event EventHandler? OnDisconnected;
    public event EventHandler? OnReconnected;

    public void Start()
    {
        _pollTimer = new Timer(PollIntervalMs);
        _pollTimer.Elapsed += async (_, _) => await PollBridgeHealth();
        _pollTimer.AutoReset = true;
        _pollTimer.Start();
    }

    public void Stop()
    {
        _pollTimer?.Stop();
        _pollTimer?.Dispose();
        _pollTimer = null;
    }

    private async Task PollBridgeHealth()
    {
        try
        {
            var response = await _httpClient.GetAsync($"{BridgeUrl}/health");
            var json = await response.Content.ReadAsStringAsync();
            var health = JsonSerializer.Deserialize<HealthResponse>(json);

            if (health == null || string.IsNullOrEmpty(health.State))
            {
                // Malformed response — treat as default
                SetDefaults();
                return;
            }

            // Validate contextPercentage range
            if (health.ContextPercentage < 0 || health.ContextPercentage > 100)
            {
                SetDefaults();
                return;
            }

            // Parse state
            var newState = health.State.ToLowerInvariant() == "working"
                ? BridgeState.Working
                : BridgeState.Idle;

            // Parse health level
            var newHealthLevel = health.HealthLevel?.ToLowerInvariant() switch
            {
                "worried" => HealthLevel.Worried,
                "critical" => HealthLevel.Critical,
                _ => HealthLevel.Normal
            };

            var stateChanged = CurrentState != newState || CurrentHealthLevel != newHealthLevel;

            CurrentState = newState;
            CurrentHealthLevel = newHealthLevel;
            ContextPercentage = health.ContextPercentage;

            // Handle reconnection
            if (!IsBridgeConnected)
            {
                IsBridgeConnected = true;
                _consecutiveFailures = 0;
                OnReconnected?.Invoke(this, EventArgs.Empty);
            }
            else
            {
                _consecutiveFailures = 0;
            }

            if (stateChanged)
            {
                OnStateChanged?.Invoke(this, EventArgs.Empty);
            }
        }
        catch
        {
            _consecutiveFailures++;
            if (_consecutiveFailures >= MaxConsecutiveFailures && IsBridgeConnected)
            {
                IsBridgeConnected = false;
                OnDisconnected?.Invoke(this, EventArgs.Empty);
            }
        }
    }

    private void SetDefaults()
    {
        CurrentState = BridgeState.Idle;
        CurrentHealthLevel = HealthLevel.Normal;
        ContextPercentage = 0;
        _consecutiveFailures = 0;
        if (!IsBridgeConnected)
        {
            IsBridgeConnected = true;
            OnReconnected?.Invoke(this, EventArgs.Empty);
        }
    }

    /// <summary>
    /// Sends an HTTP POST to the Bridge at the specified endpoint.
    /// Returns true on success, false on failure (silently discards errors).
    /// </summary>
    public async Task<bool> SendBridgeRequest(string endpoint, string? jsonBody = null)
    {
        try
        {
            HttpResponseMessage response;
            if (jsonBody != null)
            {
                var content = new StringContent(jsonBody, System.Text.Encoding.UTF8, "application/json");
                response = await _httpClient.PostAsync($"{BridgeUrl}{endpoint}", content);
            }
            else
            {
                response = await _httpClient.PostAsync($"{BridgeUrl}{endpoint}", null);
            }
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}
