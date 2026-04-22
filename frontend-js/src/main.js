// ==========================================
// CAPSTONE FRONTEND: WEB SOCKET NATIVO
// ==========================================

// Variables Globales de Estado
let socket = null;
let myUserId = null;
let currentGame = null;

// Referencias del DOM
const loginScreen = document.getElementById("login-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const gameScreen = document.getElementById("game-screen");
const userListEl = document.getElementById("user-list");
const gameStatusEl = document.getElementById("game-status");
const cells = document.querySelectorAll(".cell");

// 1. INICIALIZAR WEBSOCKET NATIVO
function connectWebSocket() {
    // Si estuviéramos en producción usando SSL, usaríamos wss://
    socket = new WebSocket("ws://localhost:5000/ws");

    socket.onopen = () => {
        console.log("Conectado al servidor C# mediante TCP/WebSocket");
    };

    // 2. ENRUTADOR DE EVENTOS (Event Bus Client-Side)
    socket.onmessage = (event) => {
        // Obtenemos los Bytes decodificados a texto y los pasamos a JSON
        const message = JSON.parse(event.data);
        console.log("📥 Recibido:", message.type, message.data);

        switch (message.type) {
            case "LOGIN_SUCCESS":
                myUserId = message.data.userId;
                loginScreen.style.display = "none";
                lobbyScreen.style.display = "block";
                break;

            case "USER_LIST":
                renderUserList(message.data);
                break;

            case "RECEIVE_INVITE":
                if (confirm(`¡El jugador ${message.data.fromUsername} te ha desafiado! ¿Aceptas?`)) {
                    sendPayload("ACCEPT_INVITE", { challengerId: message.data.fromId });
                }
                break;

            case "GAME_STARTED":
                currentGame = message.data;
                lobbyScreen.style.display = "none";
                gameScreen.style.display = "block";
                renderBoard();
                break;

            case "GAME_UPDATED":
                currentGame = message.data;
                renderBoard();
                break;

            case "OPPONENT_DISCONNECTED":
                alert(message.data.message);
                gameScreen.style.display = "none";
                lobbyScreen.style.display = "block";
                break;
        }
    };

    socket.onclose = () => {
        console.warn("Conexión perdida. Requiere Refresh.");
        alert("Desconectado del servidor de juegos.");
    };
}

connectWebSocket();

// ==========================================
// FUNCIONES AUXILIARES Y EMISIÓN DE EVENTOS
// ==========================================

// Helper para empaquetar y enviar el JSON por el Socket nativo
function sendPayload(type, data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const payload = JSON.stringify({ type, data });
        socket.send(payload);
    }
}

// Eventos de Botones UI
document.getElementById("btn-login").addEventListener("click", () => {
    const username = document.getElementById("username").value;
    if (username) {
        // Enviar evento LOGIN al servidor C#
        sendPayload("LOGIN", { username: username });
    }
});

document.getElementById("btn-leave").addEventListener("click", () => {
    // Para simplificar, recargamos (en C# detectará la desconexión TCP)
    window.location.reload();
});

// Interacción con Grilla del Juego
cells.forEach(cell => {
    cell.addEventListener("click", (e) => {
        if (!currentGame || currentGame.status !== "playing") return;
        if (currentGame.turn !== myUserId) return alert("No es tu turno!");
        
        const index = parseInt(e.target.getAttribute("data-index"));
        
        if (currentGame.board[index] === null) {
            // Emite la jugada hacia el Servidor a través del Socket
            sendPayload("MAKE_MOVE", { gameId: currentGame.gameId, index });
        }
    });
});

// Funciones de Renderizado
function renderUserList(users) {
    userListEl.innerHTML = "";
    users.forEach(u => {
        if (u.connectionId === myUserId) return; // No mostrarme a mi mismo

        const li = document.createElement("li");
        li.innerHTML = `
            <span>${u.username} <small>(${u.status})</small></span>
            <button ${u.status !== 'online' ? 'disabled' : ''} onclick="inviteUser('${u.connectionId}')">Desafiar</button>
        `;
        userListEl.appendChild(li);
    });
}

window.inviteUser = function(targetId) {
    sendPayload("INVITE_PLAYER", { targetId });
};

function renderBoard() {
    // Actualizar celdas
    currentGame.board.forEach((symbol, index) => {
        cells[index].innerText = symbol || "";
        cells[index].style.color = symbol === 'X' ? '#3b82f6' : '#f43f5e';
    });

    // Actualizar Título de Estado
    if (currentGame.status === "playing") {
        gameStatusEl.innerText = currentGame.turn === myUserId ? "¡TU TURNO!" : "Esperando al oponente...";
    } else if (currentGame.status === "won") {
        gameStatusEl.innerText = currentGame.winnerId === myUserId ? "¡GANASTE LA PARTIDA!" : "DERROTA TOTAL";
    } else {
        gameStatusEl.innerText = "EMPATE TÁCTICO";
    }
}
