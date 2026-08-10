using System.Text.Json.Serialization;

namespace Loupedeck.KiroCanPlugin.Models;

/// <summary>
/// Data transfer object for the Bridge GET /health response.
/// Maps to JSON schema: {"state": string, "healthLevel": string, "contextPercentage": number}.
/// </summary>
public class HealthResponse
{
    /// <summary>
    /// Current agent state. Expected values: "working" or "idle".
    /// </summary>
    [JsonPropertyName("state")]
    public string State { get; set; } = string.Empty;

    /// <summary>
    /// Current context health level. Expected values: "normal", "worried", or "critical".
    /// </summary>
    [JsonPropertyName("healthLevel")]
    public string HealthLevel { get; set; } = string.Empty;

    /// <summary>
    /// Current context window usage as an integer percentage (0–100).
    /// </summary>
    [JsonPropertyName("contextPercentage")]
    public int ContextPercentage { get; set; }
}
