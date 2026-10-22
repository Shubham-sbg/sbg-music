import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, Music, ListMusic, Search, Youtube, User, LogOut, ChevronLeft, Heart, Library, Plus, Smartphone, Sparkles, WifiOff, HardDrive } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { usePlayer } from '../context/PlayerContext';
import { useNavigationVisibility } from '../lib/navigationSettings';
import AuthModal from './AuthModal';
import CreatePlaylistModal from './CreatePlaylistModal';
import SBGMusicLogo from './SBGMusicLogo';

export default function Navigation() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { settings } = useNavigationVisibility();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isAdminRoute = pathname.startsWith('/sbgadmin') || pathname.startsWith('/staff');

  const handleCreateClick = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  const mainLinks = [
    { name: 'Home', path: '/', icon: <Home size={20} /> },
    { name: 'Songs', path: '/songs', icon: <Music size={20} /> },
    { name: 'AI Studio', path: '/generate', icon: <Sparkles size={20} /> },
    { name: 'Library', path: '/library', icon: <Library size={20} /> },
    { name: 'Playlists', path: '/playlists', icon: <ListMusic size={20} /> },
    { name: 'YouTube', path: '/search?source=youtube', icon: <Youtube size={20} /> },
    { name: 'Favorites', path: '/favorites', icon: <Heart size={20} /> },
    { name: 'Get App', path: '/download', icon: <Smartphone size={20} /> },
    { name: 'Search', path: '/search', icon: <Search size={20} /> },
  ];

  const isLinkVisible = (name: string) => {
    switch (name) {
      case 'Home': return settings.showHome !== false;
      case 'Songs': return settings.showSongs !== false;
      case 'AI Studio': return settings.showAiStudio !== false;
      case 'Library': return settings.showLibrary !== false;
      case 'Playlists': return settings.showPlaylists !== false;
      case 'YouTube': return settings.showYouTube !== false;
      case 'Favorites': return settings.showFavorites !== false;
      case 'Get App': return settings.showGetApp !== false;
      case 'Search': return settings.showSearch !== false;
      default: return true;
    }
  };

  const filteredLinks = mainLinks.filter((item) => isLinkVisible(item.name));

  // Determine active states for mobile bottom nav with exact routing checks
  const isHomeActive = pathname === '/';
  const isSongsActive = pathname === '/songs' || pathname.startsWith('/song/') || pathname.startsWith('/artist/') || pathname.startsWith('/album/') || pathname.startsWith('/category/');
  const isLibraryActive = pathname === '/library' || pathname === '/my-library';
  const isYouTubeActive = pathname === '/search' && searchParams.get('source') === 'youtube';
  const isFavoritesActive = pathname.startsWith('/favorites');

  const bottomNavItems = [
    { name: 'Home', path: '/', icon: <Home size={20} />, active: isHomeActive },
    { name: 'Songs', path: '/songs', icon: <Music size={20} />, active: isSongsActive },
    { name: 'Library', path: '/library', icon: <Library size={20} />, active: isLibraryActive },
    { name: 'YouTube', path: '/search?source=youtube', icon: <Youtube size={20} />, active: isYouTubeActive },
    { name: 'Favorites', path: '/favorites', icon: <Heart size={20} />, active: isFavoritesActive },
  ];

  return (
    <>
      {/* 1. TOP HEADER (Mobile & Desktop) */}
      <nav className="flex items-center justify-between px-3.5 py-2.5 sm:px-6 md:px-8 border-b border-white/5 bg-[#050505] sticky top-0 z-40 backdrop-blur-xl bg-opacity-95">
        
        {/* BRANDING */}
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <Link to="/" className="flex items-center gap-2 active:scale-95 transition-transform" aria-label="SBG MUSIC Home">
            <div className="md:hidden">
              <SBGMusicLogo variant="icon" size="sm" clickable={false} />
            </div>
            <div className="hidden md:block">
              <SBGMusicLogo variant="full" size="sm" clickable={false} />
            </div>
            <span className="font-extrabold tracking-tight text-white md:hidden ml-0.5 text-sm sm:text-base">SBG MUSIC</span>
          </Link>
        </div>

        {/* DESKTOP NAVIGATION LINKS */}
        <div className="hidden md:flex items-center justify-center gap-5 lg:gap-7 flex-1 px-4 lg:px-8">
          {filteredLinks.map((item) => {
            if (item.name === 'Search') return null; // handled separately on desktop
            const isActive = item.name === 'YouTube'
              ? isYouTubeActive
              : pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`text-xs lg:text-sm font-bold transition-all py-1 px-1.5 rounded-lg ${
                  isActive ? 'text-white border-b-2 border-purple-500' : 'text-white/60 hover:text-white'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Desktop Search Field */}
          {settings.showSearch !== false && (
            <Link 
              to="/search" 
              className={`hidden md:flex items-center gap-2 bg-white/5 border rounded-full px-3.5 py-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-all w-36 lg:w-56 ${
                pathname === '/search' && !isYouTubeActive ? 'border-purple-500/50 bg-white/10' : 'border-white/15'
              }`}
            >
              <Search size={14} />
              <span className="text-xs font-medium truncate text-white/70">Search songs, artists...</span>
            </Link>
          )}

          {/* Quick AI Music Studio Action */}
          {settings.showQuickAiButton !== false && settings.showAiStudio !== false && (
            <Link
              to="/generate"
              className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                pathname.startsWith('/generate')
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                  : 'bg-gradient-to-r from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 text-purple-300 hover:text-white border-purple-500/30'
              }`}
              title="Create Custom AI Music"
            >
              <Sparkles size={13} className="text-yellow-400" />
              <span>Generate</span>
            </Link>
          )}

          {/* Quick APK Download Action */}
          {settings.showQuickAppButton !== false && settings.showGetApp !== false && (
            <Link
              to="/download"
              className={`hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                pathname === '/download'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/10'
              }`}
              title="Download Official SBG Music Android APK"
            >
              <Smartphone size={13} className="text-purple-400" />
              <span>Get App</span>
            </Link>
          )}

          {/* Create Playlist Button (Desktop & Mobile) */}
          {settings.showCreatePlaylistButton !== false && (
            <button
              onClick={handleCreateClick}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
              title="Create New Playlist"
              aria-label="Create New Playlist"
            >
              <Plus size={15} className="text-purple-400" />
              <span className="hidden sm:inline">New Playlist</span>
            </button>
          )}

          {/* Account Button & Library Quick Access */}
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                to="/library"
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  pathname.startsWith('/library')
                    ? 'bg-purple-600 text-white border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                    : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/10'
                }`}
              >
                <Library size={13} />
                <span>My Library</span>
              </Link>
              
              <Link
                to="/profile"
                className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-300 flex items-center justify-center font-bold text-xs border border-purple-500/30 hover:border-purple-400 cursor-pointer overflow-hidden transition-all hover:scale-105"
                title={user.displayName ? `${user.displayName} (Profile)` : 'Profile'}
                aria-label="User Profile"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Profile'} className="w-full h-full object-cover" />
                ) : (
                  user.displayName?.[0]?.toUpperCase() || <User size={14} />
                )}
              </Link>

              <button
                onClick={logout}
                title="Sign Out"
                aria-label="Sign Out"
                className="p-1.5 text-white/60 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : !isAdminRoute ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-xs font-bold text-white/80 hover:text-white px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/15 cursor-pointer active:scale-95"
              >
                Sign In
              </button>
            </div>
          ) : null}
        </div>
      </nav>

      {/* 2. MOBILE SEARCH BAR (Sticky below Header with exact alignment) */}
      {settings.showSearch !== false && (
        <div className="md:hidden px-3.5 py-2.5 bg-[#050505] border-b border-white/5 sticky top-[53px] z-30 shadow-md">
          <Link 
            to="/search" 
            className="w-full flex items-center gap-2.5 bg-white/[0.06] hover:bg-white/10 border border-white/10 rounded-xl px-3.5 py-2.5 text-white/60 transition-colors active:scale-[0.99]"
            aria-label="Search songs and artists"
          >
             <Search size={16} className="text-purple-400 shrink-0" />
             <span className="text-xs sm:text-sm truncate text-white/70">Search songs, artists, playlists...</span>
          </Link>
        </div>
      )}

      {/* 3. MOBILE BOTTOM NAVIGATION (Strictly 5 touch-safe, responsive items with safe-area padding) */}
      <div 
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0C]/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 h-[64px] shadow-[0_-5px_20px_rgba(0,0,0,0.7)]"
        role="navigation"
        aria-label="Mobile Navigation"
      >
        {bottomNavItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            aria-label={item.name}
            aria-current={item.active ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] touch-manipulation select-none active:scale-90 transition-all ${
              item.active ? 'text-purple-400 font-bold' : 'text-white/60 hover:text-white'
            }`}
          >
            {React.cloneElement(item.icon, {
              size: 20,
              className: `transition-transform duration-200 ${item.active ? 'text-purple-400 scale-110 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]' : 'text-white/60'}`
            })}
            <span className={`text-[10px] tracking-tight mt-0.5 ${item.active ? 'text-white font-bold' : 'text-white/60'}`}>
              {item.name}
            </span>
          </Link>
        ))}
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Sign in to SBG MUSIC"
        subtitle="Access your custom playlists, save favorites, and sync across devices."
      />

      {showCreateModal && (
        <CreatePlaylistModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newId) => {
            navigate(`/user-playlist/${newId}`);
          }}
        />
      )}
    </>
  );
}
