namespace Loupedeck.KiroCanPlugin.Animation;

using System.Timers;
using Loupedeck.KiroCanPlugin.Models;

/// <summary>
/// Manages the Kiro ghost animation rendered across 9 LCD buttons as a 3x3 tile canvas.
/// 30 frames at varying speeds based on health level:
/// - Normal: 100ms per frame (10fps, 1x speed)
/// - Worried: 67ms per frame (15fps, 1.5x speed)
/// - Critical: 50ms per frame (20fps, 2x speed)
/// </summary>
public class AnimationEngine
{
    private const int FrameCount = 30;
    private const int TileSize = 72;
    private const int CanvasSize = 216; // 3 * 72
    private const int TileCount = 9;

    // Frame durations based on health level
    private static readonly Dictionary<HealthLevel, int> FrameDurations = new()
    {
        { HealthLevel.Normal, 100 },    // 10fps (1x speed)
        { HealthLevel.Worried, 67 },    // ~15fps (1.5x speed)
        { HealthLevel.Critical, 50 }    // 20fps (2x speed)
    };

    private byte[][]? _normalFrames;    // 30 frames, each 216x216 RGBA
    private byte[][]? _criticalFrames;  // 30 frames, flaming hair variant
    private int _currentFrame = 0;
    private Timer? _frameTimer;
    private HealthLevel _healthLevel = HealthLevel.Normal;
    private bool _isRunning = false;

    /// <summary>
    /// Fires when the animation advances to a new frame.
    /// The int parameter is the frame index (0-29).
    /// </summary>
    public event EventHandler<int>? OnFrameChanged;

    /// <summary>
    /// Whether the animation is currently running.
    /// </summary>
    public bool IsRunning => _isRunning;

    /// <summary>
    /// Current frame index (0-29).
    /// </summary>
    public int CurrentFrame => _currentFrame;

    /// <summary>
    /// Current health level affecting animation speed/sprite.
    /// </summary>
    public HealthLevel CurrentHealthLevel => _healthLevel;

    /// <summary>
    /// Loads animation frame data from embedded resources or raw byte arrays.
    /// Must be called before Start().
    /// </summary>
    /// <param name="normalFrames">30 frames of the standard ghost sprite (216x216 RGBA each).</param>
    /// <param name="criticalFrames">30 frames of the flaming hair variant (216x216 RGBA each).</param>
    public void LoadFrames(byte[][] normalFrames, byte[][] criticalFrames)
    {
        _normalFrames = normalFrames;
        _criticalFrames = criticalFrames;
    }

    /// <summary>
    /// Starts the animation at the specified health level's speed.
    /// </summary>
    public void Start(HealthLevel healthLevel)
    {
        if (_isRunning) Stop();

        _healthLevel = healthLevel;
        _currentFrame = 0;
        _isRunning = true;

        var interval = FrameDurations[healthLevel];
        _frameTimer = new Timer(interval);
        _frameTimer.Elapsed += (_, _) => AdvanceFrame();
        _frameTimer.AutoReset = true;
        _frameTimer.Start();
    }

    /// <summary>
    /// Stops the animation and resets to frame 0.
    /// </summary>
    public void Stop()
    {
        _isRunning = false;
        _frameTimer?.Stop();
        _frameTimer?.Dispose();
        _frameTimer = null;
        _currentFrame = 0;
    }

    /// <summary>
    /// Updates the health level, adjusting animation speed and sprite variant.
    /// Takes effect immediately if the animation is running.
    /// </summary>
    public void UpdateHealthLevel(HealthLevel newLevel)
    {
        if (_healthLevel == newLevel) return;
        _healthLevel = newLevel;

        if (_isRunning && _frameTimer != null)
        {
            var newInterval = FrameDurations[newLevel];
            _frameTimer.Interval = newInterval;
        }
    }

    /// <summary>
    /// Gets the frame duration in milliseconds for the given health level.
    /// Exposed for testing purposes.
    /// </summary>
    public static int GetFrameDuration(HealthLevel level) => FrameDurations[level];

    /// <summary>
    /// Extracts a 72x72 tile from the current frame for the specified grid position.
    /// Position 0-8 maps to row/col in a 3x3 grid (left-to-right, top-to-bottom).
    /// </summary>
    /// <param name="position">Tile position (0-8): 0=top-left, 8=bottom-right.</param>
    /// <returns>A BitmapImage created from the 72x72 RGBA tile data, or null if frames not loaded.</returns>
    public BitmapImage? GetTile(int position)
    {
        if (position < 0 || position >= TileCount) return null;

        var frames = _healthLevel == HealthLevel.Critical ? _criticalFrames : _normalFrames;
        if (frames == null || frames.Length == 0) return null;

        var frame = frames[_currentFrame % FrameCount];
        var tileBytes = ExtractTile(frame, position);

        return BitmapImage.FromArray(tileBytes);
    }

    /// <summary>
    /// Extracts a 72x72 pixel tile from a 216x216 canvas at the given grid position.
    /// </summary>
    private static byte[] ExtractTile(byte[] frame, int position)
    {
        int row = position / 3;
        int col = position % 3;

        int bytesPerPixel = 4; // RGBA
        int canvasStride = CanvasSize * bytesPerPixel;
        int tileStride = TileSize * bytesPerPixel;
        int tileBytes = TileSize * TileSize * bytesPerPixel;

        var tile = new byte[tileBytes];

        int srcStartX = col * TileSize * bytesPerPixel;
        int srcStartY = row * TileSize;

        for (int y = 0; y < TileSize; y++)
        {
            int srcOffset = (srcStartY + y) * canvasStride + srcStartX;
            int dstOffset = y * tileStride;
            Buffer.BlockCopy(frame, srcOffset, tile, dstOffset, tileStride);
        }

        return tile;
    }

    /// <summary>
    /// Advances to the next frame (modulo 30) and fires the OnFrameChanged event.
    /// </summary>
    private void AdvanceFrame()
    {
        _currentFrame = (_currentFrame + 1) % FrameCount;
        OnFrameChanged?.Invoke(this, _currentFrame);
    }
}
