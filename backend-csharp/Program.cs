using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using TicTacToeBackend.Models;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.UseWebSockets();

// Diccionarios thread-safe para manejar conexiones nativas y estado del juego
var connectedClients = new ConcurrentDictionary<string, WebSocket>();
var activeUsers = new ConcurrentDictionary<string, UserSession>();
var activeGames = new ConcurrentDictionary<string, GameSession>();

// Endpoint nativo para WebSockets
app.Map("/ws", async context =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        string connectionId = Guid.NewGuid().ToString();
        connectedClients.TryAdd(connectionId, webSocket);
        
        Console.WriteLine($"[SOCKET ABIERTO] Cliente conectado: {connectionId}");

        var buffer = new byte[1024 * 4];

        try
        {
            // Bucle que mantiene viva la conexión y escucha peticiones (Event Loop)
            while (webSocket.State == WebSocketState.Open)
            {
                var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                    break;
                }

                string rawMessage = Encoding.UTF8.GetString(buffer, 0, result.Count);
                await RouteMessage(connectionId, rawMessage, webSocket);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Conexión perdida repentinamente: {ex.Message}");
        }
        finally
        {
            // Lógica de Desconexión / Abandono de partida
            connectedClients.TryRemove(connectionId, out _);
            activeUsers.TryRemove(connectionId, out var disconnectedUser);
            
            // Si estaba en una partida, el oponente gana por abandono (Requisito 8)
            var game = activeGames.Values.FirstOrDefault(g => g.Status == "playing" && (g.Player1Id == connectionId || g.Player2Id == connectionId));
            if (game != null)
            {
                game.Status = "won";
                string opponentId = game.Player1Id == connectionId ? game.Player2Id : game.Player1Id;
                game.WinnerId = opponentId;
                
                await SendToClient(opponentId, new WsMessage { 
                    Type = "OPPONENT_DISCONNECTED", 
                    Data = new { message = "Ganas por abandono técnica." } 
                });
            }

            Console.WriteLine($"[SOCKET CERRADO] Cliente desconectado: {connectionId}");
            await BroadcastUserList();
        }
    }
    else
    {
        context.Response.StatusCode = 400; // Bad Request
    }
});

// ==========================================
// ENRUTAMIENTO DE MENSAJES (Event Bus Manual)
// ==========================================
async Task RouteMessage(string senderId, string jsonPayload, WebSocket senderSocket)
{
    try
    {
        var message = JsonSerializer.Deserialize<WsMessage>(jsonPayload, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (message == null) return;

        Console.WriteLine($"[MENSAJE RECIBIDO] De: {senderId} | Tipo: {message.Type}");

        switch (message.Type)
        {
            case "LOGIN":
                // 1. Manejo de Login
                var loginData = JsonSerializer.Deserialize<JsonElement>(message.Data?.ToString() ?? "{}");
                string username = loginData.GetProperty("username").GetString() ?? "Guest";
                
                // (Aquí deberías verificar con Base de Datos)
                activeUsers.TryAdd(senderId, new UserSession { ConnectionId = senderId, Username = username });
                
                await SendToClient(senderId, new WsMessage { Type = "LOGIN_SUCCESS", Data = new { userId = senderId, username } });
                await BroadcastUserList();
                break;

            case "INVITE_PLAYER":
                // 2. Invitar Jugador
                var inviteData = JsonSerializer.Deserialize<JsonElement>(message.Data?.ToString() ?? "{}");
                string targetId = inviteData.GetProperty("targetId").GetString() ?? "";
                
                if (activeUsers.TryGetValue(senderId, out var senderUser))
                {
                    await SendToClient(targetId, new WsMessage { 
                        Type = "RECEIVE_INVITE", 
                        Data = new { fromId = senderId, fromUsername = senderUser.Username } 
                    });
                }
                break;

            case "ACCEPT_INVITE":
                // 3. Aceptar Invitación e iniciar partida
                var acceptData = JsonSerializer.Deserialize<JsonElement>(message.Data?.ToString() ?? "{}");
                string challengerId = acceptData.GetProperty("challengerId").GetString() ?? "";
                
                if (activeUsers.ContainsKey(senderId) && activeUsers.ContainsKey(challengerId))
                {
                    string gameId = Guid.NewGuid().ToString();
                    var newGame = new GameSession {
                        GameId = gameId,
                        Player1Id = challengerId,
                        Player2Id = senderId, // El que acepta
                        Turn = challengerId // El retador empieza
                    };
                    
                    activeGames.TryAdd(gameId, newGame);
                    
                    // Actualizar status a in-game
                    activeUsers[senderId].Status = "ingame";
                    activeUsers[challengerId].Status = "ingame";

                    var startMsg = new WsMessage { Type = "GAME_STARTED", Data = newGame };
                    await SendToClient(senderId, startMsg);
                    await SendToClient(challengerId, startMsg);
                    await BroadcastUserList();
                }
                break;

            case "MAKE_MOVE":
                // 4. Realizar Movimiento y Lógica de Juego
                var moveData = JsonSerializer.Deserialize<JsonElement>(message.Data?.ToString() ?? "{}");
                string gId = moveData.GetProperty("gameId").GetString() ?? "";
                int index = moveData.GetProperty("index").GetInt32();

                if (activeGames.TryGetValue(gId, out var g) && g.Status == "playing" && g.Turn == senderId && g.Board[index] == null)
                {
                    string symbol = g.Player1Id == senderId ? "X" : "O";
                    g.Board[index] = symbol;
                    
                    // Verificar victoria (simplificado)
                    if (CheckWinner(g.Board, symbol))
                    {
                        g.Status = "won";
                        g.WinnerId = senderId;
                    } 
                    else if (!g.Board.Contains(null))
                    {
                        g.Status = "draw";
                    }
                    else
                    {
                        g.Turn = g.Player1Id == senderId ? g.Player2Id : g.Player1Id;
                    }

                    var updateMsg = new WsMessage { Type = "GAME_UPDATED", Data = g };
                    await SendToClient(g.Player1Id, updateMsg);
                    await SendToClient(g.Player2Id, updateMsg);
                }
                break;
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[PARSE ERROR] No se pudo procesar el mensaje: {ex.Message}");
    }
}

// ==========================================
// FUNCIONES AUXILIARES (BROADCAST Y LÓGICA)
// ==========================================
async Task SendToClient(string connectionId, WsMessage message)
{
    if (connectedClients.TryGetValue(connectionId, out var socket) && socket.State == WebSocketState.Open)
    {
        string json = JsonSerializer.Serialize(message);
        var bytes = Encoding.UTF8.GetBytes(json);
        await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
    }
}

async Task BroadcastUserList()
{
    var msg = new WsMessage { Type = "USER_LIST", Data = activeUsers.Values.ToList() };
    string json = JsonSerializer.Serialize(msg);
    var bytes = Encoding.UTF8.GetBytes(json);

    foreach (var client in connectedClients.Values)
    {
        if (client.State == WebSocketState.Open)
        {
            await client.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }
}

bool CheckWinner(string[] board, string s)
{
    int[][] lines = { 
        new[] {0, 1, 2}, new[] {3, 4, 5}, new[] {6, 7, 8}, // Rows
        new[] {0, 3, 6}, new[] {1, 4, 7}, new[] {2, 5, 8}, // Cols
        new[] {0, 4, 8}, new[] {2, 4, 6}                   // Diags
    };
    foreach (var line in lines)
    {
        if (board[line[0]] == s && board[line[1]] == s && board[line[2]] == s) return true;
    }
    return false;
}

app.Run("http://0.0.0.0:5000"); // Puerto 5000 para el Backend C#
