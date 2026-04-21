import React from 'react';
import { ServerStats } from '../types';
import { Activity, Users, Monitor, AlertTriangle, Clock, Hash } from 'lucide-react';
import { motion } from 'motion/react';

interface ServerDashboardProps {
  stats: ServerStats | null;
}

export default function ServerDashboard({ stats }: ServerDashboardProps) {
  if (!stats) return null;

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const dashboardItems = [
    { label: 'Uptime', value: formatUptime(stats.uptimeSeconds), icon: Clock, color: 'text-indigo-400' },
    { label: 'Usuarios Conectados', value: stats.connectedUsers, icon: Users, color: 'text-emerald-400' },
    { label: 'Juegos Activos', value: stats.activeGames, icon: Activity, color: 'text-blue-400' },
    { label: 'Total Partidas', value: stats.totalGames, icon: Hash, color: 'text-purple-400' },
    { label: 'Total Registrados', value: stats.totalUsers, icon: Monitor, color: 'text-slate-400' },
    { label: 'Errores Sistema', value: stats.errors, icon: AlertTriangle, color: stats.errors > 0 ? 'text-rose-400' : 'text-slate-600' },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 px-2">
        <Monitor className="w-4 h-4 text-rose-500" />
        <h2 className="text-xs font-black tracking-[0.2em] uppercase text-rose-400">Panel de Administración</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {dashboardItems.map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
            className="glass-panel p-4 rounded-xl border border-white/5 bg-slate-900/40"
          >
            <div className="flex items-center gap-2 mb-2">
              <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                {item.label}
              </span>
            </div>
            <p className="text-sm font-black font-mono tracking-tighter truncate">
              {item.value}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
