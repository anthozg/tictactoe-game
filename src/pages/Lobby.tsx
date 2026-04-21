import React from 'react';
import { User } from '../types';
import { motion } from 'motion/react';
import { Trophy, Users, Zap, Swords, Shield } from 'lucide-react';

interface LobbyProps {
  users: User[];
  currentUserId: string;
  onInvite: (userId: string) => void;
}

export default function Lobby({ users, currentUserId, onInvite }: LobbyProps) {
  const ranking = [...users].sort((a, b) => b.wins - a.wins).slice(0, 5);
  const otherUsers = users.filter(u => u.id !== currentUserId);
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredUsers = otherUsers.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleManualInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = otherUsers.find(u => u.username.toLowerCase() === searchQuery.toLowerCase());
    if (targetUser) {
      onInvite(targetUser.id);
      setSearchQuery('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar Left: Players List */}
      <div className="lg:col-span-3 space-y-6">
        <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
          <div className="bg-white/5 px-8 py-6 border-b border-white/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-black tracking-[0.2em] uppercase italic text-slate-200">Jugadores Online ({otherUsers.length})</h2>
            </div>
            
            <form onSubmit={handleManualInvite} className="flex-1 max-w-xs relative group">
              <input
                type="text"
                placeholder="Buscar o invitar por nick..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 shadow-inner border border-white/5 px-4 py-2 rounded-lg text-xs focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
              />
              <button 
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black text-indigo-400 opacity-0 group-focus-within:opacity-100 transition-opacity uppercase tracking-tighter"
              >
                DESAFIAR
              </button>
            </form>

            <div className="hidden sm:block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 tracking-widest uppercase">
              Live Network
            </div>
          </div>

          <div className="p-6 flex-1 bg-slate-950/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUsers.map((user) => (
                <motion.div
                  key={user.id}
                  whileHover={{ scale: 1.01 }}
                  className="bg-slate-900/60 border border-white/5 p-4 rounded-xl flex items-center justify-between group transition-all hover:bg-slate-800/80 hover:border-indigo-500/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-indigo-500/50 transition-colors">
                        <span className="text-lg font-black text-slate-300">{user.username[0].toUpperCase()}</span>
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#020617] ${
                        user.status === 'online' ? 'status-online' :
                        user.status === 'ingame' ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-600'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 group-hover:text-white transition-colors">{user.username}</h4>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                        {user.status === 'online' ? 'Disponible' :
                         user.status === 'ingame' ? 'En Partida' : 'Desconectado'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onInvite(user.id)}
                    disabled={user.status !== 'online'}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${
                      user.status === 'online'
                        ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white'
                        : 'bg-white/5 text-slate-700 cursor-not-allowed border border-transparent'
                    }`}
                  >
                    INVITAR
                  </button>
                </motion.div>
              ))}
              {otherUsers.length === 0 && (
                <div className="md:col-span-2 py-32 flex flex-col items-center justify-center text-slate-600">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <Zap className="w-8 h-8 opacity-20" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-2 text-slate-400">Sin señales detectadas</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest max-w-xs text-center leading-relaxed">
                    Comparte el link para invitar a un amigo. <br/>
                    El tablero se desplegará una vez aceptes un desafío.
                  </p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                    }}
                    className="mt-6 px-6 py-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shadow-lg shadow-indigo-600/10"
                  >
                    Copiar Enlace de Invitación
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Right: Stats */}
      <div className="lg:col-span-1 space-y-6">
        <div className="glass-panel rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400">Líderes Globales</h3>
          </div>
          <div className="space-y-5">
            {ranking.map((user, idx) => (
              <div key={user.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black w-5 ${
                    idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-700' : 'text-slate-600'
                  }`}>{String(idx + 1).padStart(2, '0')}</span>
                  <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{user.username}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">{user.wins.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 shadow-xl">
          <h3 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 mb-6 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            Tu Estado
          </h3>
          <div className="flex items-center gap-5">
            <span className="text-4xl font-black italic text-white">#12</span>
            <div className="text-[10px] uppercase font-black tracking-widest leading-relaxed">
              <p className="text-slate-500">Top 5% Global</p>
              <p className="text-emerald-400 font-black">↑ 2 Posiciones</p>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 left-0 h-1 w-full bg-slate-800">
            <div className="h-full bg-emerald-500 w-[98%] shadow-[0_0_8px_#10b981]"></div>
          </div>
          <h3 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 mt-2 mb-1">Red Central</h3>
          <p className="text-[10px] font-bold text-emerald-400/80 uppercase">Transmisión Estable</p>
        </div>
      </div>
    </div>
  );
}
