import React, { useState, useEffect } from 'react';
import { Mic, Play, Square, MicOff, Headphones, Video, Monitor, Youtube, Image as ImageIcon, Film, Music, Volume2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export default function VcTab({ token }: { token: string }) {
  const [vcId, setVcId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsText, setTtsText] = useState('');
  const [isTtsTesting, setIsTtsTesting] = useState(false);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  
  const [sbEnabled, setSbEnabled] = useState(false);
  const [sbSounds, setSbSounds] = useState<any[]>([]);
  const [selectedSbId, setSelectedSbId] = useState('random');
  const [sbInterval, setSbInterval] = useState(2000);
  const [isSbSpamming, setIsSbSpamming] = useState(false);
  
  const [status, setStatus] = useState('');
  const [streamType, setStreamType] = useState<'image' | 'video' | 'youtube'>('image');
  const [streamUrl, setStreamUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchSounds = async () => {
      try {
        const sounds = await api.getSoundboardSounds();
        setSbSounds(sounds);
      } catch (err) {
        console.error('Failed to fetch soundboard sounds:', err);
      }
    };
    fetchSounds();
  }, []);

  const handleJoinVc = async () => {
    try {
      const res = await api.joinVC(token, vcId);
      if (res.error) {
        setStatus(`Error: ${res.error}`);
      } else {
        setStatus(res.message || 'Joined VC successfully!');
      }
    } catch (err) {
      setStatus(`Error joining VC: ${err}`);
    }
  };

  const handleMute = async () => {
    try {
      const newState = !isMuted;
      await api.setMute(token, newState);
      setIsMuted(newState);
      setStatus(newState ? 'Muted' : 'Unmuted');
    } catch (err) {
      setStatus(`Error: ${err}`);
    }
  };

  const handleDeafen = async () => {
    try {
      const newState = !isDeafened;
      await api.setDeafen(token, newState);
      setIsDeafened(newState);
      setStatus(newState ? 'Deafened' : 'Undeafened');
    } catch (err) {
      setStatus(`Error: ${err}`);
    }
  };

  const handleVideo = async () => {
    try {
      const newState = !isVideoOn;
      await api.setVideo(token, newState);
      setIsVideoOn(newState);
      setStatus(newState ? 'Camera On' : 'Camera Off');
    } catch (err) {
      setStatus(`Error: ${err}`);
    }
  };

  const handleTtsSpeak = async () => {
    if (!ttsText) return;
    try {
      setIsTtsSpeaking(true);
      await api.speakTTS(token, ttsText, 'en');
      setStatus('TTS Sent to VC');
    } catch (err) {
      setStatus(`TTS Error: ${err}`);
    } finally {
      setIsTtsSpeaking(false);
    }
  };

  const handleTtsTest = async () => {
    if (!ttsText) return;
    try {
      setIsTtsTesting(true);
      const res = await api.testTTS(ttsText, 'en');
      if (res.audioUrl) {
        const audio = new Audio(res.audioUrl);
        await audio.play().catch(e => {
          console.error("[TTS TEST] Play call failed:", e);
          setStatus(`TTS Play Error: ${e.message}`);
        });
      }
    } catch (err) {
      setStatus(`TTS Test Error: ${err}`);
    } finally {
      setIsTtsTesting(false);
    }
  };

  const handleSbPlay = async () => {
    try {
      const id = selectedSbId === 'random' 
        ? sbSounds[Math.floor(Math.random() * sbSounds.length)]?.id 
        : selectedSbId;
      if (!id) return;
      await api.playSoundboard(token, id);
      setStatus('SoundBoard Played');
    } catch (err) {
      setStatus(`SB Error: ${err}`);
    }
  };

  const handleSbTest = () => {
    const sound = selectedSbId === 'random' 
      ? sbSounds[Math.floor(Math.random() * sbSounds.length)]
      : sbSounds.find(s => s.id === selectedSbId);
    if (sound?.url) {
      // Use proxy to avoid CORS and "no supported source" errors
      const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(sound.url)}`;
      console.log(`[SB TEST] Playing: ${sound.name} via ${proxyUrl}`);
      const audio = new Audio(proxyUrl);
      audio.onplay = () => console.log(`[SB TEST] Playback started for ${sound.name}`);
      audio.onerror = (e) => {
        console.error(`[SB TEST] Playback error for ${sound.name}:`, e);
        setStatus("Failed to load sound source. Try another sound.");
      };
      audio.play().catch(err => {
        console.error(`[SB TEST] Play call failed for ${sound.name}:`, err);
        setStatus(`Playback error: ${err.message}`);
      });
    }
  };

  const handleSbSpamToggle = async () => {
    try {
      const newState = !isSbSpamming;
      await api.toggleSoundboardSpam(token, newState, selectedSbId, sbInterval);
      setIsSbSpamming(newState);
      setStatus(newState ? 'SoundBoard Spam Started' : 'SoundBoard Spam Stopped');
    } catch (err) {
      setStatus(`SB Spam Error: ${err}`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setStatus('Uploading media...');
      const res = await api.uploadStreamMedia(token, file);
      if (res.error) {
        setStatus(`Upload error: ${res.error}`);
      } else {
        setStreamUrl(res.url);
        setStatus(`Media uploaded: ${res.originalName}`);
      }
    } catch (err) {
      setStatus(`Upload failed: ${err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStream = async () => {
    try {
      if (isStreaming) {
        await api.stopStream(token);
        setIsStreaming(false);
        setStatus('Stopped screenshare.');
      } else {
        if (streamUrl) {
            await api.setStreamSource(token, streamType, streamUrl);
        }
        const res = await api.startStream(token, vcId);
        if (res.error) {
          setStatus(`Error: ${res.error}`);
        } else {
          setIsStreaming(true);
          setStatus('Started VC Screenshare (Go Live)!');
        }
      }
    } catch (err) {
      setStatus(`Error streaming: ${err}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Voice Channel Control</h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              value={vcId}
              onChange={(e) => setVcId(e.target.value)}
              placeholder="Voice Channel ID"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
            />
            <button
              onClick={handleJoinVc}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-all flex items-center gap-2"
            >
              <Mic className="w-4 h-4" />
              Join VC
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleMute}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${isMuted ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              <span className="text-[10px] uppercase font-bold tracking-wider">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button
              onClick={handleDeafen}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${isDeafened ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Headphones className="w-5 h-5" />
              <span className="text-[10px] uppercase font-bold tracking-wider">{isDeafened ? 'Undeafen' : 'Deafen'}</span>
            </button>
            <button
              onClick={handleVideo}
              className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${isVideoOn ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Video className="w-5 h-5" />
              <span className="text-[10px] uppercase font-bold tracking-wider">{isVideoOn ? 'Stop Cam' : 'Camera'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-300">Text-to-Speech (TTS)</h3>
          <button 
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${ttsEnabled ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}
          >
            {ttsEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {ttsEnabled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Message</label>
                <textarea
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder="Type something for the bot to say..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 min-h-[80px] resize-none"
                />
              </div>
              <div className="w-32 pb-1">
                <button 
                  onClick={handleTtsTest}
                  disabled={isTtsTesting || !ttsText}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isTtsTesting ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-zinc-300"></div> : <Play className="w-3 h-3" />}
                  Test
                </button>
              </div>
            </div>

            <button
              onClick={handleTtsSpeak}
              disabled={isTtsSpeaking || !ttsText}
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-3 transition-all text-sm font-medium disabled:opacity-50"
            >
              {isTtsSpeaking ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Mic className="w-4 h-4" />}
              Speak in VC
            </button>
          </div>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-300">SoundBoard</h3>
          <button 
            onClick={() => setSbEnabled(!sbEnabled)}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${sbEnabled ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}
          >
            {sbEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {sbEnabled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Select Sound</label>
                <select 
                  value={selectedSbId}
                  onChange={(e) => setSelectedSbId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
                >
                  <option value="random">Random Sound</option>
                  {sbSounds.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.name} {s.guildName ? `(${s.guildName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button 
                  onClick={handleSbTest}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Volume2 className="w-3 h-3" />
                  Test
                </button>
                <button 
                  onClick={handleSbPlay}
                  className="flex-1 py-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-3 h-3" />
                  Play
                </button>
              </div>
            </div>

            <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-zinc-300">Spam Mode</p>
                  <p className="text-[10px] text-zinc-500">Repeatedly play sound in VC</p>
                </div>
                <button
                  onClick={handleSbSpamToggle}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isSbSpamming ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isSbSpamming ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Interval (ms)</label>
                  <span className="text-[10px] font-mono text-indigo-400">{sbInterval}ms</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="100"
                  value={sbInterval}
                  onChange={(e) => setSbInterval(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-300">Screenshare (Go Live)</h3>
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${isStreaming ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'}`}>
            {isStreaming ? 'Live' : 'Offline'}
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <button 
              onClick={() => setStreamType('image')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${streamType === 'image' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 border border-transparent hover:bg-zinc-700'}`}
            >
              <ImageIcon className="w-3 h-3" />
              Image
            </button>
            <button 
              onClick={() => setStreamType('video')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${streamType === 'video' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 border border-transparent hover:bg-zinc-700'}`}
            >
              <Film className="w-3 h-3" />
              Video
            </button>
            <button 
              onClick={() => { setStreamType('youtube'); setStreamUrl(''); }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${streamType === 'youtube' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500 border border-transparent hover:bg-zinc-700'}`}
            >
              <Youtube className="w-3 h-3" />
              YouTube
            </button>
          </div>

          {streamType === 'youtube' ? (
            <input
              type="text"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="YouTube URL..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
            />
          ) : (
            <div className="space-y-2">
              <label className="block w-full cursor-pointer">
                <div className="w-full bg-zinc-950 border border-zinc-800 border-dashed rounded-lg px-4 py-4 text-sm text-zinc-500 hover:border-zinc-600 transition-all flex flex-col items-center gap-2">
                  {isUploading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                  ) : (
                    <>
                      <Monitor className="w-5 h-5 opacity-50" />
                      <span>{streamUrl ? 'Change File' : `Upload ${streamType === 'image' ? 'Image' : 'Video'}`}</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept={streamType === 'image' ? 'image/*' : 'video/*'}
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </label>
              {streamUrl && (
                <p className="text-[10px] text-emerald-500 font-medium truncate px-1">
                  Ready: {streamUrl.split('/').pop()}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-zinc-500 leading-relaxed">
            This will start a real Discord Screenshare session in the voice channel. 
            Others will see the "Live" badge next to your name.
          </p>
          
          <button
            onClick={handleStream}
            className={`w-full py-3 ${isStreaming ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'} border rounded-lg flex items-center justify-center gap-3 transition-all text-sm font-medium`}
          >
            {isStreaming ? <Square className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            {isStreaming ? 'Stop Screenshare' : 'Go Live (Screenshare)'}
          </button>
        </div>
        {status && <p className="text-xs text-zinc-500 mt-3 italic">{status}</p>}
      </div>
    </div>
  );
}
