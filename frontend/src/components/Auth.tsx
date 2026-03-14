import React, { useState } from 'react';
import { User } from '../types';
import { User as UserIcon, Lock, ChevronRight, AlertCircle } from 'lucide-react';
import { authenticate } from '../services/userService';
import logo from '../aiestimatic.png';

interface AuthProps {
  onLogin: (user: User) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const user = await authenticate(username, password);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid username or password. Please contact your administrator.');
    }
  };

  const handleReset = () => {
    if (window.confirm('This will clear all local data and reset users to default. Continue?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="mb-6 flex justify-center">
            <img 
              src={logo} 
              alt="ai estimatic Logo" 
              className="h-16 w-auto"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-zinc-500 mt-2">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex flex-col gap-3 text-rose-700 text-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
              <button 
                type="button"
                onClick={handleReset}
                className="text-xs font-bold uppercase tracking-wider text-rose-600 hover:text-rose-800 underline text-left"
              >
                Trouble logging in? Reset App Data
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-zinc-900 text-white py-4 rounded-xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-zinc-200"
          >
            Sign In
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400 mt-8">
          Secure access managed by IES Estimation Protocol
        </p>
      </div>
    </div>
  );
}
