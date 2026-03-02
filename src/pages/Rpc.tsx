import React, { useState } from 'react';
import { Save, Trash2, Upload, ExternalLink, Info } from 'lucide-react';

interface RpcConfig {
    name: string;
    largeImageKey: string;
    largeImageText: string;
    applicationId: string;
    startTimestamp: string;
}

const API_BASE = '';

export default function Rpc() {
    const [token, setToken] = useState('');
    const [config, setConfig] = useState<RpcConfig>({
        name: '',
        largeImageKey: '',
        largeImageText: '',
        applicationId: '',
        startTimestamp: ''
    });
    const [status, setStatus] = useState('');
    const [hoursElapsed, setHoursElapsed] = useState('');
    const [uploadChannelId, setUploadChannelId] = useState('');
    const [showFallback, setShowFallback] = useState(false);

    const handleUpdate = async () => {
        setStatus('Updating...');
        
        // Calculate timestamp if hours provided
        let finalConfig = { ...config };
        if (hoursElapsed) {
            const hours = parseFloat(hoursElapsed);
            if (!isNaN(hours)) {
                // Set start timestamp to N hours ago
                finalConfig.startTimestamp = (Date.now() - (hours * 3600 * 1000)).toString();
            }
        }

        try {
            const res = await fetch(`${API_BASE}/api/rpc/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    token, 
                    config: finalConfig
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            setStatus('RPC Cleared');
        } catch (e) {
            setStatus(`Error: ${e}`);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;

        const formData = new FormData();
        formData.append('image', e.target.files[0]);
        formData.append('token', token);
        if (uploadChannelId) formData.append('channelId', uploadChannelId);

        setStatus('Uploading image...');
        try {
            const res = await fetch(`${API_BASE}/api/rpc/upload-image`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.url) {
                setConfig(prev => ({
                    ...prev,
                    largeImageKey: data.url
                }));
                setStatus('Image uploaded and URL set!');
                setShowFallback(false);
            } else {
                setStatus(`Upload failed: ${data.error}`);
                if (data.error && (data.error.includes('Channel ID') || data.error.includes('DMs restricted'))) {
                    setShowFallback(true);
                }
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

                <div className="grid grid-cols-1 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-zinc-300 border-b border-zinc-800 pb-2">Configuration</h3>
                        
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Application ID (Optional)</label>
                            <input 
                                type="text" 
                                value={config.applicationId}
                                onChange={e => setConfig({...config, applicationId: e.target.value})}
                                placeholder="123456789..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                            <div className="mt-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded text-xs text-indigo-300 flex gap-2 items-start">
                                <Info size={14} className="mt-0.5 shrink-0" />
                                <div>
                                    <strong>Tutorial:</strong> To get an Application ID:
                                    <ol className="list-decimal ml-4 mt-1 space-y-1 text-indigo-200/80">
                                        <li>Go to <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="underline hover:text-white">Discord Developer Portal</a>.</li>
                                        <li>Click "New Application" and give it a name.</li>
                                        <li>Copy the "Application ID" from the General Information page.</li>
                                        <li>Paste it here to use that app's name and assets.</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Title (Name)</label>
                            <input 
                                type="text" 
                                value={config.name}
                                onChange={e => setConfig({...config, name: e.target.value})}
                                placeholder="Visual Studio Code"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
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
                                <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 p-2 rounded transition-colors flex items-center gap-2 px-3">
                                    <Upload size={16} />
                                    <span className="text-xs">Upload</span>
                                    <input type="file" className="hidden" onChange={handleUpload} />
                                </label>
                            </div>
                            <div className="flex flex-col gap-2 mt-1">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] text-zinc-500">
                                        Auto-uploads to Discord.
                                    </p>
                                    <button 
                                        onClick={() => setShowFallback(!showFallback)}
                                        className="text-[10px] text-zinc-600 hover:text-zinc-400 underline cursor-pointer"
                                    >
                                        {showFallback ? 'Hide Options' : 'Upload Issues?'}
                                    </button>
                                </div>
                                
                                {showFallback && (
                                    <div className="p-3 bg-zinc-900/80 border border-zinc-700/50 rounded-lg animate-in fade-in slide-in-from-top-2">
                                        <label className="block mb-1.5 text-xs text-zinc-400 font-medium">Fallback Channel ID</label>
                                        <input 
                                            type="text" 
                                            value={uploadChannelId}
                                            onChange={e => setUploadChannelId(e.target.value)}
                                            placeholder="e.g. 123456789012345678"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 focus:border-indigo-500/50 focus:outline-none"
                                        />
                                        <p className="mt-2 text-zinc-500 text-[10px] leading-relaxed">
                                            <span className="text-red-400 font-medium">Required if DMs are closed or using a Bot Token.</span>
                                            <br/>
                                            Copy the ID of any text channel you can upload files to (e.g., a private server).
                                        </p>
                                    </div>
                                )}
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

                        <div className="space-y-2">
                            <label className="block text-xs text-zinc-500 mb-1">Time Elapsed (Hours)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="number"
                                    value={hoursElapsed}
                                    onChange={e => setHoursElapsed(e.target.value)}
                                    placeholder="e.g. 5, 24, 100..."
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                            </div>
                            <p className="text-[10px] text-zinc-600">
                                Enter the number of hours to show as elapsed time (e.g., "5" will show "05:00 elapsed").
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
