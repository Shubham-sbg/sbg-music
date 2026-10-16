import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CommunityPlaylist, FeaturedConfig } from '../types';
import { Check, X, Trash2, Star, Edit, Save, Eye, EyeOff } from 'lucide-react';
import { getFeaturedConfig, saveFeaturedConfig } from '../lib/featured';

export default function AdminCommunityPlaylists() {
  const [playlists, setPlaylists] = useState<CommunityPlaylist[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CommunityPlaylist>>({});
  
  const [featuredConfig, setFeaturedConfig] = useState<FeaturedConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'community_playlists'));
    return onSnapshot(
      q,
      (snap) => {
        setPlaylists(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommunityPlaylist)));
      },
      (err) => {
        console.warn('[AdminCommunityPlaylists] Snapshot listener note:', err?.message || err);
      }
    );
  }, []);

  useEffect(() => {
    getFeaturedConfig().then(setConfig => {
      setFeaturedConfig(setConfig);
    }).catch(console.error);
  }, []);

  const toggleHomeVisibility = async () => {
    if (!featuredConfig) return;
    setSavingConfig(true);
    const updated = {
      ...featuredConfig,
      showCommunityPlaylistsOnHome: !featuredConfig.showCommunityPlaylistsOnHome
    };
    try {
      await saveFeaturedConfig(updated);
      setFeaturedConfig(updated);
    } catch (e) {
      console.error(e);
      alert('Failed to save config');
    } finally {
      setSavingConfig(false);
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected' | 'pending') => {
    await updateDoc(doc(db, 'community_playlists', id), { status });
  };

  const toggleFeatured = async (id: string, featured: boolean) => {
    await updateDoc(doc(db, 'community_playlists', id), { featured });
  };

  const deletePlaylist = async (id: string) => {
    if (confirm('Are you sure you want to delete this submission?')) {
      await deleteDoc(doc(db, 'community_playlists', id));
    }
  };

  const startEdit = (pl: CommunityPlaylist) => {
    setEditingId(pl.id);
    setEditForm({
      playlistName: pl.playlistName,
      submitterName: pl.submitterName,
      description: pl.description || '',
      playlistUrl: pl.playlistUrl,
      displayOrder: pl.displayOrder || 0
    });
  };

  const saveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'community_playlists', id), editForm);
      setEditingId(null);
    } catch (e) {
      console.error('Failed to update', e);
      alert('Update failed');
    }
  };

  const handleOrderChange = async (id: string, newOrder: number) => {
    try {
      await updateDoc(doc(db, 'community_playlists', id), { displayOrder: newOrder });
    } catch (e) {
      console.error('Failed to update order', e);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Community Playlist Submissions</h2>
        {featuredConfig && (
          <button
            onClick={toggleHomeVisibility}
            disabled={savingConfig}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
              featuredConfig.showCommunityPlaylistsOnHome 
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30'
                : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            {featuredConfig.showCommunityPlaylistsOnHome ? <Eye size={16} /> : <EyeOff size={16} />}
            {featuredConfig.showCommunityPlaylistsOnHome ? 'Shown on Home' : 'Hidden from Home'}
          </button>
        )}
      </div>
      <div className="space-y-4">
        {playlists.length === 0 ? (
          <p className="text-white/40 text-sm">No submissions found.</p>
        ) : (
          playlists.map(pl => (
            <div key={pl.id} className="bg-[#111112] p-4 rounded-xl flex flex-col md:flex-row md:items-start justify-between border border-white/5 gap-4">
              
              {editingId === pl.id ? (
                <div className="flex-1 space-y-3">
                  <input
                    value={editForm.playlistName}
                    onChange={e => setEditForm({ ...editForm, playlistName: e.target.value })}
                    className="w-full p-2 bg-black/60 border border-white/10 rounded text-sm text-white"
                    placeholder="Playlist Name"
                  />
                  <input
                    value={editForm.submitterName}
                    onChange={e => setEditForm({ ...editForm, submitterName: e.target.value })}
                    className="w-full p-2 bg-black/60 border border-white/10 rounded text-sm text-white"
                    placeholder="Submitter Name"
                  />
                  <input
                    value={editForm.playlistUrl}
                    onChange={e => setEditForm({ ...editForm, playlistUrl: e.target.value })}
                    className="w-full p-2 bg-black/60 border border-white/10 rounded text-sm text-white"
                    placeholder="Playlist URL"
                  />
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full p-2 bg-black/60 border border-white/10 rounded text-sm text-white"
                    placeholder="Description"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(pl.id)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded text-xs font-bold hover:bg-emerald-600"><Save size={14}/> Save</button>
                    <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 bg-white/10 text-white rounded text-xs font-bold hover:bg-white/20"><X size={14}/> Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-bold text-lg">{pl.playlistName}</h3>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${pl.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : pl.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {pl.status}
                    </span>
                    {pl.featured && <span className="bg-purple-500/20 text-purple-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={10}/> Featured</span>}
                  </div>
                  <p className="text-sm text-white/70 mt-1">Submitted by: <span className="text-white">{pl.submitterName}</span></p>
                  {pl.description && <p className="text-xs text-white/50 mt-2 max-w-2xl">{pl.description}</p>}
                  <a href={pl.playlistUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-2 inline-block truncate max-w-full">
                    {pl.playlistUrl}
                  </a>
                  
                  {pl.status === 'approved' && pl.featured && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-white/40">Display Order:</span>
                      <input 
                        type="number" 
                        value={pl.displayOrder || 0}
                        onChange={(e) => handleOrderChange(pl.id, parseInt(e.target.value) || 0)}
                        className="w-16 p-1 bg-black border border-white/10 rounded text-xs text-white"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {!editingId && (
                <div className="flex flex-wrap gap-2 md:flex-col shrink-0">
                  {pl.status === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(pl.id, 'approved')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold transition-colors">
                        <Check size={14}/> Approve
                      </button>
                      <button onClick={() => updateStatus(pl.id, 'rejected')} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors">
                        <X size={14}/> Reject
                      </button>
                    </>
                  )}
                  {pl.status !== 'pending' && (
                    <button onClick={() => updateStatus(pl.id, 'pending')} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold transition-colors">
                      Move to Pending
                    </button>
                  )}
                  
                  {pl.status === 'approved' && (
                    <button onClick={() => toggleFeatured(pl.id, !pl.featured)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${pl.featured ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
                      <Star size={14} className={pl.featured ? "fill-purple-400" : ""} /> {pl.featured ? 'Unfeature' : 'Feature'}
                    </button>
                  )}

                  <button onClick={() => startEdit(pl)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-bold transition-colors">
                    <Edit size={14}/> Edit
                  </button>

                  <button onClick={() => deletePlaylist(pl.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors mt-auto">
                    <Trash2 size={14}/> Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
