import React from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import Player from './Player';
import OfflineBanner from './OfflineBanner';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0a0d] text-white flex flex-col font-sans">
      <Navigation />
      <OfflineBanner />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 pt-6 pb-24 lg:pl-68">
        <Outlet />
      </main>

      <Player />
    </div>
  );
}
