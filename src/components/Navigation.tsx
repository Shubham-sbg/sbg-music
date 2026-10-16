import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Music2, 
  ListMusic, 
  Heart, 
  FolderHeart, 
  Search, 
  ShieldAlert, 
  Mic, 
  Sparkles 
} from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { usePlayer } from '../context/PlayerContext';

export default function Navigation() {
  const navigate = useNavigate();
  const { user, loginGuest, logout } = useAuth();
  const { audioMode = 'normal', setAudioMode, isPlaying } = usePlayer();

  const navLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/songs', label: 'Explore', icon: Music2 },
    { to: '/playlists', label: 'Playlists', icon: ListMusic },
    { to: '/favorites', label: 'Favorites', icon: Heart },
    { to: '/library', label: 'My Library', icon: FolderHeart },
    { to: '/admin', label: 'Admin', icon: ShieldAlert },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-30 h-16 bg-[#0e0e13]/80 backdrop-blur-xl border-b border-white/[0.08] px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 p-0.5 shadow-lg shadow-purple-900/30">
            <div className="w-full h-full bg-[#0d0d12] rounded-[10px] flex items-center justify-center">
              <span className="text-white font-extrabold text-lg tracking-tighter bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                SBG
              </span>
            </div>
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wide text-white flex items-center gap-1.5">
              SBG MUSIC
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                PRO
              </span>
            </h1>
            <p className="text-[10px] text-white/40 hidden sm:block">Studio Quality Streaming & Discovery</p>
          </div>
        </div>

        {/* Global Quick Search Button */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <div 
            onClick={() => navigate('/search')}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-white/50 hover:text-white transition-all cursor-pointer text-xs"
          >
            <Search className="w-4 h-4 text-purple-400" />
            <span>Search tracks, artists, albums, or YouTube URLs...</span>
            <kbd className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/60">⌘K</kbd>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Quick Voice Booster Toggle */}
          <button
            onClick={() => setAudioMode?.(audioMode === 'vocal_boost' ? 'normal' : 'vocal_boost')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              audioMode === 'vocal_boost'
                ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-md shadow-purple-900/40'
                : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Voice & Vocal Enhancement Filter"
          >
            <Mic className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Voice Boost</span>
            {audioMode === 'vocal_boost' && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />}
          </button>

          <button
            onClick={() => navigate('/search')}
            className="md:hidden p-2 rounded-xl bg-white/[0.05] border border-white/10 text-white/70 hover:text-white cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>

          {user ? (
            <button
              onClick={() => logout()}
              className="text-xs px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/80 font-medium cursor-pointer"
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => loginGuest()}
              className="text-xs px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-md shadow-purple-900/30 transition-all cursor-pointer"
            >
              Guest In
            </button>
          )}
        </div>
      </header>

      {/* Desktop Sidebar Navigation */}
      <aside className="fixed left-0 top-16 bottom-20 w-60 bg-[#0c0c10] border-r border-white/[0.06] p-4 hidden lg:flex flex-col justify-between z-20">
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 px-3 mb-2">Explore</p>
            <nav className="space-y-1">
              {navLinks.slice(0, 3).map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 px-3 mb-2">My Collection</p>
            <nav className="space-y-1">
              {navLinks.slice(3, 5).map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 px-3 mb-2">Control</p>
            <nav className="space-y-1">
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                  }`
                }
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Admin Portal</span>
              </NavLink>
            </nav>
          </div>
        </div>

        {/* Audio Engine Status Badge */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-white/70">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
              Audio Pipeline
            </span>
            <span className="text-[10px] text-purple-400 font-bold uppercase">{(audioMode || 'normal').replace('_', ' ')}</span>
          </div>
          <p className="text-[10px] text-white/40 leading-relaxed">
            Continuous background audio stream active with stall recovery.
          </p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0e0e14]/95 backdrop-blur-xl border-t border-white/[0.08] lg:hidden px-2 py-2 flex items-center justify-around">
        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${
                  isActive ? 'text-purple-400' : 'text-white/40 hover:text-white/70'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
