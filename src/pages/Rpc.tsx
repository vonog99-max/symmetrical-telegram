import React, { useState } from 'react';
import { Save, Trash2, ExternalLink, Info, Upload } from 'lucide-react';

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
    
    // Rotation state
    const [rotationMessages, setRotationMessages] = useState<string[]>(['', '', '']);
    const [rotationInterval, setRotationInterval] = useState(3);

    const [uploading, setUploading] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'large' | 'small') => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            const file = e.target.files[0];
            try {
                // @ts-ignore
                const data = await api.uploadRpcImage(file);
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
                    config: finalConfig,
                    rotation: {
                        enabled: rotationMessages.some(m => m.trim() !== ''),
                        messages: rotationMessages.filter(m => m.trim() !== ''),
                        interval: rotationInterval
                    }
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

    const addRotationMessage = () => {
        setRotationMessages([...rotationMessages, '']);
    };

    const updateRotationMessage = (index: number, value: string) => {
        const newMessages = [...rotationMessages];
        newMessages[index] = value;
        setRotationMessages(newMessages);
    };

    const removeRotationMessage = (index: number) => {
        const newMessages = rotationMessages.filter((_, i) => i !== index);
        setRotationMessages(newMessages);
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
                            <label className="block text-xs text-zinc-500 mb-1">Details</label>
                            <input 
                                type="text" 
                                value={config.details}
                                onChange={e => setConfig({...config, details: e.target.value})}
                                placeholder="Coding..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">State</label>
                            <input 
                                type="text" 
                                value={config.state}
                                onChange={e => setConfig({...config, state: e.target.value})}
                                placeholder="In server.ts"
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
                                value={config.smallImageText}
                                onChange={e => setConfig({...config, smallImageText: e.target.value})}
                                placeholder="Small hover text..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="space-y-4 pt-4 border-t border-zinc-800">
                            <h3 className="text-sm font-medium text-zinc-300">Status Rotation</h3>
                            <p className="text-xs text-zinc-500">
                                Automatically rotate the status message (state). Leave empty to disable.
                            </p>
                            
                            <div className="space-y-2">
                                {rotationMessages.map((msg, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={msg}
                                            onChange={e => updateRotationMessage(idx, e.target.value)}
                                            placeholder={`Status Message ${idx + 1}`}
                                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                        />
                                        {rotationMessages.length > 1 && (
                                            <button 
                                                onClick={() => removeRotationMessage(idx)}
                                                className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button 
                                    onClick={addRotationMessage}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                >
                                    + Add another message
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Rotation Interval (Seconds)</label>
                                <input 
                                    type="number" 
                                    value={rotationInterval}
                                    onChange={e => setRotationInterval(parseInt(e.target.value) || 3)}
                                    min={1}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
                                />
                            </div>
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
