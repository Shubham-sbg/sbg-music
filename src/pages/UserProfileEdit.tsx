import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, ArrowLeft, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { useSeo } from '../hooks/useSeo';
import { getUserProfile, updateUserProfile, ensureUserProfile } from '../services/profileService';
import { UserProfile } from '../types';

export default function UserProfileEdit() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useSeo({ title: 'Edit Profile | SBG MUSIC', noIndex: true });

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const userId = user?.uid || (user as any)?.id;

  useEffect(() => {
    let isMounted = true;
    if (!userId) {
      navigate('/profile');
      return;
    }

    async function load() {
      try {
        let p = await getUserProfile(userId);
        if (!p && user) {
          p = await ensureUserProfile({ uid: userId, email: user.email, displayName: user.displayName, photoURL: (user as any).photoURL });
        }
        if (p && isMounted) {
          setDisplayName(p.displayName || '');
          setUsername(p.username || '');
          setBio(p.bio || '');
          setPhotoURL(p.photoURL || '');
          setIsPublic(p.isPublic !== false);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [userId, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setError('');
    setSuccess(false);

    // Validation
    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 2) {
      setError('Username must be at least 2 alphanumeric characters.');
      return;
    }

    setSaving(true);
    const res = await updateUserProfile(userId, {
      displayName: displayName.trim(),
      username: cleanUsername,
      bio: bio.trim(),
      photoURL: photoURL.trim(),
      isPublic,
    });

    setSaving(false);
    if (res.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate('/profile');
      }, 1000);
    } else {
      setError(res.error || 'Failed to update profile.');
    }
  };

  const AVATAR_PRESETS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3">
        <Loader2 size={32} className="text-purple-500 animate-spin" />
        <p className="text-xs text-white/40 uppercase tracking-widest font-mono">Loading profile data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-36">
      {/* Back button */}
      <Link
        to="/profile"
        className="inline-flex items-center gap-2 text-xs font-semibold text-white/50 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Profile
      </Link>

      <div className="bg-[#111113] border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-1.5">Edit Profile</h1>
        <p className="text-xs text-white/50 mb-8">
          Update your public profile details, bio, and avatar on SBG MUSIC.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Preview & Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-3">
              Profile Picture
            </label>
            <div className="flex items-center gap-5 mb-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-purple-500/40 bg-zinc-900 shrink-0 flex items-center justify-center shadow-lg">
                {photoURL ? (
                  <img src={photoURL} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User size={36} className="text-white/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <span className="text-[10px] text-white/40 mt-1 block">Paste an image URL or choose a preset below</span>
              </div>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-white/40">Presets:</span>
              {AVATAR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPhotoURL(preset)}
                  className={`w-9 h-9 rounded-full overflow-hidden border transition-all active:scale-90 cursor-pointer ${
                    photoURL === preset ? 'border-purple-500 scale-110 shadow-md' : 'border-white/20 hover:border-white/50'
                  }`}
                >
                  <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
              {photoURL && (
                <button
                  type="button"
                  onClick={() => setPhotoURL('')}
                  className="text-[11px] text-white/40 hover:text-white underline ml-2"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
              Display Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="w-full p-3.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
              Username <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-mono text-sm">@</span>
              <input
                type="text"
                required
                maxLength={25}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-mono placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <span className="text-[10px] text-white/40 mt-1 block">Alphanumeric characters and underscores only.</span>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
              Bio
            </label>
            <textarea
              rows={3}
              maxLength={250}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell listeners a bit about yourself or music taste..."
              className="w-full p-3.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors resize-none"
            />
            <div className="text-right text-[10px] text-white/40 mt-0.5">
              {bio.length}/250
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl text-green-300 text-xs flex items-center gap-2">
              <Check size={16} className="shrink-0 text-green-400" />
              <span>Profile updated successfully! Redirecting...</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <Link
              to="/profile"
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
