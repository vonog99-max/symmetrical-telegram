import React, { useState } from 'react';
import { Save, Trash2, Upload, ExternalLink } from 'lucide-react';

interface RpcConfig {
    name: string;
    details: string;
    state: string;
    type: 'PLAYING' | 'STREAMING' | 'LISTENING' | 'WATCHING' | 'COMPETING';
    largeImageKey: string;
    largeImageText: string;
    smallImageKey: string;
    smallImageText: string;
    button1Label: string;
    button1Url: string;
    button2Label: string;
    button2Url: string;
    applicationId: string;
    startTimestamp: string;
}

const API_BASE = '';

const getAuthHeader = () => {
  const token = localStorage.getItem('mainToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export default function Rpc() {
    const [token, setToken] = useState('');
    const [config, setConfig] = useState<RpcConfig>({
        name: '',
        details: '',
        state: '',
        type: 'PLAYING',
        largeImageKey: '',
        largeImageText: '',
        smallImageKey: '',
        smallImageText: '',
        button1Label: '',
        button1Url: '',
        button2Label: '',
        button2Url: '',
        applicationId: '',
        startTimestamp: ''
    });
    const [uploadChannelId, setUploadChannelId] = useState('');
    const [status, setStatus] = useState('');

    const handleUpdate = async () => {
        setStatus('Updating...');
        try {
            const res = await fetch(`${API_BASE}/api/rpc/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ 
                    token, 
                    config
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
    };

    const handleClear = async () => {
        try {
            await fetch(`${API_BASE}/api/rpc/clear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                body: JSON.stringify({ token })
            });
            setStatus('RPC Cleared');
        } catch (e) {
            setStatus(`Error: ${e}`);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'large' | 'small') => {
        if (!e.target.files || !e.target.files[0]) return;
        if (!uploadChannelId) {
            alert('Please enter a Channel ID to upload the image to first!');
            return;
        }

        const formData = new FormData();
        formData.append('image', e.target.files[0]);
        formData.append('token', token);
        formData.append('channelId', uploadChannelId);

        setStatus('Uploading image...');
        try {
            const res = await fetch(`${API_BASE}/api/rpc/upload-image`, {
                method: 'POST',
                headers: { ...getAuthHeader() },
                body: formData
            });
            const data = await res.json();
            if (data.url) {
                setConfig(prev => ({
                    ...prev,
                    [target === 'large' ? 'largeImageKey' : 'smallImageKey']: data.url
                }));
                setStatus('Image uploaded and URL set!');
            } else {
                setStatus(`Upload failed: ${data.error}`);
            }
        } catch (e) {
            setStatus(`Upload error: ${e}`);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto text-zinc-100">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
                <ExternalLink className="w-8 h-8 text-indigo-500" />
                Rich Presence (RPC)
            </h1>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
                <div className="mb-6">
                    <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Target Token</label>
                    <input 
                        type="text" 
                        value={token}
                        onChange={e => setToken(e.target.value)}
                        placeholder="Paste your token here..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-zinc-300 border-b border-zinc-800 pb-2">Basic Info</h3>
                        
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Application ID (Optional)</label>
                            <input 
                                type="text" 
                                value={config.applicationId}
                                onChange={e => setConfig({...config, applicationId: e.target.value})}
                                placeholder="123456789..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Name (Title)</label>
                            <input 
                                type="text" 
                                value={config.name}
                                onChange={e => setConfig({...config, name: e.target.value})}
                                placeholder="Visual Studio Code"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Details (Line 1)</label>
                            <input 
                                type="text" 
                                value={config.details}
                                onChange={e => setConfig({...config, details: e.target.value})}
                                placeholder="Editing server.ts"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">State (Line 2)</label>
                            <input 
                                type="text" 
                                value={config.state}
                                onChange={e => setConfig({...config, state: e.target.value})}
                                placeholder="Workspace: My Project"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Activity Type</label>
                            <select 
                                value={config.type}
                                // @ts-ignore
                                onChange={e => setConfig({...config, type: e.target.value})}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300"
                            >
                                <option value="PLAYING">Playing</option>
                                <option value="STREAMING">Streaming</option>
                                <option value="LISTENING">Listening</option>
                                <option value="WATCHING">Watching</option>
                                <option value="COMPETING">Competing</option>
                            </select>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="block text-xs text-zinc-500 mb-1">Start Timestamp (ms)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={config.startTimestamp}
                                    onChange={e => setConfig({...config, startTimestamp: e.target.value})}
                                    placeholder="Timestamp or 'infinite'"
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                                <button
                                    onClick={() => setConfig({...config, startTimestamp: Date.now().toString()})}
                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors"
                                >
                                    Now
                                </button>
                                <button
                                    onClick={() => setConfig({...config, startTimestamp: 'infinite'})}
                                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors"
                                >
                                    Inf
                                </button>
                            </div>
                            <p className="text-[10px] text-zinc-600">
                                Use a large number for custom elapsed time. 'infinite' sets it to a future date.
                            </p>
                        </div>
                    </div>

                    {/* Assets */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-zinc-300 border-b border-zinc-800 pb-2">Assets & Images</h3>
                        
                        <div className="bg-zinc-950/50 p-3 rounded border border-zinc-800 mb-4">
                            <label className="block text-xs text-indigo-400 mb-1 font-bold">IMAGE UPLOADER BYPASS</label>
                            <p className="text-[10px] text-zinc-500 mb-2">
                                To use custom images without the Dev Portal, enter a Channel ID (e.g., a private server channel) to upload the image to. The bot will upload it and use the Discord CDN URL.
                            </p>
                            <input 
                                type="text" 
                                value={uploadChannelId}
                                onChange={e => setUploadChannelId(e.target.value)}
                                placeholder="Channel ID for uploads..."
                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs mb-2"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Large Image URL</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={config.largeImageKey}
                                    onChange={e => setConfig({...config, largeImageKey: e.target.value})}
                                    placeholder="https://..."
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                                <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 p-2 rounded transition-colors">
                                    <Upload size={16} />
                                    <input type="file" className="hidden" onChange={e => handleUpload(e, 'large')} />
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Large Image Text</label>
                            <input 
                                type="text" 
                                value={config.largeImageText}
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
                                    value={config.smallImageKey}
                                    onChange={e => setConfig({...config, smallImageKey: e.target.value})}
                                    placeholder="https://..."
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                                <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 p-2 rounded transition-colors">
                                    <Upload size={16} />
                                    <input type="file" className="hidden" onChange={e => handleUpload(e, 'small')} />
                                </label>
                            </div>
                        </div>
                         <div>
                            <label className="block text-xs text-zinc-500 mb-1">Small Image Text</label>
                            <input 
                                type="text" 
                                value={config.smallImageText}
                                onChange={e => setConfig({...config, smallImageText: e.target.value})}
                                placeholder="Hover text..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-4 md:col-span-2">
                        <h3 className="text-lg font-medium text-zinc-300 border-b border-zinc-800 pb-2">Buttons</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Button 1 Label</label>
                                <input 
                                    type="text" 
                                    value={config.button1Label}
                                    onChange={e => setConfig({...config, button1Label: e.target.value})}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Button 1 URL</label>
                                <input 
                                    type="text" 
                                    value={config.button1Url}
                                    onChange={e => setConfig({...config, button1Url: e.target.value})}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                            </div>
                             <div>
                                <label className="block text-xs text-zinc-500 mb-1">Button 2 Label</label>
                                <input 
                                    type="text" 
                                    value={config.button2Label}
                                    onChange={e => setConfig({...config, button2Label: e.target.value})}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Button 2 URL</label>
                                <input 
                                    type="text" 
                                    value={config.button2Url}
                                    onChange={e => setConfig({...config, button2Url: e.target.value})}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                            </div>
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
