import React, { useState, useEffect } from 'react';
import { getSocket } from './lib/socket';
import { User, Game, AuthStatus } from './types';
import Auth from './pages/Auth';
import Lobby from './pages/Lobby';
import GameBoard from './pages/GameBoard';
import { User as UserIcon, LogOut, Loader2, Zap, Gamepad2, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('unauthenticated');
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [invitation, setInvitation] = useState<{ fromUser: { id: string, username: string } } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    
    setIsConnected(socket.connected);

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('userList', (updatedUsers: User[]) => {
      setUsers(updatedUsers);
    });

    socket.on('invitation', (inv) => {
      setInvitation(inv);
    });

    socket.on('invitationRejected', ({ by }) => {
      setUsers(prevUsers => {
        const byUser = prevUsers.find(u => u.id === by);
        setNotification({ type: 'error', message: `${byUser?.username || 'Player'} rechazó tu duelo.` });
        return prevUsers;
      });
      setTimeout(() => setNotification(null), 3000);
    });

    socket.on('gameStarted', (startedGame: Game) => {
      setGame(startedGame);
      setInvitation(null);
      setNotification(null);
    });

    socket.on('gameUpdate', (updatedGame: Game) => {
      setGame(updatedGame);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('userList');
      socket.off('invitation');
      socket.off('invitationRejected');
      socket.off('gameStarted');
      socket.off('gameUpdate');
    };
  }, []);

  const handleInvite = (toId: string) => {
    getSocket().emit('invite', { fromUserId: userId, toUserId: toId });
    setNotification({ type: 'success', message: 'Invitación enviada con éxito' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogin = (uId: string, uName: string) => {
    setUserId(uId);
    setUsername(uName);
    setAuthStatus('authenticated');
    getSocket().emit('join', { id: uId, username: uName, status: 'online', wins: 0 });
    getSocket().emit('getUsers');
  };

  const handleLogout = () => {
    setUserId(null);
    setUsername(null);
    setAuthStatus('unauthenticated');
    setGame(null);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full"></div>
      </div>

      <header className="relative z-10 glass-panel mt-6 mx-4 md:mx-auto max-w-7xl rounded-2xl">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20">
              <Gamepad2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                TicTacToe <span className="text-indigo-400">RealTime</span>
              </h1>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]'}`}></div>
                <span className={isConnected ? 'text-slate-400' : 'text-rose-400'}>
                  {isConnected ? 'Red: Estable' : 'Red: Desconectado'}
                </span>
              </div>
            </div>
          </div>

          {authStatus === 'authenticated' && (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setNotification({ type: 'success', message: 'Link de invitación copiado' });
                  setTimeout(() => setNotification(null), 2000);
                }}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Copiar Link
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-200">{username}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-none">Senior Player</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-700 border border-white/10 overflow-hidden flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs uppercase">
                  {username?.slice(0, 2)}
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors group"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 text-slate-400 group-hover:text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8 min-h-[calc(100vh-160px)]">
        <AnimatePresence mode="wait">
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl font-bold uppercase tracking-tight border border-white/10 backdrop-blur-md ${
                notification.type === 'success' ? 'bg-emerald-500/90' : 'bg-rose-500/90'
              } text-white`}
            >
              {notification.message}
            </motion.div>
          )}

          {invitation && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0, transition: { type: 'spring', damping: 15 } }}
              className="fixed bottom-8 right-8 w-80 glass-panel border-indigo-500/50 shadow-2xl shadow-indigo-500/20 rounded-2xl p-5 flex gap-4 items-center z-50"
            >
              <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 animate-pulse">
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-tighter">Nueva Invitación</p>
                <p className="text-sm font-bold text-slate-200">
                  <span className="text-indigo-400">{invitation.fromUser.username}</span> te desafía
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => getSocket().emit('respondInvitation', { fromUserId: invitation.fromUser.id, toUserId: userId, accept: true })}
                    className="flex-1 py-1.5 text-[10px] font-black bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors uppercase"
                  >
                    ACEPTAR
                  </button>
                  <button
                    onClick={() => {
                      getSocket().emit('respondInvitation', { fromUserId: invitation.fromUser.id, toUserId: userId, accept: false });
                      setInvitation(null);
                    }}
                    className="flex-1 py-1.5 text-[10px] font-black bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors uppercase"
                  >
                    RECHAZAR
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {authStatus === 'unauthenticated' ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Auth onLogin={handleLogin} />
            </motion.div>
          ) : game ? (
            <motion.div
              key="game"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
            >
              <GameBoard game={game} userId={userId!} onBack={() => setGame(null)} />
            </motion.div>
          ) : (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Lobby users={users} currentUserId={userId!} onInvite={handleInvite} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© 2026 Tic Tac Neon • Crafted with Intensity</p>
        </div>
      </footer>
    </div>
  );
}
