namespace Loupedeck.KiroCanPlugin
{
    using System;
    using System.Net.Http;
    using System.Text;
    using System.Threading.Tasks;

    /// <summary>
    /// HTTP client for communicating with the KiroCan Bridge at localhost:9848.
    /// All methods are fire-and-forget safe — errors are logged but never thrown.
    /// </summary>
    internal static class BridgeClient
    {
        private static readonly HttpClient _http = new HttpClient
        {
            BaseAddress = new Uri("http://localhost:9848"),
            Timeout = TimeSpan.FromMilliseconds(3000)
        };

        /// <summary>Sends a POST request to the given bridge endpoint.</summary>
        public static async Task<Boolean> PostAsync(String endpoint, String jsonBody = null)
        {
            try
            {
                HttpResponseMessage response;
                if (jsonBody != null)
                {
                    var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
                    response = await _http.PostAsync(endpoint, content);
                }
                else
                {
                    response = await _http.PostAsync(endpoint, null);
                }

                if (!response.IsSuccessStatusCode)
                {
                    PluginLog.Warning($"Bridge POST {endpoint} returned {(Int32)response.StatusCode}");
                }

                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                PluginLog.Warning(ex, $"Bridge POST {endpoint} failed");
                return false;
            }
        }

        /// <summary>Sends a GET request and returns the response body as string.</summary>
        public static async Task<String> GetAsync(String endpoint)
        {
            try
            {
                var response = await _http.GetAsync(endpoint);
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadAsStringAsync();
                }

                PluginLog.Warning($"Bridge GET {endpoint} returned {(Int32)response.StatusCode}");
                return null;
            }
            catch (Exception ex)
            {
                PluginLog.Warning(ex, $"Bridge GET {endpoint} failed");
                return null;
            }
        }
    }
}
