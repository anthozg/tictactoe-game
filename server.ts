import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // In-memory data store with Requirement 1 in mind (structure for persistence)
  const users = new Map<string, { 
    id: string, 
    username: string, 
    email?: string, // Support for new email field
    hashedPassword: string, 
    status: 'online' | 'offline' | 'ingame', 
    socketId?: string, 
    wins: number 
  }>();
  
  const games = new Map<string, { 
    id: string, 
    players: string[], 
    board: (string | null)[], 
    turn: string, 
    status: 'playing' | 'draw' | 'won', 
    winner?: string,
    startTime: number,
    round: number,
    scores: Record<string, number>,
    rematchRequests: string[],
    seriesWinner?: string
  }>();

  // Requirement 9: Monitor and Log Server Events
  function logEvent(type: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logEntry, data ? JSON.stringify(data) : '');
    // In a real production app, this would be written to a DB or log file.
  }

  io.on('connection', (socket) => {
    logEvent('system', `Socket connected: ${socket.id}`);

    socket.on('register', async ({ username, email, password }, callback) => {
      try {
        if (Array.from(users.values()).some(u => u.username === username)) {
          logEvent('auth', `Registration failed: Username '${username}' exists`);
          return callback({ success: false, message: 'Nombre de usuario ya registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const userId = Math.random().toString(36).substr(2, 9);
        users.set(userId, { 
          id: userId, 
          username, 
          email,
          hashedPassword, 
          status: 'online', 
          socketId: socket.id, 
          wins: 0 
        });

        logEvent('auth', `User registered: ${username} (${userId})`);
        callback({ success: true, userId });
        broadcastUsers();
      } catch (err) {
        logEvent('error', 'Registration error', err);
        callback({ success: false, message: 'Error interno en el registro' });
      }
    });

    socket.on('resetPassword', ({ email }, callback) => {
      const user = Array.from(users.values()).find(u => u.email === email);
      if (user) {
        logEvent('auth', `Password recovery requested for: ${email} (${user.username})`);
        callback({ success: true, message: 'Instrucciones enviadas' });
      } else {
        logEvent('auth', `Password recovery failed: Email '${email}' not found`);
        callback({ success: false, message: 'Correo no registrado' });
      }
    });

    socket.on('login', async ({ username, password }, callback) => {
      try {
        const user = Array.from(users.values()).find(u => u.username === username);
        
        if (user && await bcrypt.compare(password, user.hashedPassword)) {
          user.status = 'online';
          user.socketId = socket.id;
          logEvent('auth', `Login success: ${username}`);
          callback({ success: true, userId: user.id });
          broadcastUsers();
        } else {
          logEvent('auth', `Login failed: Invalid credentials for '${username}'`);
          callback({ success: false, message: 'Credenciales inválidas' });
        }
      } catch (err) {
        logEvent('error', 'Login error', err);
        callback({ success: false, message: 'Error en la autenticación' });
      }
    });

    socket.on('getUsers', () => {
      socket.emit('userList', Array.from(users.values()).map(({ id, username, status, wins }) => ({ id, username, status, wins })));
    });

    socket.on('invite', ({ toUserId, fromUserId }) => {
      const toUser = users.get(toUserId);
      const fromUser = users.get(fromUserId);
      if (toUser && toUser.socketId && fromUser) {
        logEvent('game', `Invitation sent: ${fromUser.username} -> ${toUser.username}`);
        io.to(toUser.socketId).emit('invitation', { fromUser: { id: fromUser.id, username: fromUser.username } });
      }
    });

    socket.on('respondInvitation', ({ fromUserId, toUserId, accept }) => {
      const fromUser = users.get(fromUserId);
      const toUser = users.get(toUserId);

      if (accept) {
        const gameId = Math.random().toString(36).substr(2, 9);
        const game = {
          id: gameId,
          players: [fromUserId, toUserId],
          board: Array(9).fill(null),
          turn: fromUserId,
          status: 'playing' as const,
          startTime: Date.now(),
          round: 1,
          scores: { [fromUserId]: 0, [toUserId]: 0 },
          rematchRequests: []
        };
        games.set(gameId, game);

        if (fromUser) fromUser.status = 'ingame';
        if (toUser) toUser.status = 'ingame';

        logEvent('game', `Game started: ${gameId} (${fromUser?.username} vs ${toUser?.username})`);
        
        if (fromUser?.socketId) io.to(fromUser.socketId).emit('gameStarted', game);
        if (toUser?.socketId) io.to(toUser.socketId).emit('gameStarted', game);
        broadcastUsers();
      } else {
        logEvent('game', `Invitation rejected: ${fromUser?.username} <- ${toUser?.username}`);
        if (fromUser?.socketId) {
          io.to(fromUser.socketId).emit('invitationRejected', { by: toUserId });
        }
      }
    });

    socket.on('requestRematch', ({ gameId, userId }) => {
      const game = games.get(gameId);
      if (!game || game.status === 'playing') return;

      if (!game.rematchRequests.includes(userId)) {
        game.rematchRequests.push(userId);
        logEvent('game', `Rematch requested by ${userId} for game ${gameId}`);
      }

      if (game.rematchRequests.length === 2 && game.round < 3 && !game.seriesWinner) {
        game.round += 1;
        game.board = Array(9).fill(null);
        game.status = 'playing';
        game.winner = undefined;
        game.rematchRequests = [];
        game.turn = game.players[game.round % 2 === 0 ? 1 : 0]; // Alternating first turn
        
        logEvent('game', `Rematch accepted: Round ${game.round} starts for ${gameId}`);
        broadcastGameUpdate(gameId);
      } else {
        broadcastGameUpdate(gameId);
      }
    });

    socket.on('makeMove', ({ gameId, userId, index }) => {
      const game = games.get(gameId);
      const user = users.get(userId);
      if (!game || game.status !== 'playing' || game.turn !== userId || game.board[index] !== null) return;

      const symbol = game.players[0] === userId ? 'X' : 'O';
      game.board[index] = symbol;
      logEvent('game', `Move made: ${gameId} - ${user?.username} placed ${symbol} at index ${index}`);

      const winner = checkWinner(game.board);
      if (winner) {
        game.status = 'won';
        game.winner = userId;
        game.scores[userId] += 1;
        
        // Series check
        if (game.scores[userId] >= 2 || (game.round === 3)) {
          // Determine series winner based on scores
          const opponentId = game.players.find(p => p !== userId)!;
          if (game.scores[userId] > game.scores[opponentId]) {
            game.seriesWinner = userId;
          } else if (game.scores[opponentId] > game.scores[userId]) {
            game.seriesWinner = opponentId;
          }
          
          if (game.seriesWinner) {
            const seriesWinnerUser = users.get(game.seriesWinner);
            if (seriesWinnerUser) seriesWinnerUser.wins += 1;
            logEvent('game', `Series ended: ${gameId} - Champion: ${seriesWinnerUser?.username}`);
          }
        }

        logEvent('game', `Round ${game.round} won by ${user?.username}. Score: ${JSON.stringify(game.scores)}`);
        
        // If series is over, end game (set users back to online)
        if (game.seriesWinner || game.round === 3) {
          endGame(gameId);
        }
      } else if (game.board.every(cell => cell !== null)) {
        game.status = 'draw';
        logEvent('game', `Round ${game.round} ended in Draw.`);
        
        if (game.round === 3) {
          const p1 = game.players[0];
          const p2 = game.players[1];
          if (game.scores[p1] > game.scores[p2]) game.seriesWinner = p1;
          else if (game.scores[p2] > game.scores[p1]) game.seriesWinner = p2;
          
          if (game.seriesWinner) {
            const seriesWinnerUser = users.get(game.seriesWinner);
            if (seriesWinnerUser) seriesWinnerUser.wins += 1;
          }
          endGame(gameId);
        }
      } else {
        game.turn = game.players.find(p => p !== userId)!;
      }

      broadcastGameUpdate(gameId);
    });

    socket.on('leaveGame', ({ gameId, userId }) => {
      const game = games.get(gameId);
      const user = users.get(userId);
      if (game && game.status === 'playing') {
        const winnerId = game.players.find(p => p !== userId)!;
        const winner = users.get(winnerId);
        game.status = 'won';
        game.winner = winnerId;
        game.seriesWinner = winnerId;
        if (winner) winner.wins += 1;
        
        logEvent('game', `Game ended: ${gameId} - ${user?.username} abandoned. Winner: ${winner?.username}`);
        endGame(gameId);
        broadcastGameUpdate(gameId);
      }
    });

    socket.on('disconnect', () => {
      const user = Array.from(users.values()).find(u => u.socketId === socket.id);
      if (user) {
        user.status = 'offline';
        logEvent('system', `User disconnected: ${user.username}`);
        
        const gameEntry = Array.from(games.entries()).find(([id, g]) => g.status === 'playing' && g.players.includes(user.id));
        if (gameEntry) {
          const [gameId, game] = gameEntry;
          const winnerId = game.players.find(p => p !== user.id)!;
          const winner = users.get(winnerId);
          game.status = 'won';
          game.winner = winnerId;
          game.seriesWinner = winnerId;
          if (winner) winner.wins += 1;
          logEvent('game', `Game ended by disconnection: ${gameId} - Winner: ${winner?.username}`);
          endGame(gameId);
          broadcastGameUpdate(gameId);
        }
        broadcastUsers();
      }
    });

    function broadcastUsers() {
      io.emit('userList', Array.from(users.values()).map(({ id, username, status, wins }) => ({ id, username, status, wins })));
    }

    function broadcastGameUpdate(gameId: string) {
      const game = games.get(gameId);
      if (game) {
        game.players.forEach(pid => {
          const u = users.get(pid);
          if (u?.socketId) io.to(u.socketId).emit('gameUpdate', game);
        });
      }
    }

    function endGame(gameId: string) {
      const game = games.get(gameId);
      if (game) {
        game.players.forEach(pid => {
          const u = users.get(pid);
          if (u) u.status = 'online';
        });
        broadcastUsers();
      }
    }
  });

  function checkWinner(board: (string | null)[]) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  }

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    logEvent('system', `Server operational at http://0.0.0.0:${PORT}`);
  });
}

startServer();
