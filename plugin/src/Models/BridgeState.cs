namespace Loupedeck.KiroCanPlugin.Models;

/// <summary>
/// Represents the current working state of the Kiro agent as reported by the Bridge.
/// </summary>
public enum BridgeState
{
    /// <summary>
    /// Kiro is not actively processing a request.
    /// </summary>
    Idle,

    /// <summary>
    /// Kiro is actively processing a request.
    /// </summary>
    Working
}
