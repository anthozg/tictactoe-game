using System.Text.Json.Serialization;

namespace TicTacToeBackend.Models
{
    // Define la estructura base de TODOS los mensajes del protocolo (Event Bus)
    public class WsMessage
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("data")]
        public object? Data { get; set; }
    }

    public class UserSession
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Status { get; set; } = "online"; // online, ingame
    }

    public class GameSession
    {
        public string GameId { get; set; } = string.Empty;
        public string Player1Id { get; set; } = string.Empty;
        public string Player2Id { get; set; } = string.Empty;
        public string[] Board { get; set; } = new string[9];
        public string Turn { get; set; } = string.Empty; // ConnectionId del jugador que debe mover
        public string Status { get; set; } = "playing"; // playing, won, draw
        public string? WinnerId { get; set; }
    }
}
