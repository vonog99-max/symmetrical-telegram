import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, UserX, Ghost, MessageSquare, Trash2, Search, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

export default function RevengeTab({ token }: { token: string }) {
  const [termedUsers, setTermedUsers] = useState<string[]>([]);
  const [targetId, setTargetId] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchTermedUsers();
  }, []);

  const fetchTermedUsers = async () => {
    try {
      const res = await api.getTermedUsers(token);
      setTermedUsers(res.users || []);
    } catch (err) {
      console.error('Failed to fetch termed users:', err);
    }
  };

  const handleTerm = async () => {
    if (!targetId) return;
    setIsLoading(true);
    try {
      await api.termUser(token, targetId);
      setStatus(`ACTIVE TERMINATION: Monitoring ${targetId} across all shared servers.`);
      setTargetId('');
      fetchTermedUsers();
    } catch (err) {
      setStatus(`Error: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScrapeTerm = async () => {
    if (!targetId) return;
    setIsLoading(true);
    try {
      await api.scrapeTerm(token, targetId);
      setStatus(`HISTORICAL SCAN INITIATED: Searching all shared servers for violations by ${targetId}...`);
      setTargetId('');
    } catch (err) {
      setStatus(`Error: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnterm = async (id: string) => {
    try {
      await api.untermUser(token, id);
      setStatus(`TERMINATION HALTED: Stopped monitoring user ${id}`);
      fetchTermedUsers();
    } catch (err) {
      setStatus(`Error: ${err}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-500/10 rounded-lg">
            <ShieldAlert className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-300">Active Termination</h3>
            <p className="text-xs text-zinc-500">Real-time monitoring and automated Discord T&S reporting</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="User ID to monitor"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTerm}
                disabled={isLoading || !targetId}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Initiate Termination
              </button>
              <button
                onClick={handleScrapeTerm}
                disabled={isLoading || !targetId}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                title="Scrape past messages and report violations"
              >
                <Search className="w-4 h-4" />
                Scrape & Term
              </button>
            </div>
          </div>

          {status && (
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-zinc-400">{status}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Currently Termed Users</h3>
        <div className="space-y-2">
          {termedUsers.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg">
              <UserX className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">No users are currently being monitored</p>
            </div>
          ) : (
            termedUsers.map((id) => (
              <div key={id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center">
                    <span className="text-[10px] text-zinc-500 font-mono">{id.slice(-4)}</span>
                  </div>
                  <span className="text-sm text-zinc-300 font-mono">{id}</span>
                </div>
                <button
                  onClick={() => handleUnterm(id)}
                  className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Ghost className="w-5 h-5 text-zinc-400" />
            <h3 className="text-sm font-medium text-zinc-300">Ghost Ping</h3>
          </div>
          <p className="text-xs text-zinc-500 mb-4">Ping a user and delete the message instantly.</p>
          <button className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-all">
            Configure Ghost Ping
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="w-5 h-5 text-zinc-400" />
            <h3 className="text-sm font-medium text-zinc-300">Mass Spam</h3>
          </div>
          <p className="text-xs text-zinc-500 mb-4">Rapidly send messages to a target channel.</p>
          <button className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-all">
            Configure Spam
          </button>
        </div>
      </div>
    </div>
  );
}
