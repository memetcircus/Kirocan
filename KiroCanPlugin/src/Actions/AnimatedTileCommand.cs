namespace Loupedeck.KiroCanPlugin
{
    using System;
    using System.Collections.Generic;
    using System.Timers;

    /// <summary>
    /// Base class for Page 1 buttons that show ghost animation tiles when Kiro is working.
    /// Each button knows its tile index (0-8) in the 3x3 grid.
    /// When idle: shows the button label text on dark purple background.
    /// When working: shows the corresponding animation tile for the current frame.
    /// </summary>
    public abstract class AnimatedTileCommand : PluginDynamicCommand
    {
        // Shared state across all animated tile instances
        private static Timer _sharedTimer;
        private static Int32 _currentFrame = 0;
        private static Boolean _isAnimating = false;
        private static String _currentSpriteSet = "ghost-walk";
        private static readonly Object _lock = new Object();
        private static readonly List<AnimatedTileCommand> _instances = new List<AnimatedTileCommand>();

        private const Int32 TotalFrames = 30;
        private const Int32 NormalIntervalMs = 50;    // 20fps - faster
        private const Int32 WorriedIntervalMs = 40;   // 25fps
        private const Int32 CriticalIntervalMs = 33;  // 30fps

        /// <summary>The tile index (0-8) this button represents in the 3x3 grid.</summary>
        protected abstract Int32 TileIndex { get; }

        /// <summary>The label shown when not animating.</summary>
        protected abstract String IdleLabel { get; }

        protected AnimatedTileCommand(String displayName, String description, String groupName)
            : base(displayName, description, groupName) { }

        protected override Boolean OnLoad()
        {
            lock (_lock)
            {
                _instances.Add(this);

                if (_sharedTimer == null)
                {
                    _sharedTimer = new Timer(NormalIntervalMs);
                    _sharedTimer.Elapsed += OnFrameTick;
                    _sharedTimer.AutoReset = true;
                }
            }

            // Subscribe to health monitor - may not be ready yet, so also subscribe to plugin events
            SubscribeToMonitor();

            // If monitor wasn't ready, subscribe to the ready event
            var plugin2 = (KiroCanPlugin)this.Plugin;
            plugin2.HealthMonitorReady -= OnMonitorReady; // prevent double
            plugin2.HealthMonitorReady += OnMonitorReady;

            return true;
        }

        private void OnMonitorReady(Object sender, EventArgs e)
        {
            SubscribeToMonitor();
        }

        private void SubscribeToMonitor()
        {
            var plugin = (KiroCanPlugin)this.Plugin;
            if (plugin.HealthMonitor != null)
            {
                plugin.HealthMonitor.StateChanged -= OnStateChanged; // prevent double-subscribe
                plugin.HealthMonitor.StateChanged += OnStateChanged;
                PluginLog.Verbose($"AnimatedTile[{TileIndex}] subscribed to health monitor");

                // If already working, start animation immediately
                if (plugin.HealthMonitor.IsConnected && plugin.HealthMonitor.State == "working")
                {
                    OnStateChanged(this, EventArgs.Empty);
                }
            }
            else
            {
                PluginLog.Warning($"AnimatedTile[{TileIndex}] HealthMonitor is null at OnLoad");
            }
        }

        protected override Boolean OnUnload()
        {
            var plugin = (KiroCanPlugin)this.Plugin;
            if (plugin.HealthMonitor != null)
            {
                plugin.HealthMonitor.StateChanged -= OnStateChanged;
            }

            lock (_lock)
            {
                _instances.Remove(this);
                if (_instances.Count == 0)
                {
                    _sharedTimer?.Stop();
                    _sharedTimer?.Dispose();
                    _sharedTimer = null;
                }
            }

            return true;
        }

        private void OnStateChanged(Object sender, EventArgs e)
        {
            var plugin = (KiroCanPlugin)this.Plugin;
            var monitor = plugin.HealthMonitor;
            if (monitor == null) return;

            if (monitor.IsConnected && monitor.State == "working")
            {
                _currentSpriteSet = monitor.HealthLevel switch
                {
                    "critical" => "ghost-walk-fire",
                    "worried" => "ghost-walk-worried",
                    _ => "ghost-walk"
                };

                var interval = monitor.HealthLevel switch
                {
                    "critical" => CriticalIntervalMs,
                    "worried" => WorriedIntervalMs,
                    _ => NormalIntervalMs
                };

                lock (_lock)
                {
                    if (_sharedTimer != null)
                    {
                        _sharedTimer.Interval = interval;
                    }
                }

                if (!_isAnimating)
                {
                    _isAnimating = true;
                    _currentFrame = 0;
                    _sharedTimer?.Start();
                }
            }
            else
            {
                _isAnimating = false;
                _sharedTimer?.Stop();
                _currentFrame = 0;
                NotifyAllInstances();
            }
        }

        private static void OnFrameTick(Object sender, ElapsedEventArgs e)
        {
            _currentFrame = (_currentFrame + 1) % TotalFrames;
            NotifyAllInstances();
        }

        private static void NotifyAllInstances()
        {
            lock (_lock)
            {
                foreach (var instance in _instances)
                {
                    try
                    {
                        instance.ActionImageChanged();
                    }
                    catch
                    {
                        // Ignore disposal race conditions
                    }
                }
            }
        }

        protected override BitmapImage GetCommandImage(String actionParameter, PluginImageSize imageSize)
        {
            if (_isAnimating)
            {
                return RenderTile(_currentFrame, TileIndex, imageSize);
            }

            // Idle: return null so SDK uses its default text-only display
            return null;
        }

        protected override String GetCommandDisplayName(String actionParameter, PluginImageSize imageSize)
        {
            if (_isAnimating)
            {
                // No text overlay during animation
                return "";
            }

            // Idle: show the label
            return IdleLabel;
        }

        private BitmapImage RenderIdleLabel(PluginImageSize imageSize)
        {
            var builder = new BitmapBuilder(imageSize);
            builder.Clear(BitmapColor.Black);
            builder.DrawText(IdleLabel, BitmapColor.White, 16);
            return builder.ToImage();
        }

        private BitmapImage RenderTile(Int32 frameIndex, Int32 tileIndex, PluginImageSize imageSize)
        {
            var frameStr = frameIndex.ToString("D2");
            var fileName = $"frame-{frameStr}-tile-{tileIndex}.png";

            try
            {
                return PluginResources.ReadImage(fileName);
            }
            catch
            {
                // Tile image not found — show solid purple (animation background)
                var builder = new BitmapBuilder(imageSize);
                builder.Clear(new BitmapColor(145, 69, 253)); // #9145fd purple
                builder.DrawText($"F{frameIndex}", new BitmapColor(255, 255, 255, 128), 9);
                return builder.ToImage();
            }
        }
    }
}
