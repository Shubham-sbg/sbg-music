
import React, { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { submitPlaylist } from '../lib/communityPlaylistService';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubmitPlaylistModal({ onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    playlistName: '',
    playlistUrl: '',
    submitterName: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await submitPlaylist(formData);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to submit playlist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Submit Your Playlist</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>
        
        {error && <p className="text-red-400 text-xs">{error}</p>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            required 
            placeholder="Playlist Name" 
            className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white text-sm"
            onChange={e => setFormData({...formData, playlistName: e.target.value})}
          />
          <input 
            required 
            type="url"
            placeholder="YouTube Playlist URL" 
            className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white text-sm"
            onChange={e => setFormData({...formData, playlistUrl: e.target.value})}
          />
          <input 
            required 
            placeholder="Your Name" 
            className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white text-sm"
            onChange={e => setFormData({...formData, submitterName: e.target.value})}
          />
          <textarea 
            placeholder="Description (Optional)" 
            className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white text-sm"
            onChange={e => setFormData({...formData, description: e.target.value})}
          />
          
          <div className="p-3 bg-gradient-to-r from-purple-950/30 to-indigo-950/30 border border-purple-500/20 rounded-xl flex items-center gap-2.5 text-xs text-white/70">
            <Sparkles size={16} className="text-purple-400 shrink-0" />
            <span>Missing artwork? Unique album art will be auto-generated with AI if no thumbnail is available.</span>
          </div>

          <button 
            disabled={loading}
            className="w-full p-3 bg-white text-black rounded-xl font-bold text-sm flex justify-center items-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            Submit Playlist
          </button>
        </form>
      </div>
    </div>
  );
}
