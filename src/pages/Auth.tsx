import React, { useState } from 'react';
import { getSocket } from '../lib/socket';
import { motion } from 'motion/react';
import { Shield, Lock, User as UserIcon, Loader2 } from 'lucide-react';

interface AuthProps {
  onLogin: (userId: string, username: string) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError(null);
    const socket = getSocket();

    const event = isLogin ? 'login' : 'register';
    socket.emit(event, { username, password }, (response: any) => {
      setLoading(false);
      if (response.success) {
        onLogin(response.userId, username);
      } else {
        setError(response.message || 'Authentication failed');
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel rounded-[32px] p-8 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-center mb-1 tracking-tight uppercase italic text-white">
          {isLogin ? 'Autenticación' : 'Registro'}
        </h2>
        <p className="text-center text-slate-400 mb-8 h-6 text-sm">
          {isLogin ? 'Ingresa a la red de alto rendimiento' : 'Crea tu perfil de competidor'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-slate-600 text-sm"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-slate-600 text-sm"
            />
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold uppercase tracking-wider">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-500 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center disabled:opacity-50 shadow-lg shadow-indigo-600/20 uppercase tracking-widest text-xs"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLogin ? 'ENTRAR' : 'REGISTRAR')}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-slate-500 hover:text-indigo-400 transition-colors text-xs font-bold uppercase tracking-widest"
          >
            {isLogin ? '¿Nuevo en la red? Regístrate' : '¿Ya eres miembro? Inicia sesión'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
