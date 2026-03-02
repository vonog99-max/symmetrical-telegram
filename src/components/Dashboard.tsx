import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Activity, Users, Settings, Skull, Mic, MessageSquare, UserPlus, LogOut, Flame, AlertTriangle, Type, Eraser, ShieldAlert, Gamepad2, Terminal } from 'lucide-react';
import { api } from '../services/api';
import { BotSession } from '../types';
import { motion } from 'motion/react';
import Rpc from '../pages/Rpc';

interface DashboardProps {
  onLogout: () => void;
}

const API_BASE = '';

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'tokens' | 'actions' | 'raid' | 'settings' | 'admin' | 'rpc' | 'commands'>('tokens');
  const [tokens, setTokens] = useState<BotSession[]>([]);
  const [adminSessions, setAdminSessions] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [helpBgImage, setHelpBgImage] = useState<string | null>(null);

  // Action Inputs
  const [vcId, setVcId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [dmMessage, setDmMessage] = useState('');
  const [friendId, setFriendId] = useState('');
  
  // Raid Inputs
  const [spamChannelId, setSpamChannelId] = useState('');
  const [spamMessage, setSpamMessage] = useState('');
  const [spamCount, setSpamCount] = useState('10');
  const [guildId, setGuildId] = useState('');
  const [renameText, setRenameText] = useState('');
  
  // Alt Importer
  const [altTokensText, setAltTokensText] = useState('');
  const [importingAlts, setImportingAlts] = useState(false);
  const [altStats, setAltStats] = useState<{count: number, alts: any[]}>({count: 0, alts: []});

  useEffect(() => {
    refreshData();
    fetchAltStats();
    api.getBackground().then(data => {
      if (data.image) setBgImage(data.image);
    });
    api.getHelpBackground().then(data => {
      if (data.image) setHelpBgImage(data.image);
    });
  }, []);

  const fetchAltStats = async () => {
      try {
          const res = await fetch('/api/alts', {
              headers: { 'Authorization': localStorage.getItem('token') || '' }
          });
          if (res.ok) {
              const data = await res.json();
              setAltStats(data);
          }
      } catch (e) {}
  };

  const handleImportAlts = async () => {
      if (!altTokensText.trim()) return;
      setImportingAlts(true);
      const tokens = altTokensText.split('\n').map(t => t.trim()).filter(t => t);
      const mainToken = localStorage.getItem('token');
      
      try {
          const res = await fetch('/api/alts/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mainToken, altTokens: tokens })
          });
          const data = await res.json();
          if (data.success) {
              addLog(`Imported ${data.imported} alts. Failed: ${data.failed}`);
              setAltTokensText('');
              fetchAltStats();
          } else {
              addLog(`Import failed: ${data.error}`);
          }
      } catch (e) {
          addLog(`Import error: ${e}`);
      } finally {
          setImportingAlts(false);
      }
  };

  const refreshData = async () => {
    const data = await api.getTokens();
    setTokens(data);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        await api.uploadTokens(file);
        addLog(`Uploaded tokens from ${file.name}`);
        refreshData();
      } catch (err) {
        addLog(`Error uploading tokens: ${err}`);
      }
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setBgImage(base64);
        await api.setBackground(base64);
        addLog('Background updated');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHelpBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setHelpBgImage(base64);
        await api.setHelpBackground(base64);
        addLog('Help Menu Background updated');
      };
      reader.readAsDataURL(file);
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const handleJoinVC = async () => {
    if (!vcId) return;
    addLog(`Initiating Join VC: ${vcId}`);
    await api.joinVC(vcId);
    refreshData();
  };

  const handleAutoSkull = async () => {
    if (!ownerId) return;
    addLog(`Initiating AutoSkull on: ${ownerId}`);
    await api.autoSkull(ownerId);
    refreshData();
  };

  const handleMassDM = async () => {
    if (!dmMessage) return;
    addLog(`Initiating Mass DM`);
    await api.massDM(dmMessage);
    refreshData();
  };

  const handleFriendRequest = async () => {
    if (!friendId) return;
    addLog(`Sending Friend Requests to: ${friendId}`);
    await api.friendRequest(friendId);
    refreshData();
  };

  const handleSpam = async () => {
    if (!spamChannelId || !spamMessage) return;
    addLog(`Spamming ${spamCount} messages to ${spamChannelId}`);
    await api.spam(spamChannelId, spamMessage, parseInt(spamCount));
  };

  const handleNuke = async () => {
    if (!guildId) return;
    if (!confirm('WARNING: This will delete all channels. Continue?')) return;
    addLog(`Nuking guild ${guildId}`);
    await api.nuke(guildId);
  };

  const handleMassBan = async () => {
    if (!guildId) return;
    if (!confirm('WARNING: This will ban all members. Continue?')) return;
    addLog(`Mass banning in guild ${guildId}`);
    await api.massBan(guildId);
  };

  const handleRename = async () => {
    if (!guildId || !renameText) return;
    addLog(`Renaming channels in ${guildId}`);
    await api.renameChannels(guildId, renameText);
  };

  const handleDeleteRoles = async () => {
    if (!guildId) return;
    addLog(`Deleting roles in ${guildId}`);
    await api.deleteRoles(guildId);
  };

  const handleClearTokens = async () => {
    if (confirm('Are you sure you want to clear all tokens?')) {
      await api.clearTokens();
      refreshData();
      addLog('Cleared all tokens');
    }
  };

  const isAdmin = tokens.length > 0 && tokens[0].username === 'yannaaax';

  useEffect(() => {
    if (activeTab === 'admin' && isAdmin) {
        fetchAdminData();
    }
  }, [activeTab, isAdmin]);

  const fetchAdminData = async () => {
    const res = await fetch(`${API_BASE}/api/admin/all-sessions`);
    const data = await res.json();
    setAdminSessions(data);
  };

  return (
    <div className="min-h-screen text-zinc-100 font-sans relative overflow-hidden bg-zinc-950">
      {/* Dynamic Background */}
      {bgImage && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 blur-sm"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}
      
      <div className="relative z-10 flex h-screen">
        {/* Sidebar */}
        <div className="w-64 border-r border-zinc-800 bg-zinc-900/80 backdrop-blur-md flex flex-col">
          <div className="p-6 border-b border-zinc-800">
            <h1 className="text-xl font-light tracking-tight text-white">
              release
            </h1>
            <p className="text-xs text-zinc-500 mt-1">v2.1.0</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            <SidebarItem 
              active={activeTab === 'tokens'} 
              onClick={() => setActiveTab('tokens')} 
              icon={Users} 
              label="Tokens" 
            />
            <SidebarItem 
              active={activeTab === 'actions'} 
              onClick={() => setActiveTab('actions')} 
              icon={Activity} 
              label="Actions" 
            />
            <SidebarItem 
              active={activeTab === 'raid'} 
              onClick={() => setActiveTab('raid')} 
              icon={Flame} 
              label="Raid" 
            />
            <SidebarItem 
              active={activeTab === 'rpc'} 
              onClick={() => setActiveTab('rpc')} 
              icon={Gamepad2} 
              label="RPC" 
            />
            <SidebarItem 
              active={activeTab === 'commands'} 
              onClick={() => setActiveTab('commands')} 
              icon={Terminal} 
              label="Commands" 
            />
            <SidebarItem 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
              icon={Settings} 
              label="Settings" 
            />
            {isAdmin && (
                <SidebarItem 
                active={activeTab === 'admin'} 
                onClick={() => setActiveTab('admin')} 
                icon={ShieldAlert} 
                label="Admin" 
                />
            )}
          </nav>

          <div className="p-4 border-t border-zinc-800">
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-900/50 backdrop-blur-sm">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              {activeTab === 'tokens' && 'Token Management'}
              {activeTab === 'actions' && 'Actions'}
              {activeTab === 'raid' && 'Raid Operations'}
              {activeTab === 'rpc' && 'Rich Presence'}
              {activeTab === 'settings' && 'Settings'}
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-500">Active Sessions: {tokens.length}</span>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 overflow-y-auto p-8">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'tokens' && (
                <div className="space-y-6">
                  {/* Upload Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-sm font-medium text-zinc-300 mb-4">Import Tokens</h3>
                      <div className="flex items-center gap-4">
                        <label className="flex-1 cursor-pointer group">
                          <div className="h-32 border border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center gap-2 group-hover:border-zinc-500 group-hover:bg-zinc-800/50 transition-all">
                            <Upload className="w-6 h-6 text-zinc-500 group-hover:text-zinc-300" />
                            <span className="text-sm text-zinc-500 group-hover:text-zinc-300">Upload .txt file</span>
                          </div>
                          <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
                        </label>
                      </div>
                      <p className="text-xs text-zinc-600 mt-3">One token per line.</p>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-zinc-300 mb-4">Session Control</h3>
                        <p className="text-sm text-zinc-500 mb-4">
                          Manage loaded tokens. Clearing tokens will disconnect all active sessions immediately.
                        </p>
                      </div>
                      <button 
                        onClick={handleClearTokens}
                        className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear All Tokens
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'actions' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Actions */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* AutoSkull Card */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-base font-medium text-white mb-2 flex items-center gap-2">
                        <Skull className="w-4 h-4 text-zinc-400" />
                        Autoskull
                      </h3>
                      <p className="text-sm text-zinc-500 mb-6">
                        Target a user ID with skull reactions.
                      </p>
                      <div className="flex gap-4">
                        <input 
                          type="text" 
                          placeholder="Target User ID" 
                          value={ownerId}
                          onChange={(e) => setOwnerId(e.target.value)}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-zinc-600 transition-all placeholder:text-zinc-700"
                        />
                        <button 
                          onClick={handleAutoSkull}
                          className="px-6 py-2 bg-zinc-100 hover:bg-white text-zinc-900 font-medium rounded-lg transition-all text-sm"
                        >
                          Execute
                        </button>
                      </div>
                    </div>

                    {/* Join VC Card */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-base font-medium text-white mb-2 flex items-center gap-2">
                        <Mic className="w-4 h-4 text-zinc-400" />
                        Mass VC Join
                      </h3>
                      <p className="text-sm text-zinc-500 mb-6">
                        Connect all tokens to a Voice Channel.
                      </p>
                      <div className="flex gap-4">
                        <input 
                          type="text" 
                          placeholder="Voice Channel ID" 
                          value={vcId}
                          onChange={(e) => setVcId(e.target.value)}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-zinc-600 transition-all placeholder:text-zinc-700"
                        />
                        <button 
                          onClick={handleJoinVC}
                          className="px-6 py-2 bg-zinc-100 hover:bg-white text-zinc-900 font-medium rounded-lg transition-all text-sm"
                        >
                          Connect
                        </button>
                      </div>
                    </div>

                    {/* Alt Importer Section */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-zinc-300 flex items-center gap-2">
                                <Users className="w-5 h-5 text-emerald-500" />
                                Alt Token Importer
                            </h3>
                            <span className="text-xs text-zinc-500 font-mono">
                                Active Alts: {altStats.count}
                            </span>
                        </div>
                        <div className="space-y-4">
                            <textarea
                                value={altTokensText}
                                onChange={(e) => setAltTokensText(e.target.value)}
                                placeholder="Paste alt tokens here (one per line)..."
                                className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-xs font-mono text-zinc-400 focus:outline-none focus:border-emerald-500/50 transition-all resize-none placeholder:text-zinc-700"
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={handleImportAlts}
                                    disabled={importingAlts}
                                    className={`px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-all text-sm flex items-center gap-2 ${importingAlts ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {importingAlts ? 'Importing...' : 'Import Alts'}
                                </button>
                            </div>
                            <p className="text-xs text-zinc-600">
                                Note: These alts are controlled via the Main Token. Use <code className="text-zinc-400">.oll</code> to toggle AutoSkull mode.
                            </p>
                        </div>
                    </div>

                    {/* Extra Commands Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3 text-zinc-300">
                                <MessageSquare className="w-4 h-4" />
                                <span className="font-medium text-sm">Mass DM</span>
                            </div>
                            <input 
                                type="text" 
                                placeholder="Message..." 
                                value={dmMessage}
                                onChange={(e) => setDmMessage(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs mb-3 focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700"
                            />
                            <button onClick={handleMassDM} className="w-full py-2 bg-zinc-800 text-zinc-300 text-xs rounded hover:bg-zinc-700 transition-colors">Send</button>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3 text-zinc-300">
                                <UserPlus className="w-4 h-4" />
                                <span className="font-medium text-sm">Friender</span>
                            </div>
                            <input 
                                type="text" 
                                placeholder="User ID..." 
                                value={friendId}
                                onChange={(e) => setFriendId(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs mb-3 focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700"
                            />
                            <button onClick={handleFriendRequest} className="w-full py-2 bg-zinc-800 text-zinc-300 text-xs rounded hover:bg-zinc-700 transition-colors">Add</button>
                        </div>
                    </div>
                  </div>

                  {/* Live Console */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col h-[600px]">
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Activity className="w-3 h-3" />
                      Logs
                    </h3>
                    <div className="flex-1 overflow-y-auto font-mono text-xs space-y-2 pr-2 custom-scrollbar">
                      {logs.map((log, i) => (
                        <div key={i} className="text-zinc-400 border-l border-zinc-700 pl-2 py-1">
                          {log}
                        </div>
                      ))}
                      {logs.length === 0 && (
                        <div className="text-zinc-700 italic">Waiting for activity...</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'raid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Spam */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-base font-medium text-white mb-4 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-red-500" />
                      Spam
                    </h3>
                    <div className="space-y-4">
                      <input 
                        type="text" 
                        placeholder="Channel ID" 
                        value={spamChannelId}
                        onChange={(e) => setSpamChannelId(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-red-500/50"
                      />
                      <input 
                        type="text" 
                        placeholder="Message" 
                        value={spamMessage}
                        onChange={(e) => setSpamMessage(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-red-500/50"
                      />
                      <div className="flex gap-4">
                        <input 
                          type="number" 
                          placeholder="Count" 
                          value={spamCount}
                          onChange={(e) => setSpamCount(e.target.value)}
                          className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-red-500/50"
                        />
                        <button 
                          onClick={handleSpam}
                          className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-sm font-medium transition-colors"
                        >
                          Start Spam
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Nuke */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-base font-medium text-white mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      Nuke
                    </h3>
                    <div className="space-y-4">
                      <input 
                        type="text" 
                        placeholder="Guild ID" 
                        value={guildId}
                        onChange={(e) => setGuildId(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-orange-500/50"
                      />
                      <button 
                        onClick={handleNuke}
                        className="w-full py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 rounded-lg text-sm font-medium transition-colors"
                      >
                        NUKE SERVER
                      </button>
                    </div>
                  </div>

                  {/* Mass Ban */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-base font-medium text-white mb-4 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                      Mass Ban
                    </h3>
                    <div className="space-y-4">
                      <input 
                        type="text" 
                        placeholder="Guild ID" 
                        value={guildId}
                        onChange={(e) => setGuildId(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-red-600/50"
                      />
                      <button 
                        onClick={handleMassBan}
                        className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 text-red-600 border border-red-600/20 rounded-lg text-sm font-medium transition-colors"
                      >
                        BAN ALL MEMBERS
                      </button>
                    </div>
                  </div>

                  {/* Rename & Delete Roles */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-base font-medium text-white mb-4 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-blue-500" />
                      Utils
                    </h3>
                    <div className="space-y-4">
                      <input 
                        type="text" 
                        placeholder="Guild ID" 
                        value={guildId}
                        onChange={(e) => setGuildId(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                      />
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="New Channel Name" 
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                        />
                        <button 
                          onClick={handleRename}
                          className="px-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 rounded-lg text-sm"
                        >
                          <Type className="w-4 h-4" />
                        </button>
                      </div>
                      <button 
                        onClick={handleDeleteRoles}
                        className="w-full py-2 bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 border border-pink-500/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Eraser className="w-4 h-4" />
                        DELETE ALL ROLES
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="max-w-2xl">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
                    <h3 className="text-lg font-medium mb-6 text-white">Settings</h3>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm text-zinc-400 mb-2">Dashboard Background</label>
                        <div className="flex items-start gap-6">
                          <div className="w-48 h-32 bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden relative">
                            {bgImage ? (
                              <img src={bgImage} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">
                                No Image
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <label className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer transition-colors text-sm text-zinc-300">
                              <Upload className="w-4 h-4" />
                              Upload Image
                              <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                            </label>
                            <p className="text-xs text-zinc-500 mt-3">
                              Supported formats: JPG, PNG, GIF. Max size: 5MB.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-zinc-800">
                        <label className="block text-sm text-zinc-400 mb-2">Help Menu Background</label>
                        <div className="flex items-start gap-6">
                          <div className="w-48 h-32 bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden relative">
                            {helpBgImage ? (
                              <img src={helpBgImage} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">
                                No Image
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <label className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer transition-colors text-sm text-zinc-300">
                              <Upload className="w-4 h-4" />
                              Upload Background
                              <input type="file" accept="image/*" className="hidden" onChange={handleHelpBgUpload} />
                            </label>
                            <p className="text-xs text-zinc-500 mt-3">
                              This image will be used as the background for the .help command.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'commands' && (
                <div className="space-y-6">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-medium text-zinc-300 mb-6 flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-emerald-500" />
                      Command List
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <CommandCategory title="Main" color="text-orange-500" commands={[
                        { name: ".help", desc: "Shows help menu" },
                        { name: ".ping", desc: "Check latency" },
                        { name: ".info", desc: "Selfbot info" },
                        { name: ".prefix", desc: "Change prefix" },
                        { name: ".reload", desc: "Restart process" },
                      ]} />
                      <CommandCategory title="Raid" color="text-red-500" commands={[
                        { name: ".massdm", desc: "Mass DM all friends" },
                        { name: ".spam", desc: "Spam messages" },
                        { name: ".nuke", desc: "Destroy server" },
                        { name: ".rss", desc: "Restore server (Owner Only)" },
                        { name: ".wl", desc: "Whitelist user" },
                        { name: ".unwl", desc: "Unwhitelist user" },
                        { name: ".massban", desc: "Ban all members" },
                        { name: ".adminrole", desc: "Grant admin role" },
                        { name: ".rename", desc: "Rename channels" },
                        { name: ".roledump", desc: "Delete all roles" },
                      ]} />
                      <CommandCategory title="Fun" color="text-purple-500" commands={[
                        { name: ".8ball", desc: "Magic 8ball" },
                        { name: ".mock", desc: "Mock text" },
                        { name: ".reverse", desc: "Reverse text" },
                        { name: ".coinflip", desc: "Flip a coin" },
                        { name: ".dice", desc: "Roll a dice" },
                        { name: ".cat", desc: "Random cat" },
                        { name: ".dog", desc: "Random dog" },
                        { name: ".fox", desc: "Random fox" },
                        { name: ".ascii", desc: "ASCII art" },
                        { name: ".uwu", desc: "UwUify text" },
                        { name: ".nitro", desc: "Fake nitro link" },
                        { name: ".clap", desc: "Clap text" },
                        { name: ".steal", desc: "Steal emoji/sticker" },
                        { name: ".bully", desc: "Mock user (I'm -> You're)" },
                      ]} />
                      <CommandCategory title="Utility" color="text-blue-500" commands={[
                        { name: ".snipe", desc: "Get deleted msg" },
                        { name: ".purge", desc: "Delete own msgs" },
                        { name: ".avatar", desc: "Get user avatar" },
                        { name: ".serverinfo", desc: "Server stats" },
                        { name: ".userinfo", desc: "User stats" },
                        { name: ".ghostping", desc: "Ghost ping" },
                        { name: ".status", desc: "Set status" },
                        { name: ".game", desc: "Set game activity" },
                        { name: ".clearcache", desc: "Clear saved data" },
                      ]} />
                      <CommandCategory title="Etc" color="text-green-500" commands={[
                        { name: ".stream", desc: "Set streaming status" },
                        { name: ".play", desc: "Set playing status" },
                        { name: ".watch", desc: "Set watching status" },
                        { name: ".listen", desc: "Set listening status" },
                        { name: ".mdgc", desc: "Mass Group DM" },
                        { name: ".token", desc: "Get user token info" },
                        { name: ".webhooksend", desc: "Send via webhook" },
                        { name: ".invisible", desc: "Go invisible" },
                        { name: ".cloneserver", desc: "Clone server" },
                        { name: ".stealemoji", desc: "Steal emoji to server" },
                        { name: ".typing", desc: "Fake typing" },
                        { name: ".afk", desc: "AFK mode" },
                        { name: ".ar", desc: "Auto-react" },
                        { name: ".leaveall", desc: "Leave all guilds" },
                        { name: ".closeall", desc: "Close all DMs" },
                        { name: ".unfriendall", desc: "Remove all friends" },
                        { name: ".readall", desc: "Read all messages" },
                        { name: ".poll", desc: "Create poll" },
                        { name: ".calc", desc: "Calculator" },
                        { name: ".weather", desc: "Check weather" },
                        { name: ".translate", desc: "Translate text" },
                        { name: ".shorten", desc: "Shorten URL" },
                        { name: ".define", desc: "Define word" },
                        { name: ".qr", desc: "Generate QR" },
                        { name: ".randomuser", desc: "Ping random user" },
                        { name: ".channelinfo", desc: "Channel info" },
                        { name: ".roleinfo", desc: "Role info" },
                      ]} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'rpc' && <Rpc />}

              {activeTab === 'admin' && isAdmin && (
                <div className="space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-800">
                            <h3 className="text-sm font-medium text-zinc-300">All User Sessions (Admin View)</h3>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-800/50 text-zinc-400">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Username</th>
                                    <th className="px-6 py-3 font-medium">Token</th>
                                    <th className="px-6 py-3 font-medium">Status</th>
                                    <th className="px-6 py-3 font-medium">Login Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {adminSessions.map((s, i) => (
                                    <tr key={i} className="hover:bg-zinc-800/30">
                                        <td className="px-6 py-3 text-zinc-300">{s.username || 'Unknown'}</td>
                                        <td className="px-6 py-3 font-mono text-zinc-500 text-xs">{s.token}</td>
                                        <td className="px-6 py-3"><StatusBadge status={s.status} /></td>
                                        <td className="px-6 py-3 text-zinc-500">{s.loginTime}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
              )}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${
        active 
          ? 'bg-zinc-800 text-white' 
          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: BotSession['status'] }) {
  const styles = {
    offline: 'bg-zinc-800 text-zinc-500',
    online: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    busy: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    error: 'bg-red-500/10 text-red-500 border border-red-500/20',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${styles[status]} uppercase tracking-wide`}>
      {status}
    </span>
  );
}

function CommandCategory({ title, color, commands }: { title: string; color: string; commands: { name: string; desc: string }[] }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50 hover:border-zinc-600 transition-colors">
      <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 ${color}`}>{title}</h4>
      <div className="space-y-2">
        {commands.map((cmd, i) => (
          <div key={i} className="flex justify-between items-start text-xs group">
            <span className="font-mono text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded group-hover:bg-zinc-700 transition-colors">{cmd.name}</span>
            <span className="text-zinc-500 text-right ml-2 group-hover:text-zinc-400 transition-colors">{cmd.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
