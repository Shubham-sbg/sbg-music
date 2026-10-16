import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import SBGMusicLogo from './SBGMusicLogo';
import { LogOut, ExternalLink, ShieldCheck } from 'lucide-react';

/**
 * Dedicated Layout for Admin & Staff Portal (/admin, /staff)
 * Completely isolated from the Public User Website.
 * NEVER renders the public navigation, public search, public user "Sign In" button, or public music player.
 */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAuthorizedStaffOrAdmin = user && (user.role === 'owner' || user.role === 'admin' || user.role === 'staff');

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* 1. DEDICATED ADMIN TOP BAR */}
      <header className="px-4 md:px-8 py-3.5 border-b border-white/5 bg-[#0d0d10]/95 sticky top-0 z-40 backdrop-blur-xl flex items-center justify-between">
        {/* Left: Branding & Portal Badge */}
        <div className="flex items-center gap-3">
          <Link to="/sbgadmin" className="flex items-center gap-2.5 group">
            <SBGMusicLogo variant="icon" size="sm" clickable={false} />
            <span className="font-bold tracking-tight text-white text-base group-hover:text-white/90 transition-colors">
              SBG MUSIC
            </span>
          </Link>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase text-white/60 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
            <ShieldCheck size={12} className="text-purple-400" />
            <span>Staff & Admin Portal</span>
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Link back to public listener website */}
          <Link
            to="/"
            className="text-xs font-semibold text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
            title="Switch to Public Music Player"
          >
            <span>Public Site</span>
            <ExternalLink size={12} />
          </Link>

          {/* If authenticated with Admin/Staff role, show session badge and logout */}
          {isAuthorizedStaffOrAdmin && (
            <div className="flex items-center gap-3 pl-3 border-l border-white/10">
              <div className="flex items-center gap-2">
                <div 
                  className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center border ${
                    user.role === 'owner'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : user.role === 'admin'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {user.displayName?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="hidden md:flex flex-col">
                  <span className="text-xs font-semibold text-white leading-none">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] font-mono text-white/40 uppercase leading-tight mt-0.5">
                    {user.role}
                  </span>
                </div>
              </div>

              <button
                onClick={async () => {
                  await logout();
                  navigate('/sbgadmin');
                }}
                className="p-1.5 text-white/40 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                title="Sign Out of Admin Portal"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. ADMIN MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
