namespace Loupedeck.KiroCanPlugin.Actions;

/// <summary>
/// Debounce filter for button presses.
/// Allows only one press event per configured time window.
/// </summary>
public class ButtonDebounce
{
    private DateTime _lastPress = DateTime.MinValue;
    private readonly TimeSpan _window;

    public ButtonDebounce(TimeSpan window)
    {
        _window = window;
    }

    /// <summary>
    /// Returns true if the press should be processed (outside debounce window).
    /// Returns false if the press should be discarded (within window).
    /// </summary>
    public bool ShouldProcess()
    {
        var now = DateTime.UtcNow;
        if (now - _lastPress < _window) return false;
        _lastPress = now;
        return true;
    }
}
