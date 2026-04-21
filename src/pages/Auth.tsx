import React, { useState } from 'react';
import { getSocket } from '../lib/socket';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Lock, User as UserIcon, Loader2, Mail, X } from 'lucide-react';

interface AuthProps {
  onLogin: (userId: string, username: string) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recovery Modal State
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    if (!isLogin) {
      if (!email) {
        setError('El correo es obligatorio para el registro');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        return;
      }
    }

    setLoading(true);
    setError(null);
    const socket = getSocket();

    const event = isLogin ? 'login' : 'register';
    const payload = isLogin ? { username, password } : { username, email, password };
    
    socket.emit(event, payload, (response: any) => {
      setLoading(false);
      if (response.success) {
        onLogin(response.userId, username);
      } else {
        setError(response.message || 'Authentication failed');
      }
    });
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) return;

    setRecoveryLoading(true);
    setRecoveryMessage(null);

    const socket = getSocket();
    socket.emit('resetPassword', { email: recoveryEmail }, (response: any) => {
      setRecoveryLoading(false);
      if (response.success) {
        setRecoveryMessage({
          type: 'success',
          text: 'Instrucciones enviadas. Revisa tu bandeja de entrada.'
        });
        setRecoveryEmail('');
      } else {
        setRecoveryMessage({
          type: 'error',
          text: response.message || 'Error al procesar la solicitud'
        });
      }
    });
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 relative min-h-[600px]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel rounded-[32px] p-8 shadow-2xl backdrop-blur-2xl z-10"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-center mb-1 tracking-tight uppercase italic text-white">
          {isLogin ? 'Iniciar Sesión' : 'Registro'}
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

          {!isLogin && (
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-slate-600 text-sm"
              />
            </div>
          )}

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

          {!isLogin && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-slate-600 text-sm"
              />
            </div>
          )}

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

        <div className="mt-6 flex flex-col gap-4 items-center">
          {isLogin && (
            <button
              onClick={() => setShowRecovery(true)}
              className="text-slate-500 hover:text-indigo-400 transition-colors text-[10px] font-bold uppercase tracking-[0.2em]"
            >
              ¿Olvidaste tu contraseña? RECUPERAR
            </button>
          )}
          <div className="w-full h-px bg-white/5" />
          <button
            onClick={toggleMode}
            className="text-slate-500 hover:text-indigo-400 transition-colors text-xs font-bold uppercase tracking-widest"
          >
            {isLogin ? '¿Nuevo en la red? Regístrate' : '¿Ya eres miembro? Inicia sesión'}
          </button>
        </div>
      </motion.div>

      {/* Password Recovery Modal */}
      <AnimatePresence>
        {showRecovery && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowRecovery(false);
                setRecoveryMessage(null);
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 m-auto w-full max-w-sm h-fit glass-panel rounded-[32px] p-8 shadow-2xl z-50 border-white/10"
            >
              <button
                onClick={() => {
                  setShowRecovery(false);
                  setRecoveryMessage(null);
                }}
                className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
                  <Mail className="w-6 h-6 text-indigo-400" />
                </div>
              </div>

              <h3 className="text-xl font-black text-center mb-1 tracking-tight uppercase italic text-white">
                Recuperación
              </h3>
              <p className="text-center text-slate-400 mb-6 text-xs leading-relaxed">
                Ingresa tu correo electrónico asociado para reestablecer tu acceso a la red.
              </p>

              <form onSubmit={handleRecovery} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="E-mail"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-slate-600 text-xs"
                  />
                </div>

                {recoveryMessage && (
                  <div className={`p-4 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                    recoveryMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                  }`}>
                    {recoveryMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="w-full py-3.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-500 transition-all flex items-center justify-center disabled:opacity-50 uppercase tracking-widest text-[10px]"
                >
                  {recoveryLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ENVIAR INSTRUCCIONES'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
