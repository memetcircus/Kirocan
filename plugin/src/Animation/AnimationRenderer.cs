namespace Loupedeck.KiroCanPlugin.Animation;

using Loupedeck.KiroCanPlugin.Models;

/// <summary>
/// Coordinates the AnimationEngine with the plugin's button display system.
/// - Starts animation on "working" state for Page 1 and Page 3 buttons
/// - Stops animation on "idle" state and restores static icons
/// - Does NOT animate Page 2 buttons regardless of state
/// - Updates animation speed/sprite when health level changes
/// - Shows disconnect indicator when bridge is unreachable
/// </summary>
public class AnimationRenderer
{
    private readonly AnimationEngine _engine;
    private readonly KiroCanApplication _app;
    private bool _isAnimating = false;

    public AnimationRenderer(AnimationEngine engine, KiroCanApplication app)
    {
        _engine = engine;
        _app = app;

        // Subscribe to state changes
        _app.OnStateChanged += OnStateChanged;
        _app.OnDisconnected += OnDisconnected;
        _app.OnReconnected += OnReconnected;

        // Subscribe to frame changes for tile updates
        _engine.OnFrameChanged += OnFrameChanged;
    }

    /// <summary>
    /// Called when the bridge state or health level changes.
    /// Starts/stops animation and updates speed accordingly.
    /// </summary>
    private void OnStateChanged(object? sender, EventArgs e)
    {
        if (_app.CurrentState == BridgeState.Working && !_isAnimating)
        {
            // Start animation at current health level
            _engine.Start(_app.CurrentHealthLevel);
            _isAnimating = true;
        }
        else if (_app.CurrentState == BridgeState.Idle && _isAnimating)
        {
            // Stop animation and restore static icons
            _engine.Stop();
            _isAnimating = false;
            RestoreStaticIcons();
        }
        else if (_isAnimating)
        {
            // Health level may have changed — update speed/sprite
            _engine.UpdateHealthLevel(_app.CurrentHealthLevel);
        }
    }

    /// <summary>
    /// Called when the bridge becomes unreachable (2 consecutive poll failures).
    /// Shows disconnect indicator on all 9 LCD buttons.
    /// </summary>
    private void OnDisconnected(object? sender, EventArgs e)
    {
        if (_isAnimating)
        {
            _engine.Stop();
            _isAnimating = false;
        }
        ShowDisconnectIndicator();
    }

    /// <summary>
    /// Called when the bridge becomes reachable again.
    /// Restores normal display (static icons or animation if working).
    /// </summary>
    private void OnReconnected(object? sender, EventArgs e)
    {
        if (_app.CurrentState == BridgeState.Working)
        {
            _engine.Start(_app.CurrentHealthLevel);
            _isAnimating = true;
        }
        else
        {
            RestoreStaticIcons();
        }
    }

    /// <summary>
    /// Called each time the animation advances a frame.
    /// Updates tile images on Page 1 and Page 3 buttons.
    /// Does NOT update Page 2 buttons.
    /// </summary>
    private void OnFrameChanged(object? sender, int frameIndex)
    {
        // Only render tiles on animated pages (Page 1 and Page 3)
        // Each page has 9 buttons (positions 0-8)
        // The actual rendering is done via the Logi SDK's button image API
        // which would be called here with BitmapImage.FromArray data

        // For each position 0-8, get the tile and set it on the LCD button
        for (int position = 0; position < 9; position++)
        {
            var tile = _engine.GetTile(position);
            if (tile != null)
            {
                // In a full implementation, this would call the Logi SDK
                // to update the specific LCD button image.
                // Example: plugin.SetCommandImage(buttonId, tile);
            }
        }
    }

    /// <summary>
    /// Restores static button icons on all animated pages.
    /// </summary>
    private void RestoreStaticIcons()
    {
        // In a full implementation, this would reload the static icon
        // resources for each button on Page 1 and Page 3.
        // Page 2 buttons always show their static icons.
    }

    /// <summary>
    /// Shows a disconnect indicator on all 9 LCD buttons.
    /// </summary>
    private void ShowDisconnectIndicator()
    {
        // In a full implementation, this would render a "disconnected"
        // icon on all 9 LCD buttons to indicate the bridge is unreachable.
    }

    /// <summary>
    /// Cleans up event subscriptions. Call on plugin unload.
    /// </summary>
    public void Dispose()
    {
        _app.OnStateChanged -= OnStateChanged;
        _app.OnDisconnected -= OnDisconnected;
        _app.OnReconnected -= OnReconnected;
        _engine.OnFrameChanged -= OnFrameChanged;

        if (_isAnimating)
        {
            _engine.Stop();
            _isAnimating = false;
        }
    }
}
