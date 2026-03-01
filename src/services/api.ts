import { BotSession } from '../types';

const API_BASE = '';

export const api = {
  login: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) throw new Error('Login failed');
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
    const res = await fetch(`${API_BASE}/api/tokens`);
    return res.json();
  },

  clearTokens: async () => {
    const res = await fetch(`${API_BASE}/api/tokens`, { method: 'DELETE' });
    return res.json();
  },

  setBackground: async (base64Image: string) => {
    const res = await fetch(`${API_BASE}/api/settings/background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
    });
    return res.json();
  },

  getBackground: async () => {
    const res = await fetch(`${API_BASE}/api/settings/background`);
    return res.json();
  },

  setHelpBackground: async (base64Image: string) => {
    const res = await fetch(`${API_BASE}/api/settings/help-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
    });
    return res.json();
  },

  getHelpBackground: async () => {
    const res = await fetch(`${API_BASE}/api/settings/help-background`);
    return res.json();
  },

  joinVC: async (channelId: string) => {
    const res = await fetch(`${API_BASE}/api/actions/join-vc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    });
    return res.json();
  },

  autoSkull: async (ownerId: string) => {
    const res = await fetch(`${API_BASE}/api/actions/autoskull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId }),
    });
    return res.json();
  },

  massDM: async (message: string) => {
    const res = await fetch(`${API_BASE}/api/actions/mass-dm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return res.json();
  },

  statusRotate: async (statusList: string[]) => {
    const res = await fetch(`${API_BASE}/api/actions/status-rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusList }),
    });
    return res.json();
  },

  friendRequest: async (userId: string) => {
    const res = await fetch(`${API_BASE}/api/actions/friend-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return res.json();
  },

  spam: async (channelId: string, message: string, count: number) => {
    const res = await fetch(`${API_BASE}/api/actions/spam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, message, count }),
    });
    return res.json();
  },

  nuke: async (guildId: string) => {
    const res = await fetch(`${API_BASE}/api/actions/nuke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId }),
    });
    return res.json();
  },

  massBan: async (guildId: string) => {
    const res = await fetch(`${API_BASE}/api/actions/mass-ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId }),
    });
    return res.json();
  },

  renameChannels: async (guildId: string, name: string) => {
    const res = await fetch(`${API_BASE}/api/actions/rename-channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, name }),
    });
    return res.json();
  },

  deleteRoles: async (guildId: string) => {
    const res = await fetch(`${API_BASE}/api/actions/delete-roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId }),
    });
    return res.json();
  }
};
