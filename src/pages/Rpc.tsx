import React, { useState } from 'react';
import { Save, Trash2, ExternalLink, Info, Upload } from 'lucide-react';
import { RpcConfig } from '../types';

const API_BASE = '';

export default function Rpc({ configs, setConfigs, selectedIndex, setSelectedIndex, hoursElapsed, setHoursElapsed }: Omit<RpcProps, 'token' | 'setToken'>) {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const config = configs[selectedIndex];
    const setConfig = (newConfig: RpcConfig | ((prev: RpcConfig) => RpcConfig)) => {
        setConfigs(prev => {
            const next = [...prev];
            next[selectedIndex] = typeof newConfig === 'function' ? newConfig(next[selectedIndex]) : newConfig;
            return next;
        });
    };
    const [status, setStatus] = useState('');
    const [uploading, setUploading] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'large' | 'small') => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            const file = e.target.files[0];
            try {
                const formData = new FormData();
                formData.append('image', file);
                
                const res = await fetch(`${API_BASE}/api/rpc/upload-image`, {
                    method: 'POST',
                    headers: {
                        'Authorization': token
                    },
                    body: formData
                });
                
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Upload failed');
                }
                
                const data = await res.json();
                if (data.url) {
                    setConfig(prev => ({
                        ...prev,
                        [type === 'large' ? 'largeImageKey' : 'smallImageKey']: data.url
                    }));
                    setStatus('Image uploaded successfully!');
                } else {
                    setStatus('Upload failed: No URL returned');
                }
            } catch (err) {
                setStatus(`Upload error: ${err}`);
            } finally {
                setUploading(false);
            }
        }
    };

    const handleUpdate = React.useCallback(async () => {
        setStatus('Updating...');
        
        // Calculate timestamp if hours provided
        const finalConfigs = configs.map((c, i) => {
            let finalConfig = { ...c };
            if (i === selectedIndex && hoursElapsed) {
                const hours = parseFloat(hoursElapsed);
                if (!isNaN(hours)) {
                    finalConfig.startTimestamp = (Date.now() - (hours * 3600 * 1000)).toString();
                }
            }
            return finalConfig;
        });

        try {
            const res = await fetch(`${API_BASE}/api/rpc/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ 
                    token, 
                    configs: finalConfigs,
                    selectedIndex
                })
            });
            const data = await res.json();
            if (data.success) {
                setStatus('RPC Updated Successfully!');
            } else {
                setStatus(`Error: ${data.error}`);
            }
        } catch (e) {
            setStatus(`Error: ${e}`);
        }
    }, [configs, selectedIndex, token, hoursElapsed]);

    const handleClear = async () => {
        try {
            await fetch(`${API_BASE}/api/rpc/clear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify({ token })
            });
            setStatus('RPC Cleared');
        } catch (e) {
            setStatus(`Error: ${e}`);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto text-zinc-100">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
                <ExternalLink className="w-8 h-8 text-indigo-500" />
                Rich Presence (RPC)
            </h1>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
                <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
                    {configs.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setSelectedIndex(i);
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedIndex === i ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                        >
                            RPC {i + 1}
                        </button>
                    ))}
                    <button
                        onClick={() => {
                            setConfigs([...configs, { ...configs[selectedIndex] }]);
                            setSelectedIndex(configs.length);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    >
                        + Add
                    </button>
                    {configs.length > 1 && (
                        <button
                            onClick={() => {
                                const next = configs.filter((_, i) => i !== selectedIndex);
                                setConfigs(next);
                                setSelectedIndex(Math.max(0, selectedIndex - 1));
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-900/50 text-red-200 hover:bg-red-800"
                        >
                            Delete
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-zinc-300 border-b border-zinc-800 pb-2">Configuration</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Activity Type</label>
                                <select 
                                    value={config.type || 'PLAYING'}
                                    onChange={e => setConfig({...config, type: e.target.value as any})}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300"
                                >
                                    <option value="PLAYING">Playing</option>
                                    <option value="STREAMING">Streaming</option>
                                    <option value="LISTENING">Listening</option>
                                    <option value="WATCHING">Watching</option>
                                    <option value="COMPETING">Competing</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Title (Name)</label>
                                <input 
                                    type="text" 
                                    value={config.name || ''}
                                    onChange={e => setConfig({...config, name: e.target.value})}
                                    placeholder=""
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        {config.type === 'STREAMING' && (
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Twitch/YouTube URL</label>
                                <input 
                                    type="text" 
                                    value={config.url || ''}
                                    onChange={e => setConfig({...config, url: e.target.value})}
                                    placeholder=""
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Details</label>
                            <input 
                                type="text" 
                                value={config.details || ''}
                                onChange={e => setConfig({...config, details: e.target.value})}
                                placeholder=""
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">State</label>
                            <input 
                                type="text" 
                                value={config.state || ''}
                                onChange={e => setConfig({...config, state: e.target.value})}
                                placeholder=""
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Large Image URL</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={config.largeImageKey || ''}
                                    onChange={e => setConfig({...config, largeImageKey: e.target.value})}
                                    placeholder="https://..."
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                                <label className={`w-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded cursor-pointer transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <Upload size={16} className="text-zinc-400" />
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={(e) => handleImageUpload(e, 'large')}
                                        disabled={uploading}
                                    />
                                </label>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Large Image Text</label>
                            <input 
                                type="text" 
                                value={config.largeImageText || ''}
                                onChange={e => setConfig({...config, largeImageText: e.target.value})}
                                placeholder="Hover text..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Small Image URL</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={config.smallImageKey || ''}
                                    onChange={e => setConfig({...config, smallImageKey: e.target.value})}
                                    placeholder="https://..."
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                                <label className={`w-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded cursor-pointer transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <Upload size={16} className="text-zinc-400" />
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={(e) => handleImageUpload(e, 'small')}
                                        disabled={uploading}
                                    />
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Small Image Text</label>
                            <input 
                                type="text" 
                                value={config.smallImageText || ''}
                                onChange={e => setConfig({...config, smallImageText: e.target.value})}
                                placeholder="Small hover text..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded px-4 py-3">
                            <div>
                                <label className="block text-sm font-medium text-zinc-300">Portrait Mode</label>
                                <p className="text-[10px] text-zinc-500">Enable "Watching" layout with a progress bar (Crunchyroll style).</p>
                            </div>
                            <button 
                                onClick={() => setConfig({...config, portrait: !config.portrait})}
                                className={`w-12 h-6 rounded-full transition-colors relative ${config.portrait ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${config.portrait ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-zinc-800">
                            <label className="block text-xs text-zinc-500 mb-1">Time Elapsed (Hours)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={hoursElapsed}
                                    onChange={e => setHoursElapsed(e.target.value.replace(/[^0-9.]/g, ''))}
                                    placeholder="e.g. 5, 24, 99999..."
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                            </div>
                            <p className="text-[10px] text-zinc-600">
                                Enter the number of hours to show as elapsed time (e.g., "5" will show "05:00 elapsed"). Supports infinite digits.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex gap-4">
                    <button 
                        onClick={handleUpdate}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        Set Presence
                    </button>
                    <button 
                        onClick={handleClear}
                        className="px-6 bg-zinc-800 hover:bg-red-900/50 text-zinc-300 hover:text-red-200 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                        <Trash2 size={18} />
                        Clear
                    </button>
                </div>

                {status && (
                    <div className="mt-4 p-3 bg-zinc-950 border border-zinc-800 rounded text-sm text-center text-zinc-400">
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}

interface RpcProps {
    configs: RpcConfig[];
    setConfigs: React.Dispatch<React.SetStateAction<RpcConfig[]>>;
    selectedIndex: number;
    setSelectedIndex: (index: number) => void;
    hoursElapsed: string;
    setHoursElapsed: (hours: string) => void;
}
