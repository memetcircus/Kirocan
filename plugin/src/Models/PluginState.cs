namespace Loupedeck.KiroCanPlugin.Models;

/// <summary>
/// Holds the complete runtime state of the KiroCan plugin, including
/// bridge connectivity, context health, and dial rotation tracking.
/// </summary>
public class PluginState
{
    /// <summary>
    /// Current working/idle state as reported by the Bridge.
    /// </summary>
    public BridgeState State { get; set; } = BridgeState.Idle;

    /// <summary>
    /// Current context health level derived from session token usage.
    /// </summary>
    public HealthLevel HealthLevel { get; set; } = HealthLevel.Normal;

    /// <summary>
    /// Current context window usage as an integer percentage (0–100).
    /// </summary>
    public int ContextPercentage { get; set; }

    /// <summary>
    /// Whether the Bridge is currently reachable via HTTP polling.
    /// </summary>
    public bool IsBridgeConnected { get; set; } = true;

    /// <summary>
    /// Number of consecutive /health poll failures. Disconnected state
    /// is triggered when this reaches 2.
    /// </summary>
    public int ConsecutivePollFailures { get; set; }

    /// <summary>
    /// Accumulated dial rotation ticks toward the Notch_Threshold (18).
    /// </summary>
    public int RotationAccumulator { get; set; }

    /// <summary>
    /// Current direction of dial rotation for threshold accumulation.
    /// </summary>
    public RotationDirection CurrentDirection { get; set; } = RotationDirection.Undefined;
}
