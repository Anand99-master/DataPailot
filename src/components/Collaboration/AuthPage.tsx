import React, { useState, useId } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { UserRole } from '../../types/collaboration';
import {
  Lock,
  Mail,
  User as UserIcon,
  Briefcase,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Database,
  Cpu,
  Layers,
  Activity,
  ArrowRight,
  ArrowLeft,
  Check
} from 'lucide-react';
import { DataPilotLogo } from '../common/DataPilotLogo';

interface PasswordStrength {
  score: number; // 0 to 3
  label: 'Weak' | 'Fair' | 'Strong' | '';
  hasMinLength: boolean;
  hasCaseVariety: boolean;
  hasNumberOrSpecial: boolean;
}

function evaluatePassword(pwd: string): PasswordStrength {
  if (!pwd) {
    return {
      score: 0,
      label: '',
      hasMinLength: false,
      hasCaseVariety: false,
      hasNumberOrSpecial: false
    };
  }

  const hasMinLength = pwd.length >= 6;
  const hasCaseVariety = /[a-z]/.test(pwd) && /[A-Z]/.test(pwd);
  const hasNumberOrSpecial = /[0-9]/.test(pwd) || /[^a-zA-Z0-9]/.test(pwd);

  let score = 0;
  if (hasMinLength) score += 1;
  if (hasCaseVariety) score += 1;
  if (hasNumberOrSpecial) score += 1;

  let label: 'Weak' | 'Fair' | 'Strong' = 'Weak';
  if (score >= 3 && pwd.length >= 8) {
    label = 'Strong';
  } else if (score >= 2) {
    label = 'Fair';
  } else {
    label = 'Weak';
  }

  return {
    score,
    label,
    hasMinLength,
    hasCaseVariety,
    hasNumberOrSpecial
  };
}

export const AuthPage: React.FC = () => {
  const { login, register, verifyEmail, resendVerification, switchDemoUser } = useCollaboration();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset' | 'verify'>('login');

  // Form input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  // Forgot password & Reset states
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  // Email verification states
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devVerificationToken, setDevVerificationToken] = useState<string | null>(null);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Field touched states for inline validation
  const [touched, setTouched] = useState<{
    email?: boolean;
    password?: boolean;
    confirmPassword?: boolean;
    fullName?: boolean;
    forgotEmail?: boolean;
    newPassword?: boolean;
    confirmNewPassword?: boolean;
  }>({});

  // Status states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Unique accessible IDs
  const loginEmailId = useId();
  const loginPasswordId = useId();
  const signupNameId = useId();
  const signupEmailId = useId();
  const signupJobId = useId();
  const signupPasswordId = useId();
  const signupConfirmId = useId();
  const forgotEmailId = useId();
  const resetTokenId = useId();
  const resetPasswordId = useId();
  const resetConfirmId = useId();
  const verifyTokenId = useId();

  const metaEnv = (import.meta as any).env || {};
  const isDemoMode = metaEnv.VITE_DEMO_MODE !== 'false' && !(metaEnv.PROD && metaEnv.VITE_DEMO_MODE !== 'true');

  // Cooldown countdown timer for resend verification
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Check URL parameters on mount for direct reset token or verification links
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const reset = params.get('reset_token') || (params.get('type') === 'reset' ? params.get('token') : null);
      const verify = params.get('verify_token') || params.get('verification_token') || (params.get('type') === 'verify' ? params.get('token') : null) || (params.get('token') && !reset ? params.get('token') : null);
      const verified = params.get('verified') === 'true';

      if (verified) {
        setMode('verify');
        setVerificationStatus('success');
        setSuccess('Your email address has been verified successfully. Welcome to DataPilot!');
      } else if (verify) {
        setVerificationToken(verify);
        setMode('verify');
        // Auto trigger verification if token is present from link
        setTimeout(() => {
          handleVerifyEmailDirect(verify);
        }, 150);
      } else if (reset) {
        setResetToken(reset);
        setMode('reset');
      }
    } catch {}
  }, []);

  // Password evaluation
  const passwordStrength = evaluatePassword(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // New password evaluation for reset mode
  const newPasswordStrength = evaluatePassword(newPassword);
  const newPasswordsMatch = confirmNewPassword.length > 0 && newPassword === confirmNewPassword;
  const newPasswordsMismatch = confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;

  // Validation helpers
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email.trim());

  const handleBlur = (field: 'email' | 'password' | 'confirmPassword' | 'fullName' | 'forgotEmail' | 'newPassword' | 'confirmNewPassword') => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSwitchMode = (newMode: 'login' | 'signup' | 'forgot' | 'reset' | 'verify') => {
    if (newMode === mode) return;
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setDevToken(null);
    setResendSuccess(null);
    setTouched({});
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    if (newMode === 'forgot' && email) {
      setForgotEmail(email);
    }
    if (newMode === 'verify' && email) {
      setVerificationEmail(email);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both email and password.');
      setTouched({ email: true, password: true });
      return;
    }

    if (!isEmailValid) {
      setError('Please enter a valid email address.');
      setTouched(prev => ({ ...prev, email: true }));
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(trimmedEmail, password);
      if (res.success) {
        setSuccess('Authenticated successfully. Loading workspace...');
      } else {
        // Generic authentication error per requirement
        setError(res.error || 'Invalid email or password.');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    setTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true
    });

    if (!trimmedName || trimmedName.length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!trimmedEmail) {
      setError('Email address is required.');
      return;
    }
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register(trimmedName, trimmedEmail, password, 'ANALYST');
      if (res.success) {
        setVerificationEmail(trimmedEmail);
        if (res.devVerificationToken) {
          setDevVerificationToken(res.devVerificationToken);
          setVerificationToken(res.devVerificationToken);
        }
        setMode('verify');
        setVerificationStatus('idle');
        setSuccess('Account created! A verification link has been sent to your email.');
      } else {
        setError(res.error || 'Unable to create account. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmailDirect = async (tokenToUse: string) => {
    if (!tokenToUse.trim()) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setVerificationStatus('verifying');
    try {
      const res = await verifyEmail(tokenToUse.trim());
      if (res.success) {
        setVerificationStatus('success');
        setSuccess(res.message || 'Your email address has been verified successfully!');
      } else {
        setVerificationStatus('error');
        setError(res.error || 'Verification link is invalid or has expired.');
      }
    } catch (err: any) {
      setVerificationStatus('error');
      setError(err?.message || 'Failed to verify email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationToken.trim()) {
      setError('Please enter your verification token.');
      return;
    }
    await handleVerifyEmailDirect(verificationToken);
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    setResendSuccess(null);
    try {
      const targetEmail = verificationEmail.trim() || email.trim() || undefined;
      const res = await resendVerification(targetEmail);
      if (res.success) {
        setResendSuccess(res.message || 'Verification email sent');
        if (res.devVerificationToken) {
          setDevVerificationToken(res.devVerificationToken);
          setVerificationToken(res.devVerificationToken);
        }
        setResendCooldown(60);
      } else {
        const errorMsg = res.error?.includes('wait')
          ? 'Please wait before requesting another email'
          : (res.error || 'Unable to send verification email');
        setError(errorMsg);
      }
    } catch (err: any) {
      const errText = err?.message || '';
      const errorMsg = errText.includes('wait')
        ? 'Please wait before requesting another email'
        : 'Unable to send verification email';
      setError(errorMsg);
    } finally {
      setIsResending(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setDevToken(null);

    const trimmedEmail = forgotEmail.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      setTouched(prev => ({ ...prev, forgotEmail: true }));
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      setTouched(prev => ({ ...prev, forgotEmail: true }));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail })
      });
      const data = await response.json();

      if (data.success) {
        setSuccess(data.message || 'If an account exists for this email, password reset instructions have been sent.');
        if (data.devResetToken) {
          setDevToken(data.devResetToken);
        }
      } else {
        setError(data.error || 'Failed to process request. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!resetToken.trim()) {
      setError('A valid password reset token is required.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      setTouched(prev => ({ ...prev, newPassword: true }));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      setTouched(prev => ({ ...prev, confirmNewPassword: true }));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken.trim(),
          newPassword
        })
      });
      const data = await response.json();

      if (data.success) {
        setSuccess('Your password has been successfully reset! Redirecting to sign in...');
        setNewPassword('');
        setConfirmNewPassword('');
        setResetToken('');
        setTimeout(() => {
          setMode('login');
          setSuccess('Password reset successfully. You can now sign in with your new password.');
        }, 2000);
      } else {
        setError(data.error || 'Password reset link is invalid or has expired.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (persona: 'admin' | 'analyst' | 'viewer') => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      await switchDemoUser(persona);
      setSuccess('Signed in with demo persona successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in with demo persona.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Background ambient gradient orbs */}
      <div className="absolute top-0 left-1/4 w-[650px] h-[650px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none translate-y-1/2" />
      <div className="absolute top-1/2 right-10 w-[350px] h-[350px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Subtle background tech grid */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"
        aria-hidden="true"
      />

      {/* Main Container: 2-Column Responsive Card */}
      <div className="w-full max-w-6xl z-10 grid grid-cols-1 lg:grid-cols-12 rounded-2xl sm:rounded-3xl border border-slate-800/90 bg-slate-900/80 backdrop-blur-2xl shadow-2xl shadow-cyan-950/20 overflow-hidden">
        
        {/* ================================================================= */}
        {/* LEFT BRAND PANEL (Enterprise Showcase)                            */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 bg-gradient-to-br from-slate-900/95 via-slate-950/90 to-slate-900/95 p-6 sm:p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col justify-between relative overflow-hidden">
          
          {/* Subtle decorative mesh orbs inside brand panel */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-500/15 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-600/15 rounded-full blur-[80px] pointer-events-none" />

          {/* Top: Brand Header */}
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <DataPilotLogo size="lg" showTagline={true} />
              <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[11px] font-semibold text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>Enterprise v1.0</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Turn your data into <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  better decisions.
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-lg">
                Analyze, transform, visualize and collaborate on data from one secure workspace.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4">
              {/* Highlight 1 */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors space-y-1.5">
                <div className="flex items-center space-x-2 text-cyan-400">
                  <Database className="w-4 h-4" />
                  <span className="text-xs font-semibold text-slate-200">Multi-database analytics</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Connect PostgreSQL, MySQL, SQLite, Snowflake & analytical lakehouses.
                </p>
              </div>

              {/* Highlight 2 */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors space-y-1.5">
                <div className="flex items-center space-x-2 text-indigo-400">
                  <Cpu className="w-4 h-4" />
                  <span className="text-xs font-semibold text-slate-200">AI-assisted analysis</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Natural language queries, query optimization, and contextual insights.
                </p>
              </div>

              {/* Highlight 3 */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors space-y-1.5">
                <div className="flex items-center space-x-2 text-blue-400">
                  <Layers className="w-4 h-4" />
                  <span className="text-xs font-semibold text-slate-200">Data quality & pipelines</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Non-destructive transformations, schema validation & data health checks.
                </p>
              </div>

              {/* Highlight 4 */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors space-y-1.5">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-semibold text-slate-200">Secure collaboration</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Granular RBAC, audit logging, and team workspace management.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Left: Subtle Abstract Analytics Visual */}
          <div className="mt-8 pt-6 border-t border-slate-800/70 relative z-10">
            <div className="rounded-xl bg-slate-950/80 border border-slate-800/90 p-3.5 space-y-3 shadow-inner">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-2 text-slate-300 font-medium">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Real-Time Analytical Engine</span>
                </div>
                <div className="flex items-center space-x-1.5 text-[10px] text-emerald-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>99.98% Uptime</span>
                </div>
              </div>

              {/* Abstract Sparkline / Visual Nodes */}
              <div className="h-14 w-full relative flex items-end">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 300 60">
                  <defs>
                    <linearGradient id="brandChartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="brandLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                  </defs>
                  {/* Background Grid Lines */}
                  <line x1="0" y1="15" x2="300" y2="15" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4" />
                  <line x1="0" y1="35" x2="300" y2="35" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4" />
                  <line x1="0" y1="55" x2="300" y2="55" stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.4" />

                  {/* Area Fill */}
                  <path
                    d="M 0 45 Q 40 50, 75 30 T 150 22 T 225 12 T 300 6 L 300 60 L 0 60 Z"
                    fill="url(#brandChartGrad)"
                  />
                  {/* Trend Curve */}
                  <path
                    d="M 0 45 Q 40 50, 75 30 T 150 22 T 225 12 T 300 6"
                    fill="none"
                    stroke="url(#brandLineGrad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* Highlights / Nodes */}
                  <circle cx="75" cy="30" r="3" fill="#38bdf8" className="animate-pulse" />
                  <circle cx="150" cy="22" r="3" fill="#06b6d4" />
                  <circle cx="225" cy="12" r="3.5" fill="#818cf8" />
                  <circle cx="300" cy="6" r="4" fill="#a5b4fc" />
                </svg>
              </div>

              {/* Metric Indicators */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/60 text-center">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Latency</div>
                  <div className="text-xs font-mono font-bold text-slate-200">1.8 ms</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Throughput</div>
                  <div className="text-xs font-mono font-bold text-cyan-400">1.2M rows/s</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Integrity</div>
                  <div className="text-xs font-mono font-bold text-emerald-400">100% Valid</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT AUTH PANEL (Interactive Form & Controls)                    */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 p-6 sm:p-8 lg:p-12 flex flex-col justify-between space-y-6">
          <div className="space-y-6">

            {/* Mobile Brand Greeting (Only on smaller screens) */}
            <div className="lg:hidden flex items-center justify-between pb-2 border-b border-slate-800">
              <DataPilotLogo size="md" showTagline={false} />
              <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                Enterprise
              </span>
            </div>

            {/* Segmented Control Switcher [ Sign In ] [ Create Account ] OR Back Navigation */}
            {mode === 'login' || mode === 'signup' ? (
              <div 
                className="grid grid-cols-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800/90 text-xs shadow-inner"
                role="tablist"
                aria-label="Authentication Mode"
              >
                <button
                  type="button"
                  role="tab"
                  id="tab-signin"
                  aria-controls="panel-signin"
                  aria-selected={mode === 'login'}
                  onClick={() => handleSwitchMode('login')}
                  className={`py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 ${
                    mode === 'login'
                      ? 'bg-gradient-to-r from-slate-800 to-slate-800/90 text-white shadow-md border border-slate-700/80'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
                >
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-signup"
                  aria-controls="panel-signup"
                  aria-selected={mode === 'signup'}
                  onClick={() => handleSwitchMode('signup')}
                  className={`py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 ${
                    mode === 'signup'
                      ? 'bg-gradient-to-r from-slate-800 to-slate-800/90 text-white shadow-md border border-slate-700/80'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
                >
                  <span>Create Account</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pb-1">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-slate-900/60 border border-transparent hover:border-slate-800"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-2 py-0.5 rounded">
                  {mode === 'forgot' ? 'Password Recovery' : mode === 'reset' ? 'Password Reset' : 'Email Verification'}
                </span>
              </div>
            )}

            {/* Form Title & Subtitle */}
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {mode === 'login'
                  ? 'Welcome back to DataPilot'
                  : mode === 'signup'
                  ? 'Create your enterprise account'
                  : mode === 'forgot'
                  ? 'Reset your password'
                  : mode === 'reset'
                  ? 'Set a new password'
                  : verificationStatus === 'success'
                  ? 'Email verified successfully'
                  : 'Verify your email address'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {mode === 'login'
                  ? 'Enter your work email and password to access your analytical workspace.'
                  : mode === 'signup'
                  ? 'Start analyzing, building SQL pipelines, and collaborating with your team.'
                  : mode === 'forgot'
                  ? "Enter your work email address and we'll send you instructions to reset your password."
                  : mode === 'reset'
                  ? 'Enter your reset token and new password to secure your DataPilot account.'
                  : verificationStatus === 'success'
                  ? 'Your enterprise account is authenticated and active. Welcome to DataPilot!'
                  : `We sent a secure verification link to ${verificationEmail || 'your email'}. Enter your token or click the link to continue.`}
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start space-x-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm animate-in fade-in duration-200"
                data-testid="auth-error-banner"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">{error}</div>
              </div>
            )}

            {/* Success Banner */}
            {success && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start space-x-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm animate-in fade-in duration-200"
                data-testid="auth-success-banner"
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">{success}</div>
              </div>
            )}

            {/* ============================================================= */}
            {/* SIGN IN FORM                                                  */}
            {/* ============================================================= */}
            {mode === 'login' ? (
              <form 
                id="panel-signin"
                role="tabpanel"
                aria-labelledby="tab-signin"
                onSubmit={handleLogin} 
                className="space-y-4" 
                data-testid="login-form"
                noValidate
              >
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label htmlFor={loginEmailId} className="block text-xs font-semibold text-slate-300">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id={loginEmailId}
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => handleBlur('email')}
                      placeholder="name@company.com"
                      disabled={isLoading}
                      className={`w-full min-h-[44px] pl-10 pr-3.5 py-2.5 bg-slate-950/80 border rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all disabled:opacity-50 ${
                        touched.email && !email.trim()
                          ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                          : touched.email && !isEmailValid
                          ? 'border-amber-500/60 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40'
                          : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40'
                      }`}
                    />
                  </div>
                  {touched.email && !email.trim() && (
                    <p className="text-[11px] text-rose-400 font-medium">Please enter your email address.</p>
                  )}
                  {touched.email && email.trim() && !isEmailValid && (
                    <p className="text-[11px] text-amber-400 font-medium">Please enter a valid email address.</p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor={loginPasswordId} className="block text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('forgot')}
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer font-medium focus:outline-hidden focus:underline"
                      data-testid="forgot-password-link"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id={loginPasswordId}
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onBlur={() => handleBlur('password')}
                      placeholder="••••••••"
                      disabled={isLoading}
                      className={`w-full min-h-[44px] pl-10 pr-10 py-2.5 bg-slate-950/80 border rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all disabled:opacity-50 ${
                        touched.password && !password
                          ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                          : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 rounded-md"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {touched.password && !password && (
                    <p className="text-[11px] text-rose-400 font-medium">Please enter your password.</p>
                  )}
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[46px] mt-3 py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-cyan-950/40 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Secondary navigation link */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signup')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer focus:outline-hidden focus:underline"
                  >
                    Don't have an account? Create one
                  </button>
                </div>
              </form>
            ) : mode === 'signup' ? (
              /* ============================================================= */
              /* SIGN UP / CREATE ACCOUNT FORM                                 */
              /* ============================================================= */
              <form 
                id="panel-signup"
                role="tabpanel"
                aria-labelledby="tab-signup"
                onSubmit={handleSignup} 
                className="space-y-4" 
                data-testid="signup-form"
                noValidate
              >
                {/* Full Name & Job Title */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label htmlFor={signupNameId} className="block text-xs font-semibold text-slate-300">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id={signupNameId}
                        type="text"
                        required
                        autoComplete="name"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        onBlur={() => handleBlur('fullName')}
                        placeholder="Alex Rivera"
                        disabled={isLoading}
                        maxLength={100}
                        className={`w-full min-h-[44px] pl-10 pr-3.5 py-2.5 bg-slate-950/80 border rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all disabled:opacity-50 ${
                          touched.fullName && (!fullName.trim() || fullName.trim().length < 2)
                            ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                            : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40'
                        }`}
                      />
                    </div>
                    {touched.fullName && (!fullName.trim() || fullName.trim().length < 2) && (
                      <p className="text-[11px] text-rose-400 font-medium">Please enter your full name.</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={signupJobId} className="block text-xs font-semibold text-slate-300">
                      Job Title <span className="text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id={signupJobId}
                        type="text"
                        autoComplete="organization-title"
                        value={jobTitle}
                        onChange={e => setJobTitle(e.target.value)}
                        placeholder="Lead Data Analyst"
                        disabled={isLoading}
                        maxLength={100}
                        className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-all disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label htmlFor={signupEmailId} className="block text-xs font-semibold text-slate-300">
                    Work Email Address <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id={signupEmailId}
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => handleBlur('email')}
                      placeholder="alex@datapilot.io"
                      disabled={isLoading}
                      maxLength={150}
                      className={`w-full min-h-[44px] pl-10 pr-3.5 py-2.5 bg-slate-950/80 border rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all disabled:opacity-50 ${
                        touched.email && !email.trim()
                          ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                          : touched.email && !isEmailValid
                          ? 'border-amber-500/60 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40'
                          : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40'
                      }`}
                    />
                  </div>
                  {touched.email && !email.trim() && (
                    <p className="text-[11px] text-rose-400 font-medium">Email address is required.</p>
                  )}
                  {touched.email && email.trim() && !isEmailValid && (
                    <p className="text-[11px] text-amber-400 font-medium">Please enter a valid email address.</p>
                  )}
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label htmlFor={signupPasswordId} className="block text-xs font-semibold text-slate-300">
                      Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id={signupPasswordId}
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onBlur={() => handleBlur('password')}
                        placeholder="Min 6 chars"
                        disabled={isLoading}
                        className={`w-full min-h-[44px] pl-10 pr-10 py-2.5 bg-slate-950/80 border rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all disabled:opacity-50 ${
                          touched.password && password.length < 6
                            ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                            : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 rounded-md"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={signupConfirmId} className="block text-xs font-semibold text-slate-300">
                      Confirm Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id={signupConfirmId}
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        onBlur={() => handleBlur('confirmPassword')}
                        placeholder="Re-enter password"
                        disabled={isLoading}
                        className={`w-full min-h-[44px] pl-10 pr-10 py-2.5 bg-slate-950/80 border rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all disabled:opacity-50 ${
                          passwordsMismatch
                            ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                            : passwordsMatch
                            ? 'border-emerald-500/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40'
                            : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(prev => !prev)}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 rounded-md"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Strength & Confirmation Status Indicators */}
                {password.length > 0 && (
                  <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2 text-xs animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px] font-medium">Password strength:</span>
                      <span className={`text-[11px] font-semibold ${
                        passwordStrength.label === 'Strong'
                          ? 'text-emerald-400'
                          : passwordStrength.label === 'Fair'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>

                    {/* Strength Meter Bar */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-1">
                      <div className={`h-full flex-1 rounded-full transition-all duration-300 ${
                        passwordStrength.score >= 1 
                          ? (passwordStrength.label === 'Strong' ? 'bg-emerald-400' : passwordStrength.label === 'Fair' ? 'bg-amber-400' : 'bg-rose-500') 
                          : 'bg-slate-800'
                      }`} />
                      <div className={`h-full flex-1 rounded-full transition-all duration-300 ${
                        passwordStrength.score >= 2 
                          ? (passwordStrength.label === 'Strong' ? 'bg-emerald-400' : 'bg-amber-400') 
                          : 'bg-slate-800'
                      }`} />
                      <div className={`h-full flex-1 rounded-full transition-all duration-300 ${
                        passwordStrength.score >= 3 && passwordStrength.label === 'Strong'
                          ? 'bg-emerald-400' 
                          : 'bg-slate-800'
                      }`} />
                    </div>

                    {/* Requirements Checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                      <div className={`flex items-center space-x-1.5 ${passwordStrength.hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {passwordStrength.hasMinLength ? <Check className="w-3 h-3 flex-shrink-0" /> : <Circle className="w-2.5 h-2.5 flex-shrink-0" />}
                        <span>At least 6 characters (required)</span>
                      </div>
                      <div className={`flex items-center space-x-1.5 ${passwordStrength.hasCaseVariety ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {passwordStrength.hasCaseVariety ? <Check className="w-3 h-3 flex-shrink-0" /> : <Circle className="w-2.5 h-2.5 flex-shrink-0" />}
                        <span>Upper & lowercase letters</span>
                      </div>
                      <div className={`flex items-center space-x-1.5 ${passwordStrength.hasNumberOrSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {passwordStrength.hasNumberOrSpecial ? <Check className="w-3 h-3 flex-shrink-0" /> : <Circle className="w-2.5 h-2.5 flex-shrink-0" />}
                        <span>Numbers or symbols</span>
                      </div>
                      {confirmPassword.length > 0 && (
                        <div className={`flex items-center space-x-1.5 ${passwordsMatch ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {passwordsMatch ? <Check className="w-3 h-3 flex-shrink-0" /> : <AlertCircle className="w-3 h-3 flex-shrink-0" />}
                          <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[46px] mt-3 py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-cyan-950/40 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Secondary navigation link */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer focus:outline-hidden focus:underline"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </form>
            ) : mode === 'forgot' ? (
              /* ============================================================= */
              /* FORGOT PASSWORD FORM                                          */
              /* ============================================================= */
              <form
                id="panel-forgot"
                onSubmit={handleForgotPassword}
                className="space-y-4"
                data-testid="forgot-password-form"
                noValidate
              >
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label htmlFor={forgotEmailId} className="block text-xs font-semibold text-slate-300">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id={forgotEmailId}
                      type="email"
                      required
                      autoComplete="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      onBlur={() => handleBlur('forgotEmail')}
                      placeholder="name@company.com"
                      disabled={isLoading}
                      className={`w-full min-h-[44px] pl-10 pr-3.5 py-2.5 bg-slate-950/80 border rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all disabled:opacity-50 ${
                        touched.forgotEmail && !forgotEmail.trim()
                          ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                          : touched.forgotEmail && forgotEmail.trim() && !emailRegex.test(forgotEmail.trim())
                          ? 'border-amber-500/60 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40'
                          : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40'
                      }`}
                    />
                  </div>
                  {touched.forgotEmail && !forgotEmail.trim() && (
                    <p className="text-[11px] text-rose-400 font-medium">Please enter your email address.</p>
                  )}
                  {touched.forgotEmail && forgotEmail.trim() && !emailRegex.test(forgotEmail.trim()) && (
                    <p className="text-[11px] text-amber-400 font-medium">Please enter a valid email address.</p>
                  )}
                </div>

                {/* Development Mode Helper Banner */}
                {isDemoMode && devToken && (
                  <div className="p-3.5 bg-cyan-950/40 border border-cyan-500/30 rounded-xl space-y-2.5 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-xs text-cyan-300 font-semibold">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span>Development Mode Reset Token</span>
                      </div>
                      <span className="text-[10px] text-cyan-400 bg-cyan-900/40 px-2 py-0.5 rounded border border-cyan-800/50 font-mono">
                        Valid 20m
                      </span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-mono break-all select-all">
                      {devToken}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResetToken(devToken);
                        handleSwitchMode('reset');
                      }}
                      className="w-full py-2 px-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg text-xs font-semibold text-cyan-200 transition-colors cursor-pointer text-center flex items-center justify-center space-x-1.5"
                    >
                      <span>Proceed to Reset Form with this Token</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[46px] mt-3 py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-cyan-950/40 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Sending instructions...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Instructions</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Secondary navigation link */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors cursor-pointer focus:outline-hidden focus:underline inline-flex items-center space-x-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </button>
                </div>
              </form>
            ) : mode === 'reset' ? (
              /* ============================================================= */
              /* RESET PASSWORD FORM                                           */
              /* ============================================================= */
              <form
                id="panel-reset"
                onSubmit={handleResetPassword}
                className="space-y-4"
                data-testid="reset-password-form"
                noValidate
              >
                {/* Reset Token Field */}
                <div className="space-y-1.5">
                  <label htmlFor={resetTokenId} className="block text-xs font-semibold text-slate-300">
                    Reset Token <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id={resetTokenId}
                      type="text"
                      required
                      value={resetToken}
                      onChange={e => setResetToken(e.target.value)}
                      placeholder="Paste 64-character reset token"
                      disabled={isLoading}
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 font-mono transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label htmlFor={resetPasswordId} className="block text-xs font-semibold text-slate-300">
                      New Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id={resetPasswordId}
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        onBlur={() => handleBlur('newPassword')}
                        placeholder="Min 6 chars"
                        disabled={isLoading}
                        className={`w-full min-h-[44px] pl-10 pr-10 py-2.5 bg-slate-950/80 border rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all disabled:opacity-50 ${
                          touched.newPassword && newPassword.length < 6
                            ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                            : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(prev => !prev)}
                        aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 rounded-md"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={resetConfirmId} className="block text-xs font-semibold text-slate-300">
                      Confirm Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id={resetConfirmId}
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={confirmNewPassword}
                        onChange={e => setConfirmNewPassword(e.target.value)}
                        onBlur={() => handleBlur('confirmNewPassword')}
                        placeholder="Re-enter password"
                        disabled={isLoading}
                        className={`w-full min-h-[44px] pl-10 pr-10 py-2.5 bg-slate-950/80 border rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden transition-all disabled:opacity-50 ${
                          touched.confirmNewPassword && newPasswordsMismatch
                            ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                            : touched.confirmNewPassword && newPasswordsMatch
                            ? 'border-emerald-500/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40'
                            : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword(prev => !prev)}
                        aria-label={showConfirmNewPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50 rounded-md"
                      >
                        {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Strength Indicator & Requirements */}
                {newPassword.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Password Strength:</span>
                      <span className={`font-semibold ${
                        newPasswordStrength.label === 'Strong'
                          ? 'text-emerald-400'
                          : newPasswordStrength.label === 'Fair'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {newPasswordStrength.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 h-1.5">
                      <div className={`rounded-full transition-all duration-300 ${
                        newPasswordStrength.score >= 1
                          ? newPasswordStrength.score === 1
                            ? 'bg-rose-500'
                            : newPasswordStrength.score === 2
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                          : 'bg-slate-800'
                      }`} />
                      <div className={`rounded-full transition-all duration-300 ${
                        newPasswordStrength.score >= 2
                          ? newPasswordStrength.score === 2
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                          : 'bg-slate-800'
                      }`} />
                      <div className={`rounded-full transition-all duration-300 ${
                        newPasswordStrength.score >= 3 ? 'bg-emerald-500' : 'bg-slate-800'
                      }`} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                      <div className={`flex items-center space-x-1.5 ${newPasswordStrength.hasMinLength ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {newPasswordStrength.hasMinLength ? <Check className="w-3 h-3 flex-shrink-0" /> : <Circle className="w-2.5 h-2.5 flex-shrink-0" />}
                        <span>At least 6 characters</span>
                      </div>
                      <div className={`flex items-center space-x-1.5 ${newPasswordStrength.hasCaseVariety ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {newPasswordStrength.hasCaseVariety ? <Check className="w-3 h-3 flex-shrink-0" /> : <Circle className="w-2.5 h-2.5 flex-shrink-0" />}
                        <span>Upper & lowercase letters</span>
                      </div>
                      <div className={`flex items-center space-x-1.5 ${newPasswordStrength.hasNumberOrSpecial ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {newPasswordStrength.hasNumberOrSpecial ? <Check className="w-3 h-3 flex-shrink-0" /> : <Circle className="w-2.5 h-2.5 flex-shrink-0" />}
                        <span>Number or special character</span>
                      </div>
                      {confirmNewPassword.length > 0 && (
                        <div className={`flex items-center space-x-1.5 ${newPasswordsMatch ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {newPasswordsMatch ? <Check className="w-3 h-3 flex-shrink-0" /> : <AlertCircle className="w-3 h-3 flex-shrink-0" />}
                          <span>{newPasswordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={isLoading || !resetToken.trim() || newPassword.length < 6 || newPasswordsMismatch}
                  className="w-full min-h-[46px] mt-3 py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-cyan-950/40 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Resetting password...</span>
                    </>
                  ) : (
                    <>
                      <span>Set New Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Secondary links */}
                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="text-slate-400 hover:text-slate-200 font-medium transition-colors cursor-pointer focus:outline-hidden focus:underline inline-flex items-center space-x-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgot')}
                    className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer focus:outline-hidden focus:underline"
                  >
                    Request new link
                  </button>
                </div>
              </form>
            ) : (
              /* ============================================================= */
              /* EMAIL VERIFICATION PANEL                                      */
              /* ============================================================= */
              <div className="space-y-4" data-testid="email-verification-panel">
                {verificationStatus === 'success' ? (
                  <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-4">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-white">Account Ready & Activated</h3>
                      <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                        Your work email has been verified with cryptographic authenticity. Workspace collaboration, analytical pipelines, and data tools are fully unlocked.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = '/';
                      }}
                      className="w-full min-h-[46px] py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <span>Enter DataPilot Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyEmailSubmit} className="space-y-4" noValidate>
                    {/* Recipient Email Chip */}
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Account Email</div>
                          <div className="text-xs font-semibold text-slate-200 font-mono">
                            {verificationEmail || email || 'Registered User'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        Verification Pending
                      </span>
                    </div>

                    {/* Developer Mode Simulated Delivery Box */}
                    {isDemoMode && devVerificationToken && (
                      <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2.5 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 text-xs text-amber-300 font-semibold">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span>Development Mode Token Delivery</span>
                          </div>
                          <span className="text-[10px] text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded border border-amber-800/50 font-mono">
                            Simulated Email
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          In this test environment, emails are simulated. A cryptographically generated token has been issued:
                        </p>
                        <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-amber-200 font-mono break-all select-all">
                          {devVerificationToken}
                        </div>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleVerifyEmailDirect(devVerificationToken)}
                          className="w-full py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-xs font-semibold text-amber-200 transition-colors cursor-pointer text-center flex items-center justify-center space-x-1.5"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Verifying token...</span>
                            </>
                          ) : (
                            <>
                              <span>Verify Instantly with This Token</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Token Input */}
                    <div className="space-y-1.5">
                      <label htmlFor={verifyTokenId} className="block text-xs font-semibold text-slate-300">
                        Verification Token <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id={verifyTokenId}
                          type="text"
                          required
                          value={verificationToken}
                          onChange={e => setVerificationToken(e.target.value)}
                          placeholder="Paste verification token"
                          disabled={isLoading}
                          className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 font-mono transition-all disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Resend success notice */}
                    {resendSuccess && (
                      <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-lg">
                        <Check className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{resendSuccess}</span>
                      </div>
                    )}

                    {/* Submit CTA */}
                    <button
                      type="submit"
                      disabled={isLoading || !verificationToken.trim()}
                      className="w-full min-h-[46px] py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-cyan-950/40 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Verifying token...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify Email Address</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Resend and return links */}
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleSwitchMode('login')}
                        className="text-slate-400 hover:text-slate-200 font-medium transition-colors cursor-pointer focus:outline-hidden focus:underline inline-flex items-center space-x-1.5"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Return to Sign In</span>
                      </button>
                      <button
                        type="button"
                        disabled={isResending || resendCooldown > 0}
                        onClick={handleResendVerification}
                        className="text-cyan-400 hover:text-cyan-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        {isResending
                          ? 'Sending...'
                          : resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : 'Resend Verification Link'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* ============================================================= */}
          {/* BOTTOM SECTION: Development Personas & Security Badge          */}
          {/* ============================================================= */}
          <div className="space-y-4 pt-4 border-t border-slate-800/80">
            {/* Development Demo Personas (Only in development/demo mode) */}
            {isDemoMode && (
              <div className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-300 font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Development Demo Personas</span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                    Available only in development mode
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleDemoLogin('admin')}
                    className="py-2 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all text-center cursor-pointer disabled:opacity-50"
                  >
                    Admin / Owner
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleDemoLogin('analyst')}
                    className="py-2 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all text-center cursor-pointer disabled:opacity-50"
                  >
                    Analyst
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleDemoLogin('viewer')}
                    className="py-2 px-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all text-center cursor-pointer disabled:opacity-50"
                  >
                    Viewer
                  </button>
                </div>
              </div>
            )}

            {/* Enterprise Security Footer Note */}
            <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-500 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span>Secured with HttpOnly Cookies & Server-Side RBAC Enforcement</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
