import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  RefreshCw, 
  CloudUpload, 
  CheckCircle, 
  Music, 
  Trash2, 
  Server,
  Activity
} from 'lucide-react';
import { FALLBACK_SONGS } from '../data/fallbackCatalog';
import { Song } from '../types';
import { getPendingSyncSummary, triggerImmediateSync, SyncCountSummary } from '../services/backgroundSyncService';

export default function Admin() {
  const [songs, setSongs] = useState<Song[]>(() => FALLBACK_SONGS);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState('Electronic');
  const [audioUrl, setAudioUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState<SyncCountSummary>({ analyticsCount: 0, playlistsCount: 0, total: 0 });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    getPendingSyncSummary().then(setPendingSync).catch(() => {});
  }, []);

  const handleAddSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return;

    const newSong: Song = {
      id: `admin-${Date.now()}`,
      title: title.trim(),
      artist: artist.trim(),
      genre,
      duration: 180,
      coverUrl: coverUrl.trim() || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
      audioUrl: audioUrl.trim() || FALLBACK_SONGS[0].audioUrl,
      source: 'catalog',
      plays: 1,
      likes: 0,
      releaseDate: '2026',
    };

    setSongs([newSong, ...songs]);
    setTitle('');
    setArtist('');
    setAudioUrl('');
    setCoverUrl('');
    setStatusMessage(`Track "${newSong.title}" added to catalog.`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await triggerImmediateSync('all');
    const summary = await getPendingSyncSummary();
    setPendingSync(summary);
    setIsSyncing(false);
    setStatusMessage('Background Sync triggered. Replayed all pending queues.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="space-y-8 pb-28">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-purple-400" />
          Admin & System Control
        </h1>
        <p className="text-xs text-white/50">Manage song releases, inspect Background Sync API, and monitor health</p>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-purple-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Background Sync Telemetry Card */}
      <div className="p-6 rounded-3xl bg-[#111118] border border-white/[0.06] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudUpload className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Background Sync API Telemetry</h2>
          </div>
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Force Flush Queues</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] uppercase font-bold text-white/40">Pending Analytics Events</p>
            <p className="text-xl font-black text-white mt-1">{pendingSync.analyticsCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] uppercase font-bold text-white/40">Pending Playlist Updates</p>
            <p className="text-xl font-black text-white mt-1">{pendingSync.playlistsCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[10px] uppercase font-bold text-white/40">Sync Status</p>
            <p className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Service Worker Active
            </p>
          </div>
        </div>
      </div>

      {/* Add Track Form */}
      <div className="p-6 rounded-3xl bg-[#111118] border border-white/[0.06] space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-purple-400" />
          Add Track to Catalog
        </h2>

        <form onSubmit={handleAddSong} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-white/50 mb-1">Song Title *</label>
            <input
              type="text"
              placeholder="e.g. Celestial Odyssey"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#181822] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-white/50 mb-1">Artist Name *</label>
            <input
              type="text"
              placeholder="e.g. SBG Sound Lab"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full bg-[#181822] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-white/50 mb-1">Genre</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-[#181822] border border-white/10 rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
            >
              <option value="Synthwave">Synthwave</option>
              <option value="Lo-Fi">Lo-Fi</option>
              <option value="Desi Hip-Hop">Desi Hip-Hop</option>
              <option value="Electronic">Electronic</option>
              <option value="Ambient">Ambient</option>
            </select>
          </div>

          <div>
            <label className="block text-white/50 mb-1">Direct Audio Stream URL</label>
            <input
              type="url"
              placeholder="https://... (defaults to royalty-free stream)"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              className="w-full bg-[#181822] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-white/50 mb-1">Cover Artwork URL</label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              className="w-full bg-[#181822] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
            />
          </div>

          <div className="sm:col-span-2 pt-2">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-900/30 transition-all cursor-pointer"
            >
              Save Track to Catalog
            </button>
          </div>
        </form>
      </div>

      {/* Catalog Listing */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-white">Current Catalog ({songs.length} tracks)</h2>
        <div className="bg-[#101016] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
          {songs.map((song) => (
            <div key={song.id} className="p-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <img src={song.coverUrl} alt={song.title} className="w-9 h-9 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">{song.title}</p>
                  <p className="text-white/40 truncate">{song.artist} • {song.genre}</p>
                </div>
              </div>
              <button
                onClick={() => setSongs(songs.filter((s) => s.id !== song.id))}
                className="p-1.5 text-white/30 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
