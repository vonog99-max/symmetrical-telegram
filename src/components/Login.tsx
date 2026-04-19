import React, { useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../services/api';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'login' | 'email' | 'getToken'>('login');
  const [discordUser, setDiscordUser] = useState<any>(() => {
    const saved = localStorage.getItem('discord_user');
    return saved ? JSON.parse(saved) : null;
  });

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.user) {
        const user = event.data.user;
        setDiscordUser(user);
        localStorage.setItem('discord_user', JSON.stringify(user));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleDiscordLogin = async () => {
    try {
      const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/discord/callback`);
      const res = await fetch(`/api/auth/discord/url?redirect_uri=${redirectUri}`);
      const { url } = await res.json();
      window.open(url, 'discord_auth', 'width=600,height=700');
    } catch (e) {
      setError('Failed to get Discord login URL');
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await api.login(token);
      localStorage.setItem('token', res.session.token);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid token or connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/extract-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract token');
      
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(data.token);
      } catch (err) {
        console.error('Failed to copy token:', err);
      }

      // Automatically login
      const loginRes = await api.login(data.token);
      localStorage.setItem('token', loginRes.session.token);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center text-zinc-100 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 bg-black/40 border border-white/10 rounded-2xl shadow-2xl"
      >
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-light tracking-tight mb-2">Yuri</h1>
          {discordUser ? (
            <div className="flex justify-center space-x-4 mt-6">
              <button 
                onClick={() => setActiveTab('login')}
                className={`text-sm pb-1 border-b-2 transition-colors ${activeTab === 'login' ? 'border-zinc-100 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setActiveTab('email')}
                className={`text-sm pb-1 border-b-2 transition-colors ${activeTab === 'email' ? 'border-zinc-100 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
              >
                Email Login
              </button>
              <button 
                onClick={() => setActiveTab('getToken')}
                className={`text-sm pb-1 border-b-2 transition-colors ${activeTab === 'getToken' ? 'border-zinc-100 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
              >
                Get Token
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 mt-4">Please authorize your Discord account to continue.</p>
          )}
        </div>

        {!discordUser ? (
          <div className="space-y-6">
            <button
              onClick={handleDiscordLogin}
              className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              Login with Discord
            </button>
            {error && (
              <div className="text-red-400 text-xs text-center">{error}</div>
            )}
          </div>
        ) : activeTab === 'login' ? (
          <form onSubmit={handleTokenSubmit} className="space-y-6">
            <div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token"
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-zinc-600"
                required
              />
            </div>

            {error && (
              <div className="text-red-400 text-xs text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-zinc-100 text-zinc-900 font-medium rounded-lg hover:bg-white transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Enter Dashboard'}
            </button>
          </form>
        ) : activeTab === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-zinc-600 mb-4"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all placeholder:text-zinc-600"
                required
              />
            </div>

            {error && (
              <div className="text-red-400 text-xs text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-zinc-100 text-zinc-900 font-medium rounded-lg hover:bg-white transition-colors disabled:opacity-50"
            >
              {loading ? 'Extracting...' : 'Extract Token'}
            </button>
          </form>
        ) : (
          <div className="space-y-4 text-sm text-zinc-400">
            <p>To get your Discord token:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Open Discord in your browser.</li>
              <li>Press <code className="bg-zinc-800 px-1 py-0.5 rounded">Ctrl + Shift + I</code> (or <code className="bg-zinc-800 px-1 py-0.5 rounded">Cmd + Option + I</code> on Mac) to open Developer Tools.</li>
              <li>Go to the <strong className="text-zinc-200">Network</strong> tab.</li>
              <li>Refresh the page (<code className="bg-zinc-800 px-1 py-0.5 rounded">F5</code>).</li>
              <li>Filter by <code className="bg-zinc-800 px-1 py-0.5 rounded">/api/v9/users/@me</code>.</li>
              <li>Click on the request and go to <strong className="text-zinc-200">Headers</strong>.</li>
              <li>Look for <code className="bg-zinc-800 px-1 py-0.5 rounded">authorization</code> in the request headers.</li>
              <li>Copy that value.</li>
            </ol>
          </div>
        )}
      </motion.div>
    </div>
  );
}
