namespace Loupedeck.KiroCanPlugin.Models;

/// <summary>
/// Represents the context health level derived from session token usage.
/// Determines animation speed and sprite variant.
/// </summary>
public enum HealthLevel
{
    /// <summary>
    /// Context usage 0–59%. Standard animation at 1x speed.
    /// </summary>
    Normal,

    /// <summary>
    /// Context usage 60–74%. Animation at 1.5x speed.
    /// </summary>
    Worried,

    /// <summary>
    /// Context usage 75%+. Alternate sprite with flaming hair at 2x speed.
    /// </summary>
    Critical
}
