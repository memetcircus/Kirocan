using Xunit;

namespace Loupedeck.KiroCanPlugin.Tests
{
    public class SanityTests
    {
        [Fact]
        public void PluginType_Exists()
        {
            var pluginType = typeof(KiroCanPlugin);
            Assert.NotNull(pluginType);
            Assert.True(pluginType.IsSubclassOf(typeof(Plugin)));
        }
    }
}
