import React from 'react';
import { User, ServerStats } from '../types';
import { motion } from 'motion/react';
import { Trophy, Users, Zap, Swords, Shield, Cpu } from 'lucide-react';
import ServerDashboard from '../components/ServerDashboard';

interface LobbyProps {
  users: User[];
  currentUserId: string;
  onInvite: (userId: string) => void;
  serverStats?: ServerStats | null;
}

export default function Lobby({ users, currentUserId, onInvite, serverStats }: LobbyProps) {
  const ranking = [...users].sort((a, b) => b.wins - a.wins).slice(0, 8);
  const otherUsers = users.filter(u => u.id !== currentUserId && !u.isBot);
  const botPlayer = users.find(u => u.isBot);
  const currentUser = users.find(u => u.id === currentUserId);
  const isAdmin = currentUser?.username.toLowerCase() === 'admin';
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
    <div className="space-y-8">
      {/* Server Dashboard Integration (Requirement 13) - Only for Admins */}
      {isAdmin && <ServerDashboard stats={serverStats || null} />}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Left: Players List */}
        <div className="lg:col-span-3 space-y-6">
          {/* Bot Challenge Banner (Requirement 11) */}
          {botPlayer && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-panel p-6 rounded-2xl border-indigo-500/30 bg-indigo-500/5 flex items-center justify-between overflow-hidden relative group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Cpu className="w-24 h-24" />
              </div>
              <div className="relative z-10 flex items-center gap-6">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Cpu className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-indigo-400">Desafío Neural</h3>
                  <p className="text-xs font-bold text-slate-400">Entrena tus habilidades contra la Inteligencia Artificial del sistema.</p>
                </div>
              </div>
              <button
                onClick={() => onInvite(botPlayer.id)}
                className="relative z-10 px-8 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20"
              >
                INICIAR PRUEBA
              </button>
            </motion.div>
          )}

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

        {/* Sidebar Right: Stats (Requirement 10) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Trophy className="w-12 h-12" />
            </div>
            <div className="flex items-center gap-3 mb-6 relative">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400">Ranking Público</h3>
            </div>
            <div className="space-y-4">
              {ranking.map((user, idx) => (
                <div key={user.id} className="flex flex-col gap-1 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black w-4 ${
                        idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-700' : 'text-slate-600'
                      }`}>{idx + 1}</span>
                      <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{user.username}</span>
                      {user.isBot && <Cpu className="w-2.5 h-2.5 text-indigo-500" />}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-indigo-400">{user.wins} PTS</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${idx === 0 ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-indigo-500'}`} 
                        style={{ width: `${Math.min(100, (user.wins / (ranking[0].wins || 1)) * 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">
                      W:{user.wins} D:{user.draws || 0} L:{user.losses || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 shadow-xl">
            <h3 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 mb-6 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              Tu Perfil
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-black italic text-white">#{users.indexOf(users.find(u => u.id === currentUserId)!) + 1}</p>
                <p className="text-[9px] text-slate-500 uppercase font-black mt-1">Ranking Actual</p>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                </div>
                <p className="text-[9px] text-emerald-400 font-bold uppercase mt-1">Nivel: Avanzado</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
