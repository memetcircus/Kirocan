namespace Loupedeck.KiroCanPlugin
{
    using System;
    using System.Timers;

    /// <summary>
    /// Displays an animated ghost sprite on a button that reflects bridge state.
    /// - Idle: ghost-walk animation (normal)
    /// - Working: ghost-walk-fire animation (on fire)
    /// - Disconnected: static "disconnected" icon
    /// Cycles through 30 frames at ~12fps using sprite tile images.
    /// </summary>
    public class StatusCommand : PluginDynamicCommand
    {
        private Timer _animTimer;
        private Int32 _currentFrame = 0;
        private const Int32 TotalFrames = 30;
        private const Int32 FrameIntervalMs = 83; // ~12fps
        private const Int32 TilesPerFrame = 9; // 3x3 grid
        private const Int32 TileSize = 30; // each tile is 30x30
        private const Int32 FrameSize = 90; // 3*30 = 90x90

        private String _currentAnimation = "ghost-walk";
        private BridgeHealthMonitor _monitor;

        public StatusCommand()
            : base("Status", "Shows Kiro agent status with animation", "Kiro Status") { }

        protected override Boolean OnLoad()
        {
            // Get the health monitor from the plugin
            var plugin = (KiroCanPlugin)this.Plugin;
            _monitor = plugin.HealthMonitor;

            if (_monitor != null)
            {
                _monitor.StateChanged += OnStateChanged;
            }

            // Start animation timer
            _animTimer = new Timer(FrameIntervalMs);
            _animTimer.Elapsed += OnAnimTick;
            _animTimer.AutoReset = true;
            _animTimer.Start();

            return true;
        }

        protected override Boolean OnUnload()
        {
            _animTimer?.Stop();
            _animTimer?.Dispose();

            if (_monitor != null)
            {
                _monitor.StateChanged -= OnStateChanged;
            }

            return true;
        }

        private void OnStateChanged(Object sender, EventArgs e)
        {
            if (_monitor == null) return;

            if (!_monitor.IsConnected)
            {
                _currentAnimation = "disconnected";
            }
            else if (_monitor.State == "working")
            {
                _currentAnimation = "ghost-walk-fire";
            }
            else
            {
                _currentAnimation = "ghost-walk";
            }

            // Reset frame on state change for smooth transition
            _currentFrame = 0;
            this.ActionImageChanged();
        }

        private void OnAnimTick(Object sender, ElapsedEventArgs e)
        {
            _currentFrame = (_currentFrame + 1) % TotalFrames;
            this.ActionImageChanged();
        }

        protected override void RunCommand(String actionParameter)
        {
            // Press the status button = no-op or could toggle something
        }

        protected override BitmapImage GetCommandImage(String actionParameter, PluginImageSize imageSize)
        {
            try
            {
                return RenderFrame(_currentFrame, _currentAnimation);
            }
            catch
            {
                // Fallback: render text
                var bmp = new BitmapBuilder(imageSize);
                bmp.Clear(new BitmapColor(30, 30, 30));
                var status = _monitor?.IsConnected == true ? _monitor.State : "offline";
                bmp.DrawText(status, BitmapColor.White);
                return bmp.ToImage();
            }
        }

        /// <summary>
        /// Reconstructs a frame from 9 tile images (3x3 grid).
        /// Tile naming: frame-{nn}-tile-{0-8}.png
        /// </summary>
        private BitmapImage RenderFrame(Int32 frameIndex, String animationName)
        {
            var builder = new BitmapBuilder(PluginImageSize.Width90);
            builder.Clear(new BitmapColor(0, 0, 0, 0));

            var frameStr = frameIndex.ToString("D2");

            for (var tile = 0; tile < TilesPerFrame; tile++)
            {
                var fileName = $"frame-{frameStr}-tile-{tile}.png";

                try
                {
                    var tileImage = PluginResources.ReadImage(fileName);
                    if (tileImage != null)
                    {
                        var col = tile % 3;
                        var row = tile / 3;
                        builder.DrawImage(tileImage, col * TileSize, row * TileSize);
                    }
                }
                catch
                {
                    // Tile not found — skip
                }
            }

            return builder.ToImage();
        }
    }
}
