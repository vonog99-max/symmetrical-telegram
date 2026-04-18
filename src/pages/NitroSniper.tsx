import React, { useState, useEffect } from 'react';
import { Zap, Shield, Activity, BarChart3, Terminal } from 'lucide-react';

const API_BASE = '';

export default function NitroSniper() {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/nitro/status`, {
                headers: { 'Authorization': token }
            });
            const data = await res.json();
            setStatus(data);
        } catch (e) {
            setError('Failed to fetch sniper status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, [token]);

    const toggleSniper = async (enabled: boolean) => {
        try {
            await fetch(`${API_BASE}/api/nitro/toggle`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token 
                },
                body: JSON.stringify({ enabled })
            });
            fetchStatus();
        } catch (e) {
            setError('Failed to toggle sniper');
        }
    };

    if (loading) return <div className="p-8 text-center text-zinc-500">Loading Sniper...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto text-zinc-100">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
                <Zap className="w-8 h-8 text-yellow-500 fill-yellow-500" />
                Nitro Sniper
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-black/20 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4 text-zinc-400">
                        <Activity size={20} />
                        <span className="text-sm font-medium uppercase tracking-wider">Status</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className={`text-2xl font-bold ${status?.enabled ? 'text-green-500' : 'text-red-500'}`}>
                            {status?.enabled ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                        <button 
                            onClick={() => toggleSniper(!status?.enabled)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${status?.enabled ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20'}`}
                        >
                            {status?.enabled ? 'STOP' : 'START'}
                        </button>
                    </div>
                </div>

                <div className="bg-black/20 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4 text-zinc-400">
                        <BarChart3 size={20} />
                        <span className="text-sm font-medium uppercase tracking-wider">Detected</span>
                    </div>
                    <div className="text-3xl font-bold text-zinc-100">
                        {status?.stats?.detected || 0}
                    </div>
                </div>

                <div className="bg-black/20 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4 text-zinc-400">
                        <Zap size={20} className="text-yellow-500" />
                        <span className="text-sm font-medium uppercase tracking-wider">Claimed</span>
                    </div>
                    <div className="text-3xl font-bold text-yellow-500">
                        {status?.stats?.claimed || 0}
                    </div>
                </div>
            </div>

            <div className="bg-black/20 border border-white/10 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-medium text-zinc-300 mb-4 flex items-center gap-2">
                    <Shield size={20} className="text-indigo-400" />
                    Sniper Features
                </h3>
                <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-sm text-zinc-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <span>**Ultra-Fast Redeeming:** Uses raw HTTPS requests with TLS connection reuse for maximum speed.</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-zinc-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <span>**Multi-Request Race:** Sends 3 parallel requests per code to ensure you win the race against other snipers.</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-zinc-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <span>**Global Detection:** Scans every message in every server and DM your account can see.</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-zinc-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <span>**Command Control:** Use `.nitro on` or `.nitro off` in Discord to control the sniper.</span>
                    </li>
                </ul>
            </div>

            <div className="bg-black/20 border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-medium text-zinc-300 mb-4 flex items-center gap-2">
                    <Terminal size={20} className="text-zinc-500" />
                    Live Logs
                </h3>
                <div className="bg-black/40 rounded-lg p-4 font-mono text-xs text-zinc-500 h-64 overflow-y-auto border border-white/5">
                    {status?.logs?.length > 0 ? (
                        status.logs.map((log: string, i: number) => (
                            <div key={i} className="mb-1 py-1 border-b border-white/5 last:border-0">
                                <span className="text-zinc-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                {log}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 italic">No sniper activity logged yet...</div>
                    )}
                </div>
            </div>

            {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-center text-red-400">
                    {error}
                </div>
            )}
        </div>
    );
}
