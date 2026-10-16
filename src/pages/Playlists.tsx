import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Plus, ListMusic, Sparkles } from 'lucide-react';
import { FALLBACK_PLAYLISTS } from '../data/fallbackCatalog';
import { usePlayer } from '../context/PlayerContext';
import { Playlist } from '../types';

export default function Playlists() {
  const navigate = useNavigate();
  const { playSong } = usePlayer();
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

  const allPlaylists = [...FALLBACK_PLAYLISTS, ...userPlaylists];

  return (
    <div className="space-y-6 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Playlists</h1>
          <p className="text-xs text-white/50">Curated collections and personal soundscapes</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-900/40 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {allPlaylists.map((pl) => (
          <div
            key={pl.id}
            onClick={() => navigate(`/playlist/${pl.id}`)}
            className="p-4 rounded-2xl bg-[#111118] hover:bg-white/[0.04] border border-white/[0.06] transition-all space-y-3 cursor-pointer group"
          >
            <div className="relative aspect-video rounded-xl overflow-hidden">
              <img src={pl.coverUrl} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg">
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">{pl.title}</h3>
              <p className="text-xs text-white/50 line-clamp-1 mt-0.5">{pl.description || `${pl.songCount || 0} tracks`}</p>
            </div>
          </div>
        ))}
      </div>

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
                className="w-full bg-[#181824] border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-purple-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 text-white/70 text-xs font-semibold hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
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
