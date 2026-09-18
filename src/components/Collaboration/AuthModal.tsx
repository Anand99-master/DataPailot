import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { UserRole } from '../../types/collaboration';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Shield,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Sparkles,
  UserCog,
  Briefcase,
  Pencil,
  Check,
  Loader2
} from 'lucide-react';
import { DataPilotLogo } from '../common/DataPilotLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'register' | 'profile';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultTab = 'login' }) => {
  const { user, login, register, logout, role, switchDemoUser, updateProfile, activeWorkspace } = useCollaboration();
  const [tab, setTab] = useState<'login' | 'register' | 'profile'>(defaultTab);

  const metaEnv = (import.meta as any).env || {};
  const isDemoMode = metaEnv.VITE_DEMO_MODE !== 'false' && !(metaEnv.PROD && metaEnv.VITE_DEMO_MODE !== 'true');

  // Form states for login/register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('ANALYST');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Profile editing states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Sync profile editing inputs when user changes or modal opens
  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditJobTitle(user.jobTitle || '');
      setEditEmail(user.email || '');
    }
  }, [user, isOpen]);

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Client-side validation
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setError('Full name cannot be empty.');
      return;
    }
    if (trimmedName.length > 100) {
      setError('Full name cannot exceed 100 characters.');
      return;
    }

    const trimmedJobTitle = editJobTitle.trim();
    if (trimmedJobTitle.length > 100) {
      setError('Job title cannot exceed 100 characters.');
      return;
    }

    const trimmedEmail = editEmail.trim();
    if (!trimmedEmail) {
      setError('Email address cannot be empty.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please provide a valid email address.');
      return;
    }
    if (trimmedEmail.length > 150) {
      setError('Email address cannot exceed 150 characters.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await updateProfile({
        name: trimmedName,
        jobTitle: trimmedJobTitle,
        email: trimmedEmail
      });

      if (res.success) {
        setSuccess('Profile updated successfully.');
        setIsEditingProfile(false);
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      } else {
        setError(res.error || 'Failed to update profile.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while updating profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelEditProfile = () => {
    if (user) {
      setEditName(user.name || '');
      setEditJobTitle(user.jobTitle || '');
      setEditEmail(user.email || '');
    }
    setIsEditingProfile(false);
    setError(null);
  };

  const handleSwitchPersona = async (targetPersona: 'admin' | 'analyst' | 'viewer') => {
    setError(null);
    setIsLoading(true);
    try {
      await switchDemoUser(targetPersona);
      const personaName = targetPersona === 'admin' ? 'Admin / Owner' : targetPersona === 'analyst' ? 'Analyst' : 'Viewer';
      setSuccess(`Active persona switched to ${personaName}`);
      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to switch demo persona');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <DataPilotLogo variant="icon" size="sm" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                {user ? (isEditingProfile ? 'Edit Profile' : 'User Profile & Authentication') : tab === 'login' ? 'Sign In to DataPilot' : 'Create DataPilot Account'}
              </h3>
              <p className="text-xs text-slate-400" id="auth-modal-active-role-display">
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
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs" data-testid="auth-error-banner">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs" data-testid="auth-success-banner">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Logged in User Profile */}
          {user && (
            <div className="space-y-4">
              {isEditingProfile ? (
                /* Edit Profile Form */
                <form id="form-edit-profile" onSubmit={handleSaveProfile} className="space-y-3.5">
                  <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-3">
                    <div>
                      <label htmlFor="profile-name-input" className="block text-xs font-medium text-slate-300 mb-1">
                        Full Name <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          id="profile-name-input"
                          data-testid="profile-name-input"
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="e.g. Anand Sharma"
                          disabled={isSavingProfile}
                          maxLength={100}
                          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="profile-jobtitle-input" className="block text-xs font-medium text-slate-300 mb-1">
                        Job Title / Role Title
                      </label>
                      <div className="relative">
                        <Briefcase className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          id="profile-jobtitle-input"
                          data-testid="profile-jobtitle-input"
                          type="text"
                          value={editJobTitle}
                          onChange={(e) => setEditJobTitle(e.target.value)}
                          placeholder="e.g. Data Analyst"
                          disabled={isSavingProfile}
                          maxLength={100}
                          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="profile-email-input" className="block text-xs font-medium text-slate-300 mb-1">
                        Email Address <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        <input
                          id="profile-email-input"
                          data-testid="profile-email-input"
                          type="email"
                          required
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="e.g. anand@datapilot.io"
                          disabled={isSavingProfile}
                          maxLength={150}
                          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900/90 rounded-md border border-slate-800 flex items-start space-x-2 text-[11px] text-slate-400">
                      <Shield className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                      <span>
                        RBAC permissions (<strong className="text-slate-200">OWNER, ANALYST, VIEWER</strong>) are managed via workspace administration and testing personas separately.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      id="btn-save-profile"
                      data-testid="btn-save-profile"
                      type="submit"
                      disabled={isSavingProfile}
                      className="flex-1 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 shadow-sm"
                    >
                      {isSavingProfile ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                    <button
                      id="btn-cancel-profile"
                      data-testid="btn-cancel-profile"
                      type="button"
                      disabled={isSavingProfile}
                      onClick={handleCancelEditProfile}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                /* Profile View Mode */
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3" data-testid="user-profile-card">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border flex-shrink-0 ${
                        role === 'OWNER' || role === 'ADMIN'
                          ? 'bg-purple-600/20 border-purple-500/40 text-purple-400'
                          : role === 'ANALYST'
                          ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                          : 'bg-amber-600/20 border-amber-500/40 text-amber-400'
                      }`}>
                        {(user.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate" data-testid="user-profile-name">
                          {user.name}
                        </h4>
                        {user.jobTitle && (
                          <p className="text-xs text-indigo-300 font-medium truncate" data-testid="user-profile-jobtitle">
                            {user.jobTitle}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 truncate" data-testid="user-profile-email">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    <button
                      id="btn-edit-profile"
                      data-testid="btn-edit-profile"
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      title="Edit Profile"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors flex-shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Edit</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Current Workspace:</span>
                      <span className="text-slate-200 font-medium truncate max-w-[200px]" data-testid="user-profile-workspace">
                        {activeWorkspace?.name || 'Primary Workspace'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium">RBAC Permission Level:</span>
                      <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                        <Shield className="w-3 h-3 text-indigo-400" />
                        <span id="user-profile-role-badge">Role: {role}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fast Demo Role Switcher */}
              {isDemoMode && (
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                  <span className="flex items-center space-x-1.5 text-slate-300 font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Quick Switch Demo Personas:</span>
                  </span>
                  <span className="text-[11px] text-indigo-400 font-mono font-semibold">
                    {role}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    id="btn-persona-admin"
                    data-testid="btn-persona-admin"
                    type="button"
                    disabled={isLoading || isSavingProfile}
                    onClick={() => handleSwitchPersona('admin')}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center justify-center space-y-0.5 ${
                      role === 'OWNER' || role === 'ADMIN'
                        ? 'bg-purple-600/30 text-purple-200 border-purple-500 ring-1 ring-purple-500/50 shadow-xs'
                        : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>Admin / Owner</span>
                    <span className="text-[10px] font-normal opacity-70">Full Access</span>
                  </button>
                  <button
                    id="btn-persona-analyst"
                    data-testid="btn-persona-analyst"
                    type="button"
                    disabled={isLoading || isSavingProfile}
                    onClick={() => handleSwitchPersona('analyst')}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center justify-center space-y-0.5 ${
                      role === 'ANALYST'
                        ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500 ring-1 ring-emerald-500/50 shadow-xs'
                        : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>Analyst</span>
                    <span className="text-[10px] font-normal opacity-70">ETL & Visuals</span>
                  </button>
                  <button
                    id="btn-persona-viewer"
                    data-testid="btn-persona-viewer"
                    type="button"
                    disabled={isLoading || isSavingProfile}
                    onClick={() => handleSwitchPersona('viewer')}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center justify-center space-y-0.5 ${
                      role === 'VIEWER'
                        ? 'bg-amber-600/30 text-amber-200 border-amber-500 ring-1 ring-amber-500/50 shadow-xs'
                        : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>Viewer</span>
                    <span className="text-[10px] font-normal opacity-70">Read Only</span>
                  </button>
                </div>
              </div>
              )}

              <button
                type="button"
                disabled={isSavingProfile || isLoggingOut}
                onClick={async () => {
                  if (isLoggingOut) return;
                  setIsLoggingOut(true);
                  try {
                    await logout();
                    onClose();
                  } catch (err: any) {
                    alert(err?.message || 'Failed to sign out.');
                  } finally {
                    setIsLoggingOut(false);
                  }
                }}
                className="w-full py-2 px-4 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <span>Sign Out</span>
                )}
              </button>
            </div>
          )}

           {/* Login Form */}
          {!user && tab === 'login' && (
            <div className="space-y-4">
              {/* Quick Persona Fast Login */}
              {isDemoMode && (
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-1.5 text-xs text-slate-300 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Instant Demo Sign In:</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    id="btn-login-persona-admin"
                    disabled={isLoading}
                    onClick={() => handleSwitchPersona('admin')}
                    className="px-2 py-1.5 rounded-md bg-slate-800 hover:bg-slate-750 text-xs text-slate-200 border border-slate-700 font-medium transition-colors"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    id="btn-login-persona-analyst"
                    disabled={isLoading}
                    onClick={() => handleSwitchPersona('analyst')}
                    className="px-2 py-1.5 rounded-md bg-slate-800 hover:bg-slate-750 text-xs text-slate-200 border border-slate-700 font-medium transition-colors"
                  >
                    Analyst
                  </button>
                  <button
                    type="button"
                    id="btn-login-persona-viewer"
                    disabled={isLoading}
                    onClick={() => handleSwitchPersona('viewer')}
                    className="px-2 py-1.5 rounded-md bg-slate-800 hover:bg-slate-750 text-xs text-slate-200 border border-slate-700 font-medium transition-colors"
                  >
                    Viewer
                  </button>
                </div>
              </div>
              )}

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
              </form>
            </div>
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
