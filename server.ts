import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

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

  // In-memory data store
  const users = new Map<string, { id: string, username: string, status: 'online' | 'offline' | 'ingame', socketId?: string, wins: number }>();
  const games = new Map<string, { id: string, players: string[], board: (string | null)[], turn: string, status: 'playing' | 'draw' | 'won', winner?: string }>();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register', ({ username, password }, callback) => {
      // Basic simulation of registration
      if (Array.from(users.values()).some(u => u.username === username)) {
        return callback({ success: false, message: 'Username already taken' });
      }
      const userId = Math.random().toString(36).substr(2, 9);
      users.set(userId, { id: userId, username, status: 'online', socketId: socket.id, wins: 0 });
      callback({ success: true, userId });
      broadcastUsers();
    });

    socket.on('login', ({ username, password }, callback) => {
      const user = Array.from(users.values()).find(u => u.username === username);
      if (user) {
        user.status = 'online';
        user.socketId = socket.id;
        callback({ success: true, userId: user.id });
        broadcastUsers();
      } else {
        callback({ success: false, message: 'Invalid credentials' });
      }
    });

    socket.on('getUsers', () => {
      socket.emit('userList', Array.from(users.values()).map(({ id, username, status, wins }) => ({ id, username, status, wins })));
    });

    socket.on('invite', ({ toUserId, fromUserId }) => {
      const toUser = users.get(toUserId);
      const fromUser = users.get(fromUserId);
      if (toUser && toUser.socketId && fromUser) {
        io.to(toUser.socketId).emit('invitation', { fromUser: { id: fromUser.id, username: fromUser.username } });
      }
    });

    socket.on('respondInvitation', ({ fromUserId, toUserId, accept }) => {
      if (accept) {
        const gameId = Math.random().toString(36).substr(2, 9);
        const game = {
          id: gameId,
          players: [fromUserId, toUserId],
          board: Array(9).fill(null),
          turn: fromUserId,
          status: 'playing' as const
        };
        games.set(gameId, game);

        const u1 = users.get(fromUserId);
        const u2 = users.get(toUserId);
        if (u1) u1.status = 'ingame';
        if (u2) u2.status = 'ingame';

        if (u1?.socketId) io.to(u1.socketId).emit('gameStarted', game);
        if (u2?.socketId) io.to(u2.socketId).emit('gameStarted', game);
        broadcastUsers();
      } else {
        const fromUser = users.get(fromUserId);
        if (fromUser?.socketId) {
          io.to(fromUser.socketId).emit('invitationRejected', { by: toUserId });
        }
      }
    });

    socket.on('makeMove', ({ gameId, userId, index }) => {
      const game = games.get(gameId);
      if (!game || game.status !== 'playing' || game.turn !== userId || game.board[index] !== null) return;

      const symbol = game.players[0] === userId ? 'X' : 'O';
      game.board[index] = symbol;

      const winner = checkWinner(game.board);
      if (winner) {
        game.status = 'won';
        game.winner = userId;
        const user = users.get(userId);
        if (user) user.wins += 1;
        endGame(gameId);
      } else if (game.board.every(cell => cell !== null)) {
        game.status = 'draw';
        endGame(gameId);
      } else {
        game.turn = game.players.find(p => p !== userId)!;
      }

      broadcastGameUpdate(gameId);
    });

    socket.on('leaveGame', ({ gameId, userId }) => {
      const game = games.get(gameId);
      if (game && game.status === 'playing') {
        const winnerId = game.players.find(p => p !== userId)!;
        game.status = 'won';
        game.winner = winnerId;
        const winner = users.get(winnerId);
        if (winner) winner.wins += 1;
        endGame(gameId);
        broadcastGameUpdate(gameId);
      }
    });

    socket.on('disconnect', () => {
      const user = Array.from(users.values()).find(u => u.socketId === socket.id);
      if (user) {
        user.status = 'offline';
        // Handle if they were in a game
        const gameEntry = Array.from(games.entries()).find(([id, g]) => g.status === 'playing' && g.players.includes(user.id));
        if (gameEntry) {
          const [gameId, game] = gameEntry;
          const winnerId = game.players.find(p => p !== user.id)!;
          game.status = 'won';
          game.winner = winnerId;
          const winner = users.get(winnerId);
          if (winner) winner.wins += 1;
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
