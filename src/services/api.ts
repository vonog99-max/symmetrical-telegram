import { BotSession } from '../types';

const API_BASE = '';

export const api = {
  login: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Login failed');
    }
    return res.json();
  },

  uploadTokens: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/tokens/upload`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  getTokens: async (): Promise<BotSession[]> => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/tokens`, {
      headers: {
        'Authorization': token
      }
    });
    return res.json();
  },

  clearTokens: async () => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/tokens`, { 
      method: 'DELETE',
      headers: {
        'Authorization': token
      }
    });
    return res.json();
  },

  getSettings: async () => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/settings`, {
      headers: { 'Authorization': token }
    });
    return res.json();
  },

  setMenuMode: async (mode: 'text' | 'image') => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/settings/menu-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ mode }),
    });
    return res.json();
  },

  setMultiFeature: async (enabled: boolean) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/settings/multi-feature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ enabled }),
    });
    return res.json();
  },

  setBackground: async (base64Image: string) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/settings/background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ image: base64Image }),
    });
    return res.json();
  },

  getBackground: async () => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/settings/background`, {
      headers: { 'Authorization': token }
    });
    return res.json();
  },

  setHelpBackground: async (base64Image: string) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/settings/help-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ image: base64Image }),
    });
    return res.json();
  },

  getHelpBackground: async () => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/settings/help-background`, {
      headers: { 'Authorization': token }
    });
    return res.json();
  },

  joinVC: async (token: string, channelId: string) => {
    const res = await fetch(`${API_BASE}/api/actions/join-vc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ channelId }),
    });
    return res.json();
  },

  setMute: async (token: string, mute: boolean) => {
    const res = await fetch(`${API_BASE}/api/actions/vc/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ mute }),
    });
    return res.json();
  },

  setDeafen: async (token: string, deafen: boolean) => {
    const res = await fetch(`${API_BASE}/api/actions/vc/deafen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ deafen }),
    });
    return res.json();
  },

  setVideo: async (token: string, video: boolean) => {
    const res = await fetch(`${API_BASE}/api/actions/vc/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ video }),
    });
    return res.json();
  },

  speakTTS: async (token: string, text: string, voice: string) => {
    const res = await fetch(`${API_BASE}/api/actions/vc/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ text, voice }),
    });
    return res.json();
  },

  testTTS: async (text: string, voice: string) => {
    const res = await fetch(`${API_BASE}/api/actions/vc/tts/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
    return res.json();
  },

  getSoundboardSounds: async () => {
    const res = await fetch(`${API_BASE}/api/actions/vc/soundboard/sounds`);
    return res.json();
  },

  playSoundboard: async (token: string, soundId: string) => {
    const res = await fetch(`${API_BASE}/api/actions/vc/soundboard/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ soundId }),
    });
    return res.json();
  },

  toggleSoundboardSpam: async (token: string, enabled: boolean, soundId: string, interval: number) => {
    const res = await fetch(`${API_BASE}/api/actions/vc/soundboard/spam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ enabled, soundId, interval }),
    });
    return res.json();
  },

  startStream: async (token: string, channelId?: string) => {
    const res = await fetch(`${API_BASE}/api/actions/stream/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ channelId }),
    });
    return res.json();
  },

  stopStream: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/actions/stream/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
    });
    return res.json();
  },

  setStreamImage: async (token: string, image: string) => {
    const res = await fetch(`${API_BASE}/api/actions/stream/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ image }),
    });
    return res.json();
  },

  setStreamSource: async (token: string, type: 'image' | 'video' | 'youtube', url: string) => {
    const res = await fetch(`${API_BASE}/api/actions/stream/source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ type, url }),
    });
    return res.json();
  },

  uploadStreamMedia: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/actions/stream/upload`, {
      method: 'POST',
      headers: { 'Authorization': token },
      body: formData,
    });
    return res.json();
  },

  autoSkull: async (ownerId: string) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/actions/autoskull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ ownerId }),
    });
    return res.json();
  },

  massDM: async (message: string) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/actions/mass-dm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ message }),
    });
    return res.json();
  },

  statusRotate: async (statusList: string[], interval: number = 3) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/actions/status-rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ statusList, interval }),
    });
    return res.json();
  },

  friendRequest: async (userId: string) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/actions/friend-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ userId }),
    });
    return res.json();
  },

  spam: async (channelId: string, message: string, count: number) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/actions/spam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ channelId, message, count }),
    });
    return res.json();
  },

  nuke: async (guildId: string) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/actions/nuke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ guildId }),
    });
    return res.json();
  },

  massBan: async (guildId: string) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/actions/mass-ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ guildId }),
    });
    return res.json();
  },

  renameChannels: async (guildId: string, name: string) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/actions/rename-channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ guildId, name }),
    });
    return res.json();
  },

  uploadRpcImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE}/api/rpc/upload-image`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  deleteRoles: async (guildId: string) => {
    const token = (localStorage.getItem('token') || '').trim().replace(/^["']|["']$/g, '');
    const res = await fetch(`${API_BASE}/api/actions/delete-roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ guildId }),
    });
    return res.json();
  },

  getDiscordCdnUrl: (url: string) => {
    return `${API_BASE}/api/proxy/discord-cdn?url=${encodeURIComponent(url)}`;
  },

  termUser: async (token: string, userId: string) => {
    const res = await fetch(`${API_BASE}/api/actions/revenge/term`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ userId }),
    });
    return res.json();
  },

  untermUser: async (token: string, userId: string) => {
    const res = await fetch(`${API_BASE}/api/actions/revenge/unterm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ userId }),
    });
    return res.json();
  },

  getTermedUsers: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/actions/revenge/termed`, {
      headers: { 'Authorization': token }
    });
    return res.json();
  },

  scrapeTerm: async (token: string, userId: string) => {
    const res = await fetch(`${API_BASE}/api/actions/revenge/scrape-term`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ userId }),
    });
    return res.json();
  }
};
