namespace Loupedeck.KiroCanPlugin.Models;

/// <summary>
/// Represents the current rotation direction of the dial encoder.
/// </summary>
public enum RotationDirection
{
    /// <summary>
    /// No rotation has occurred yet or direction was reset.
    /// </summary>
    Undefined,

    /// <summary>
    /// Dial is rotating clockwise (next session).
    /// </summary>
    Clockwise,

    /// <summary>
    /// Dial is rotating counter-clockwise (previous session).
    /// </summary>
    CounterClockwise
}
