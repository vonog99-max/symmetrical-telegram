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
      
      // Automatically use the extracted token
      setToken(data.token);
      setActiveTab('login');
      setError('Token extracted! Now enter it in the Login tab.');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl"
      >
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-light tracking-tight mb-2">release</h1>
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
        </div>

        {activeTab === 'login' ? (
          <form onSubmit={handleTokenSubmit} className="space-y-6">
            <div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-700"
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
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-700 mb-4"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all placeholder:text-zinc-700"
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
