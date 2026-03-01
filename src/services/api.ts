import { BotSession } from '../types';

const isNetlify = typeof window !== 'undefined' && window.location.hostname.includes('netlify.app');

let mockTokens: BotSession[] = [];

const mockSession = (token: string): BotSession => ({
  id: Math.random().toString(36).substring(7),
  token,
  username: 'yannaaax',
  discriminator: '0000',
  status: 'online',
  logs: ['Logged in via Netlify Mock Mode (No Backend)']
});

export const api = {
  login: async (token: string) => {
    if (isNetlify) {
      mockTokens = [mockSession(token)];
      return { success: true, session: mockTokens[0] };
    }
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  uploadTokens: async (file: File) => {
    if (isNetlify) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const tokens = content.split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0);
          mockTokens = [...mockTokens, ...tokens.map(mockSession)];
          resolve({ message: `Processed ${tokens.length} tokens`, results: [] });
        };
        reader.readAsText(file);
      });
    }
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/tokens/upload', {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  getTokens: async (): Promise<BotSession[]> => {
    if (isNetlify) return mockTokens;
    const res = await fetch('/api/tokens');
    return res.json();
  },

  clearTokens: async () => {
    if (isNetlify) {
      mockTokens = [];
      return { message: 'All tokens cleared' };
    }
    const res = await fetch('/api/tokens', { method: 'DELETE' });
    return res.json();
  },

  setBackground: async (base64Image: string) => {
    if (isNetlify) return { success: true };
    const res = await fetch('/api/settings/background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
    });
    return res.json();
  },

  getBackground: async () => {
    if (isNetlify) return { image: null };
    const res = await fetch('/api/settings/background');
    return res.json();
  },

  setHelpBackground: async (base64Image: string) => {
    if (isNetlify) return { success: true };
    const res = await fetch('/api/settings/help-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
    });
    return res.json();
  },

  getHelpBackground: async () => {
    if (isNetlify) return { image: null };
    const res = await fetch('/api/settings/help-background');
    return res.json();
  },

  joinVC: async (channelId: string) => {
    if (isNetlify) return { message: 'Mock join VC' };
    const res = await fetch('/api/actions/join-vc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    });
    return res.json();
  },

  autoSkull: async (ownerId: string) => {
    if (isNetlify) return { message: 'Mock autoskull' };
    const res = await fetch('/api/actions/autoskull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId }),
    });
    return res.json();
  },

  massDM: async (message: string) => {
    if (isNetlify) return { message: 'Mock mass DM' };
    const res = await fetch('/api/actions/mass-dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return res.json();
  },

  statusRotate: async (statusList: string[]) => {
    if (isNetlify) return { message: 'Mock status rotate' };
    const res = await fetch('/api/actions/status-rotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusList }),
    });
    return res.json();
  },

  friendRequest: async (userId: string) => {
    if (isNetlify) return { message: 'Mock friend request' };
    const res = await fetch('/api/actions/friend-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return res.json();
  },

  spam: async (channelId: string, message: string, count: number) => {
    if (isNetlify) return { message: 'Mock spam' };
    const res = await fetch('/api/actions/spam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, message, count }),
    });
    return res.json();
  },

  nuke: async (guildId: string) => {
    if (isNetlify) return { message: 'Mock nuke' };
    const res = await fetch('/api/actions/nuke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId }),
    });
    return res.json();
  },

  massBan: async (guildId: string) => {
    if (isNetlify) return { message: 'Mock mass ban' };
    const res = await fetch('/api/actions/mass-ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId }),
    });
    return res.json();
  },

  renameChannels: async (guildId: string, name: string) => {
    if (isNetlify) return { message: 'Mock rename channels' };
    const res = await fetch('/api/actions/rename-channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, name }),
    });
    return res.json();
  },

  deleteRoles: async (guildId: string) => {
    if (isNetlify) return { message: 'Mock delete roles' };
    const res = await fetch('/api/actions/delete-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId }),
    });
    return res.json();
  }
};
