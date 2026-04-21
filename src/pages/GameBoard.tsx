import React from 'react';
import { Game } from '../types';
import { getSocket } from '../lib/socket';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, X, Circle, RotateCcw, LogOut, Trophy, AlertCircle } from 'lucide-react';

interface GameBoardProps {
  game: Game;
  userId: string;
  onBack: () => void;
}

export default function GameBoard({ game, userId, onBack }: GameBoardProps) {
  const isMyTurn = game.status === 'playing' && game.turn === userId;
  const isWinner = game.status === 'won' && game.winner === userId;
  const isLoser = game.status === 'won' && game.winner !== userId;
  const isDraw = game.status === 'draw';

  const handleCellClick = (index: number) => {
    if (!isMyTurn || game.board[index] !== null) return;
    getSocket().emit('makeMove', { gameId: game.id, userId, index });
  };

  const handleLeave = () => {
    if (game.status === 'playing') {
      if (confirm('¿Seguro que quieres abandonar? Se contará como una derrota.')) {
        getSocket().emit('leaveGame', { gameId: game.id, userId });
      }
    } else {
      onBack();
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-4 h-full flex flex-col">
      {/* Game Header */}
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between mb-8 bg-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-blue-500 font-black text-xl italic neon-text-blue">X</span>
            <span className="text-sm font-bold text-slate-200">
              {game.players[0] === userId ? 'Tú' : 'Rival'}
            </span>
          </div>
          <span className="text-slate-600 font-black italic text-xs">VS</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-200">
              {game.players[1] === userId ? 'Tú' : 'Rival'}
            </span>
            <span className="text-rose-500 font-black text-xl italic neon-text-rose">O</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all ${
            isMyTurn 
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
              : 'bg-slate-800 text-slate-500 border border-transparent'
          }`}>
            {isMyTurn ? 'TU TURNO' : 'TURNO RIVAL'}
          </div>
          <button
            onClick={handleLeave}
            className="p-2 hover:bg-rose-500/10 rounded-lg transition-colors group"
            title="Salir"
          >
            <LogOut className="w-4 h-4 text-slate-500 group-hover:text-rose-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 items-center justify-center min-h-0">
        {/* The Grid Container */}
        <div className="glass-panel p-8 rounded-[40px] shadow-2xl relative">
          <div className="grid grid-cols-3 gap-4 w-72 h-72 sm:w-96 sm:h-96">
            {game.board.map((cell, idx) => (
              <motion.button
                key={idx}
                whileHover={isMyTurn && !cell ? { scale: 1.02 } : {}}
                whileTap={isMyTurn && !cell ? { scale: 0.98 } : {}}
                onClick={() => handleCellClick(idx)}
                className={`board-cell rounded-2xl flex items-center justify-center transition-all ${
                  !cell && isMyTurn ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <AnimatePresence>
                  {cell === 'X' && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-blue-500 font-black text-6xl sm:text-7xl neon-text-blue"
                    >
                      X
                    </motion.div>
                  )}
                  {cell === 'O' && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-rose-500 font-black text-6xl sm:text-7xl neon-text-rose"
                    >
                      O
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Info Column */}
        <div className="w-full lg:w-72 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {game.status !== 'playing' ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel rounded-3xl p-8 shadow-2xl border-indigo-500/30"
              >
                <div className="flex justify-center mb-6">
                  {isWinner ? (
                    <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                      <Trophy className="w-8 h-8 text-indigo-400" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5">
                      <AlertCircle className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                </div>

                <h3 className="text-2xl font-black text-center mb-1 uppercase tracking-tighter italic">
                  {isWinner ? 'Dominación' : isLoser ? 'Eliminado' : 'Empate'}
                </h3>
                <p className="text-center text-[10px] text-slate-500 font-black uppercase tracking-widest mb-8">
                  {isWinner ? 'Análisis completado: Victoria' : 
                   isLoser ? 'Error en ejecución: Derrota' : 
                   'Conflicto de señales: Empate'}
                </p>

                <button
                  onClick={onBack}
                  className="w-full py-4 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
                >
                  VOLVER AL LOBBY
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-panel rounded-3xl p-6 space-y-6"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-200">
                    {isMyTurn ? 'Analizando...' : 'Transmisión Rival'}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">
                    {isMyTurn ? 'Detectando vulnerabilidades en el patrón actual. Elige tu coordenada.' : 'Esperando a que el oponente resuelva su próximo movimiento.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Latencia Red</p>
                    <p className="font-mono text-xs font-bold text-emerald-400">24ms</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Protocolo</p>
                    <p className="font-mono text-xs font-bold text-indigo-400">WS-GAME</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass-panel rounded-2xl p-4 flex justify-between items-center bg-slate-900/50">
            <div className="text-center flex-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Duelos</p>
              <p className="text-sm font-black italic">04</p>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div className="text-center flex-1">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Uptime</p>
              <p className="text-sm font-mono font-bold">01:24</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
