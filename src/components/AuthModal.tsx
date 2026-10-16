import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { X, Mail, Lock, User, LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import SBGMusicLogo from './SBGMusicLogo';
import { useAuth } from '../context/AuthProvider';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Sign in to SBG MUSIC',
  subtitle = 'Create your own playlists, save favorites, and sync across devices.',
}: AuthModalProps) {
  const { loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide email and password.');
      return;
    }
    if (mode === 'signup' && !displayName.trim()) {
      setError('Please provide your name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (res.user && displayName.trim()) {
          await updateProfile(res.user, { displayName: displayName.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = err.message || 'Authentication failed.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Try logging in instead.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        msg = `Domain "${domain}" is not authorized in Firebase. Please add "${domain}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection error. Please check your internet connection.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loginWithGoogle();
      if (res.cancelled) {
        // User closed the popup, do not show error
        return;
      }
      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      console.warn('Google sign-in caught exception safely:', err);
      setError(err?.message || 'Failed to sign in with Google. You can also sign up or log in using email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-6">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 text-white/40 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="space-y-3">
          <SBGMusicLogo clickable={false} size="lg" />
          <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'signup'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === 'login'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5">Your Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Rahul Verma"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-white/70 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/70 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-purple-900/30 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : mode === 'signup' ? (
              <>
                <UserPlus size={18} />
                <span>Create Free Account</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-white/10 w-full" />
          <span className="bg-[#141416] px-3 text-[11px] font-bold text-white/30 uppercase tracking-widest absolute">
            OR
          </span>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-3 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>
      </div>
    </div>
  );
}
