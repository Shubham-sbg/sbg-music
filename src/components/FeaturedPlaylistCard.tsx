
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { CommunityPlaylist } from '../types';

export default function FeaturedPlaylistCard({ playlist }: { playlist: CommunityPlaylist }) {
  return (
    <div className="bg-[#111112] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 shadow-lg hover:border-purple-500/30 transition-all">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900">
        <img src={playlist.thumbnailUrl || '/fallback-playlist.jpg'} alt={playlist.playlistName} className="w-full h-full object-cover" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-white truncate">{playlist.playlistName}</h3>
        <p className="text-xs text-white/50">By {playlist.submitterName}</p>
        <p className="text-xs text-white/70 mt-2 line-clamp-2">{playlist.description}</p>
      </div>
      <a 
        href={playlist.playlistUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="mt-auto w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-bold flex justify-center items-center gap-2 hover:bg-white/10"
      >
        Visit Playlist <ExternalLink size={14} />
      </a>
    </div>
  );
}
