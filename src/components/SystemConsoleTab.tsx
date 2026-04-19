import React, { useState, useEffect } from 'react';
import { Terminal, Cpu, HardDrive, Play, AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { motion } from 'motion/react';

export default function SystemConsoleTab() {
  const [stats, setStats] = useState<any>(null);
  const [shellInput, setShellInput] = useState('');
  const [shellOutput, setShellOutput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [vpsStatus, setVpsStatus] = useState<any>({ status: 'idle' });
  const [startingVps, setStartingVps] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchVpsStatus();
    const interval = setInterval(() => {
        fetchStats();
        fetchVpsStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
        const res = await fetch('/api/system/stats');
        if (res.ok) setStats(await res.json());
    } catch(e){}
  };

  const fetchVpsStatus = async () => {
      try {
          const res = await fetch('/api/vps/status');
          if (res.ok) setVpsStatus(await res.json());
      } catch(e){}
  };

  const handleShellExec = async () => {
      if (!shellInput.trim()) return;
      setExecuting(true);
      try {
          const res = await fetch('/api/system/shell', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: shellInput })
          });
          const data = await res.json();
          setShellOutput(prev => `> ${shellInput}\n${data.output}\n\n${prev}`);
          setShellInput('');
      } catch (e: any) {
          setShellOutput(prev => `> ${shellInput}\nError: ${e.message}\n\n${prev}`);
      } finally {
          setExecuting(false);
      }
  };

  const startPersistentWorker = async () => {
      setStartingVps(true);
      try {
          const res = await fetch('/api/vps/auto-deploy', { method: 'POST' });
          if (res.ok) fetchVpsStatus();
      } catch(e){}
      finally {
          setStartingVps(false);
      }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
            icon={Cpu} 
            label="Memory Usage" 
            value={stats ? `${stats.memory.toFixed(2)} MB` : 'Loading...'} 
            color="text-blue-400"
        />
        <StatsCard 
            icon={HardDrive} 
            label="Server Uptime" 
            value={stats ? formatUptime(stats.uptime) : 'Loading...'} 
            color="text-emerald-400"
        />
        <StatsCard 
            icon={Loader2} 
            label="Active Bot Units" 
            value={stats ? `${stats.activeBots} Sessions` : 'Loading...'} 
            color="text-purple-400"
            animate={stats?.activeBots > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Persistent Worker Section */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6 flex flex-col">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Play className="w-5 h-5 text-indigo-400" />
                Persistent Cloud Worker
            </h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                The AI Studio environment is great for short sessions, but it can sleep after inactivity. 
                Trigger a **Persistent GitHub Worker** to keep your processing alive for up to 6 hours autonomously.
            </p>

            <div className="mt-auto space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold">Current Status</span>
                        <span className={`text-sm font-medium ${
                            vpsStatus.status === 'success' ? 'text-emerald-400' : 
                            vpsStatus.status === 'deploying' ? 'text-blue-400 animate-pulse' : 
                            vpsStatus.status === 'error' ? 'text-red-400' : 'text-zinc-400'
                        }`}>
                            {vpsStatus.status?.toUpperCase() || 'IDLE'}
                        </span>
                    </div>
                    {vpsStatus.status === 'success' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : vpsStatus.status === 'error' ? (
                        <AlertCircle className="w-6 h-6 text-red-500" />
                    ) : null}
                </div>

                <button 
                    onClick={startPersistentWorker}
                    disabled={startingVps || vpsStatus.status === 'deploying'}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                >
                    {startingVps ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                    Start 6-Hour Persistent Session
                </button>
                {vpsStatus.error && (
                    <p className="text-[10px] text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">
                        Error: {vpsStatus.error}
                    </p>
                )}
            </div>
        </div>

        {/* Terminal Section */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6 flex flex-col h-[400px]">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-zinc-400" />
                Live Shell Console
            </h3>
            <div className="flex-1 bg-black/60 rounded-lg p-4 font-mono text-xs text-emerald-500/80 overflow-y-auto border border-white/5 mb-4">
                <pre className="whitespace-pre-wrap">
                    {shellOutput || 'System ready. Enter a command below...'}
                </pre>
            </div>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    placeholder="ls -la, uname -a, etc..."
                    value={shellInput}
                    onChange={(e) => setShellInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleShellExec()}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500/50"
                />
                <button 
                    onClick={handleShellExec}
                    disabled={executing}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-zinc-400 transition-colors disabled:opacity-50"
                >
                    {executing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ icon: Icon, label, value, color, animate }: any) {
    return (
        <div className="bg-black/40 border border-white/10 rounded-xl p-5 flex items-center gap-4">
            <div className={`p-3 bg-black/20 rounded-lg border border-white/5 ${color}`}>
                <Icon className={`w-6 h-6 ${animate ? 'animate-pulse' : ''}`} />
            </div>
            <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{label}</p>
                <p className="text-lg font-bold text-white tracking-tight">{value}</p>
            </div>
        </div>
    );
}
