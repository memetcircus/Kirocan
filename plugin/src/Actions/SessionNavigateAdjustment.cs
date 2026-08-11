namespace Loupedeck.KiroCanPlugin.Actions;

using Loupedeck.KiroCanPlugin.Models;

/// <summary>
/// Handles dial rotation for session navigation.
/// Accumulates ticks until the Notch_Threshold of 18 is reached,
/// then sends next/previous session command to the Bridge.
/// Resets accumulator on direction reversal.
/// </summary>
public class SessionNavigateAdjustment : PluginDynamicAdjustment
{
    private int _rotationAccumulator = 0;
    private RotationDirection _currentDirection = RotationDirection.Undefined;
    private const int NotchThreshold = 18;

    public SessionNavigateAdjustment()
        : base(displayName: "Navigate Sessions",
               description: "Rotate to switch Kiro sessions",
               groupName: "Navigation",
               hasReset: false)
    { }

    protected override void ApplyAdjustment(string actionParameter, int ticks)
    {
        var app = KiroCanPlugin.Instance?.Application;
        if (app == null || !app.IsBridgeConnected) return;

        var newDirection = ticks > 0
            ? RotationDirection.Clockwise
            : RotationDirection.CounterClockwise;

        // Reset accumulator on direction reversal
        if (_currentDirection != RotationDirection.Undefined && newDirection != _currentDirection)
        {
            _rotationAccumulator = 0;
        }

        _currentDirection = newDirection;
        _rotationAccumulator += Math.Abs(ticks);

        if (_rotationAccumulator >= NotchThreshold)
        {
            _rotationAccumulator = 0;
            var endpoint = newDirection == RotationDirection.Clockwise
                ? "/session/next"
                : "/session/previous";
            _ = app.SendBridgeRequest(endpoint);
        }
    }

    protected override void RunCommand(string actionParameter)
    {
        // Reset button press (center click on dial) - no action needed
    }
}
