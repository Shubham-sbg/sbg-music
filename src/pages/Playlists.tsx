import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Plus, ListMusic, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { usePaginatedPlaylists } from '../hooks/useCatalog';
import { Playlist } from '../types';

export default function Playlists() {
  const navigate = useNavigate();
  const { playlists, loading, errorMsg, refetch } = usePaginatedPlaylists(50);

  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>(() => {
    try {
      const stored = localStorage.getItem('sbg_user_custom_playlists');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [newTitle, setNewTitle] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newPl: Playlist = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      name: newTitle.trim(),
      description: 'Custom user playlist',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
      songCount: 0,
      songs: [],
      createdAt: Date.now(),
    };

    const updated = [newPl, ...userPlaylists];
    setUserPlaylists(updated);
    localStorage.setItem('sbg_user_custom_playlists', JSON.stringify(updated));
    setNewTitle('');
    setShowCreateModal(false);
  };

  // Combine Firestore playlists and user local playlists, deduplicating by ID
  const allPlaylists = useMemo(() => {
    const map = new Map<string, Playlist>();
    // User playlists first
    userPlaylists.forEach((p) => map.set(p.id, p));
    // Firestore playlists
    playlists.forEach((p) => {
      if (!map.has(p.id)) {
        map.set(p.id, p);
      }
    });
    return Array.from(map.values());
  }, [playlists, userPlaylists]);

  return (
    <div className="space-y-6 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white">Playlists</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
              {loading && allPlaylists.length === 0 ? 'Loading...' : `${allPlaylists.length} Playlists`}
            </span>
          </div>
          <p className="text-xs text-white/50 mt-1">Official SBG collections, community compilations, and personal playlists</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-900/40 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {errorMsg && allPlaylists.length === 0 && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/20 flex items-center justify-between gap-3 text-red-200 text-xs">
          <span>{errorMsg}</span>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-800/40 hover:bg-red-800/60 font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {loading && allPlaylists.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-white/40">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          <p className="text-xs">Loading playlists...</p>
        </div>
      ) : allPlaylists.length === 0 ? (
        <div className="p-16 text-center text-white/40 text-xs space-y-2">
          <ListMusic className="w-8 h-8 mx-auto text-white/20 mb-2" />
          <p className="font-semibold text-white/70">No playlists available</p>
          <p>Create your first custom playlist above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {allPlaylists.map((pl) => {
            const trackCount = pl.songCount || pl.songIds?.length || pl.songs?.length || 0;
            return (
              <div
                key={pl.id}
                onClick={() => navigate(`/playlist/${pl.id}`)}
                className="p-4 rounded-2xl bg-[#111118] hover:bg-white/[0.04] border border-white/[0.06] transition-all space-y-3 cursor-pointer group"
              >
                <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5">
                  <img 
                    src={pl.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80'} 
                    alt={pl.title || pl.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-mono text-white/80">
                    {trackCount} tracks
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-1">
                    {pl.title || pl.name}
                  </h3>
                  <p className="text-xs text-white/50 line-clamp-1 mt-0.5">
                    {pl.description || `${trackCount} tracks`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121a] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-white">Create New Playlist</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="text"
                placeholder="Playlist name..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-[#181824] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
