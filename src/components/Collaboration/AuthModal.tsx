import React, { useState } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { UserRole } from '../../types/collaboration';
import { X, Lock, Mail, User as UserIcon, Shield, CheckCircle2, AlertCircle, KeyRound, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'register' | 'profile';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultTab = 'login' }) => {
  const { user, login, register, logout, role, switchDemoUser } = useCollaboration();
  const [tab, setTab] = useState<'login' | 'register' | 'profile'>(defaultTab);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('ANALYST');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const res = await login(email, password);
    setIsLoading(false);
    if (res.success) {
      setSuccess('Logged in successfully');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 700);
    } else {
      setError(res.error || 'Invalid credentials');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const res = await register(name, email, password, regRole);
    setIsLoading(false);
    if (res.success) {
      setSuccess('Account created and logged in');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 700);
    } else {
      setError(res.error || 'Failed to create account');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {user ? 'User Profile & Authentication' : tab === 'login' ? 'Sign In to DataPilot' : 'Create DataPilot Account'}
              </h3>
              <p className="text-xs text-slate-400">
                {user ? `Active Role: ${role}` : 'Access collaborative analytics & workspaces'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher (if unauthenticated or wanting to change tabs) */}
        {!user && (
          <div className="grid grid-cols-2 p-2 bg-slate-950/40 border-b border-slate-800 text-xs">
            <button
              onClick={() => { setTab('login'); setError(null); }}
              className={`py-1.5 rounded-md font-medium transition-all ${
                tab === 'login' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setError(null); }}
              className={`py-1.5 rounded-md font-medium transition-all ${
                tab === 'register' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register
            </button>
          </div>
        )}

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Logged in User Profile Card */}
          {user && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">{user.name}</h4>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    <div className="mt-1 inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                      <span>Role: {role}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fast Demo Role Switcher */}
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                  <span className="flex items-center space-x-1 text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Quick Switch Demo Personas:</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => switchDemoUser('admin')}
                    className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-750 text-xs text-slate-200 border border-slate-700 transition-colors"
                  >
                    Admin / Owner
                  </button>
                  <button
                    onClick={() => switchDemoUser('analyst')}
                    className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-750 text-xs text-slate-200 border border-slate-700 transition-colors"
                  >
                    Analyst
                  </button>
                  <button
                    onClick={() => switchDemoUser('viewer')}
                    className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-750 text-xs text-slate-200 border border-slate-700 transition-colors"
                  >
                    Viewer
                  </button>
                </div>
              </div>

              <button
                onClick={async () => {
                  await logout();
                  onClose();
                }}
                className="w-full py-2 px-4 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}

          {/* Login Form */}
          {!user && tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="analyst@datapilot.local"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>

              {/* Demo accounts helper */}
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Quick Demo Accounts:</p>
                <p>• Admin: <code className="text-emerald-400">admin@datapilot.local</code> / <code className="text-slate-300">Admin123!</code></p>
                <p>• Analyst: <code className="text-emerald-400">analyst@datapilot.local</code> / <code className="text-slate-300">Analyst123!</code></p>
                <p>• Viewer: <code className="text-emerald-400">viewer@datapilot.local</code> / <code className="text-slate-300">Viewer123!</code></p>
              </div>
            </form>
          )}

          {/* Registration Form */}
          {!user && tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="jane@company.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Initial Role</label>
                <select
                  value={regRole}
                  onChange={e => setRegRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="ANALYST">Analyst (Query, Import, Clean, Visualize, Export)</option>
                  <option value="VIEWER">Viewer (Read-only Dashboards, Queries, Reports)</option>
                  <option value="ADMIN">Admin (Full workspace administration)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
