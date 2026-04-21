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
    email?: string,
    hashedPassword: string, 
    status: 'online' | 'offline' | 'ingame', 
    socketId?: string, 
    wins: number,
    draws: number,
    losses: number,
    isBot?: boolean
  }>();

  // Initialize BOT player
  const BOT_ID = 'bot-system';
  users.set(BOT_ID, {
    id: BOT_ID,
    username: 'NEURAL-BOT',
    hashedPassword: 'SYSTEM_BOT_ACCOUNT',
    status: 'online',
    wins: 99,
    draws: 42,
    losses: 12,
    isBot: true
  });

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

  // Reconnection tracking
  const reconnectionTimeouts = new Map<string, NodeJS.Timeout>();
  const SERVER_START_TIME = Date.now();
  let serverErrors = 0;

  // Requirement 9: Monitor and Log Server Events
  function logEvent(type: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logEntry, data ? JSON.stringify(data) : '');
    if (type === 'error') serverErrors++;
  }

  // Dashboard broadcaster
  setInterval(() => {
    const stats = {
      connectedUsers: Array.from(users.values()).filter(u => u.status !== 'offline').length,
      activeGames: Array.from(games.values()).filter(g => g.status === 'playing').length,
      totalGames: games.size,
      totalUsers: users.size - 1, // Exclude bot
      errors: serverErrors,
      uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000)
    };
    io.emit('serverStats', stats);
  }, 2000);

  io.on('connection', (socket) => {
    logEvent('system', `Socket connected: ${socket.id}`);

    socket.on('rejoin', ({ userId }) => {
      const user = users.get(userId);
      if (user) {
        user.socketId = socket.id;
        user.status = user.status === 'offline' ? 'online' : user.status;
        
        // Clear any pending disconnect timeouts
        if (reconnectionTimeouts.has(userId)) {
          clearTimeout(reconnectionTimeouts.get(userId)!);
          reconnectionTimeouts.delete(userId);
          logEvent('system', `User reconnected: ${user.username}`);
        }

        // Send current game state if they are in one
        const activeGame = Array.from(games.values()).find(g => g.players.includes(userId));
        if (activeGame) {
          socket.emit('gameStarted', activeGame);
          broadcastUsers();
        }
      }
    });

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
          wins: 0,
          draws: 0,
          losses: 0
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
        
        if (user && user.id !== BOT_ID && await bcrypt.compare(password, user.hashedPassword)) {
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
      socket.emit('userList', Array.from(users.values()).map(({ id, username, status, wins, draws, losses, isBot }) => ({ id, username, status, wins, draws, losses, isBot })));
    });

    socket.on('invite', ({ toUserId, fromUserId }) => {
      const toUser = users.get(toUserId);
      const fromUser = users.get(fromUserId);
      
      if (toUserId === BOT_ID && fromUser) {
        // Auto-accept if bot
        logEvent('game', `Player ${fromUser.username} challenging BOT`);
        startNewGame(fromUserId, BOT_ID);
        return;
      }

      if (toUser && toUser.socketId && fromUser) {
        logEvent('game', `Invitation sent: ${fromUser.username} -> ${toUser.username}`);
        io.to(toUser.socketId).emit('invitation', { fromUser: { id: fromUser.id, username: fromUser.username } });
      }
    });

    function startNewGame(p1Id: string, p2Id: string) {
      const gameId = Math.random().toString(36).substr(2, 9);
      const game = {
        id: gameId,
        players: [p1Id, p2Id],
        board: Array(9).fill(null),
        turn: p1Id,
        status: 'playing' as const,
        startTime: Date.now(),
        round: 1,
        scores: { [p1Id]: 0, [p2Id]: 0 },
        rematchRequests: []
      };
      games.set(gameId, game);

      const u1 = users.get(p1Id);
      const u2 = users.get(p2Id);
      if (u1) u1.status = 'ingame';
      if (u2) u2.status = 'ingame';

      logEvent('game', `Game started: ${gameId} (${u1?.username} vs ${u2?.username})`);
      
      if (u1?.socketId) io.to(u1.socketId).emit('gameStarted', game);
      if (u2?.socketId) io.to(u2.socketId).emit('gameStarted', game);
      broadcastUsers();
    }

    socket.on('respondInvitation', ({ fromUserId, toUserId, accept }) => {
      const fromUser = users.get(fromUserId);
      const toUser = users.get(toUserId);

      if (accept) {
        startNewGame(fromUserId, toUserId);
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
      }

      const hasBot = game.players.includes(BOT_ID);
      if (hasBot && !game.rematchRequests.includes(BOT_ID)) {
        game.rematchRequests.push(BOT_ID);
      }

      if (game.rematchRequests.length === 2 && game.round < 3 && !game.seriesWinner) {
        game.round += 1;
        game.board = Array(9).fill(null);
        game.status = 'playing';
        game.winner = undefined;
        game.rematchRequests = [];
        game.turn = game.players[game.round % 2 === 0 ? 1 : 0];
        
        broadcastGameUpdate(gameId);
        
        if (game.turn === BOT_ID) {
          setTimeout(() => botMove(gameId), 1000);
        }
      } else {
        broadcastGameUpdate(gameId);
      }
    });

    async function botMove(gameId: string) {
      const game = games.get(gameId);
      if (!game || game.status !== 'playing' || game.turn !== BOT_ID) return;

      // Simple AI: Random empty spot
      const emptyIndices = game.board.map((cell, i) => cell === null ? i : null).filter(v => v !== null) as number[];
      if (emptyIndices.length > 0) {
        const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        processMove(gameId, BOT_ID, randomIndex);
      }
    }

    function processMove(gameId: string, userId: string, index: number) {
      const game = games.get(gameId);
      const user = users.get(userId);
      if (!game || game.status !== 'playing' || game.turn !== userId || game.board[index] !== null) return;

      const symbol = game.players[0] === userId ? 'X' : 'O';
      game.board[index] = symbol;

      const winnerSymbol = checkWinner(game.board);
      if (winnerSymbol) {
        game.status = 'won';
        game.winner = userId;
        game.scores[userId] += 1;
        
        if (game.scores[userId] >= 2 || (game.round === 3)) {
          const opponentId = game.players.find(p => p !== userId)!;
          if (game.scores[userId] > game.scores[opponentId]) {
            game.seriesWinner = userId;
          } else if (game.scores[opponentId] > game.scores[userId]) {
            game.seriesWinner = opponentId;
          }
          
          if (game.seriesWinner) {
            const seriesWinnerUser = users.get(game.seriesWinner);
            const seriesLoserUser = users.get(game.players.find(p => p !== game.seriesWinner)!);
            if (seriesWinnerUser) seriesWinnerUser.wins += 1;
            if (seriesLoserUser) seriesLoserUser.losses += 1;
          }
          endGame(gameId);
        }
      } else if (game.board.every(cell => cell !== null)) {
        game.status = 'draw';
        if (game.round === 3) {
          const p1 = game.players[0];
          const p2 = game.players[1];
          const u1 = users.get(p1);
          const u2 = users.get(p2);
          if (game.scores[p1] > game.scores[p2]) game.seriesWinner = p1;
          else if (game.scores[p2] > game.scores[p1]) game.seriesWinner = p2;
          
          if (game.seriesWinner) {
            const winU = users.get(game.seriesWinner);
            const loseU = users.get(game.players.find(p => p !== game.seriesWinner)!);
            if (winU) winU.wins += 1;
            if (loseU) loseU.losses += 1;
          } else {
            // Overall series draw
            if (u1) u1.draws += 1;
            if (u2) u2.draws += 1;
          }
          endGame(gameId);
        }
      } else {
        game.turn = game.players.find(p => p !== userId)!;
        if (game.turn === BOT_ID) {
          setTimeout(() => botMove(gameId), 1000);
        }
      }

      broadcastGameUpdate(gameId);
    }

    socket.on('makeMove', ({ gameId, userId, index }) => {
      processMove(gameId, userId, index);
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
        if (user) user.losses += 1;
        
        logEvent('game', `Game ended: ${gameId} - Abandoned by ${user?.username}`);
        endGame(gameId);
        broadcastGameUpdate(gameId);
      }
    });

    socket.on('disconnect', () => {
      const user = Array.from(users.values()).find(u => u.socketId === socket.id);
      if (user && user.id !== BOT_ID) {
        logEvent('system', `User disconnected: ${user.username}. Waiting for reconnection...`);
        
        const timeout = setTimeout(() => {
          user.status = 'offline';
          const gameEntry = Array.from(games.entries()).find(([id, g]) => g.status === 'playing' && g.players.includes(user.id));
          if (gameEntry) {
            const [gameId, game] = gameEntry;
            const winnerId = game.players.find(p => p !== user.id)!;
            const winner = users.get(winnerId);
            game.status = 'won';
            game.winner = winnerId;
            game.seriesWinner = winnerId;
            if (winner) winner.wins += 1;
            user.losses += 1;
            endGame(gameId);
            broadcastGameUpdate(gameId);
          }
          broadcastUsers();
          reconnectionTimeouts.delete(user.id);
        }, 30000); // 30 second window

        reconnectionTimeouts.set(user.id, timeout);
      }
    });

    function broadcastUsers() {
      const userList = Array.from(users.values()).map(({ id, username, status, wins, draws, losses, isBot }) => ({ id, username, status, wins, draws, losses, isBot }));
      io.emit('userList', userList);
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
          if (u && u.id !== BOT_ID) u.status = 'online';
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
