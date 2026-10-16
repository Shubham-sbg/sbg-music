import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, 
  Sparkles, 
  Flame, 
  Mic, 
  ShieldCheck, 
  Headphones, 
  Clock, 
  Heart,
  ChevronRight 
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { FALLBACK_SONGS, FALLBACK_PLAYLISTS } from '../data/fallbackCatalog';
import { Song } from '../types';

export default function Home() {
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();

  const featuredTrack = FALLBACK_SONGS[0];

  return (
    <div className="space-y-10 pb-28">
      {/* Hero Showcase Banner */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-purple-900/60 via-[#13111f] to-[#0c0c12] border border-purple-500/20 p-6 sm:p-10 shadow-2xl shadow-purple-950/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 justify-between">
          <div className="space-y-4 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Studio Master Release 2026</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Pure Sound. <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                Uninterrupted Voice.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-white/60 leading-relaxed">
              Experience zero-dropout background streaming with custom studio DSP filters: crystal clear vocal boost, punchy bass, and instant offline buffering.
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <button
                onClick={() => playSong(featuredTrack, FALLBACK_SONGS)}
                className="px-6 py-3 rounded-2xl bg-white text-black font-extrabold text-sm hover:bg-white/90 shadow-xl shadow-white/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Play Featured Anthem</span>
              </button>

              <button
                onClick={() => navigate('/songs')}
                className="px-5 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white font-semibold text-sm transition-all cursor-pointer"
              >
                Browse Catalog
              </button>
            </div>
          </div>

          {/* Album artwork card */}
          <div className="relative shrink-0 group cursor-pointer" onClick={() => playSong(featuredTrack, FALLBACK_SONGS)}>
            <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-purple-950/60 relative">
              <img
                src={featuredTrack.coverUrl}
                alt={featuredTrack.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                <div>
                  <p className="text-white font-bold text-sm truncate">{featuredTrack.title}</p>
                  <p className="text-purple-300 text-xs truncate">{featuredTrack.artist}</p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-3 -right-3 w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-900/50 group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 fill-white ml-0.5" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid ("Voice Problem Fix & Stop Problem Fix") */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#111118] border border-white/[0.06] space-y-2">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Mic className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Vocal Boost Filter</h3>
          <p className="text-xs text-white/50 leading-relaxed">
            Peaking parametric EQ lifts singing and speech frequencies so lyrics and voice cut through the mix without distortion.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#111118] border border-white/[0.06] space-y-2">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Non-Stop Background Audio</h3>
          <p className="text-xs text-white/50 leading-relaxed">
            Engineered with HTTP Range caching and stall-recovery watchdogs to prevent lock screen pauses or background dropouts.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#111118] border border-white/[0.06] space-y-2">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Headphones className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Continuous Auto-Advance</h3>
          <p className="text-xs text-white/50 leading-relaxed">
            Seamless queue transitions automatically flow into the next track when a song finishes, with full MediaSession sync.
          </p>
        </div>
      </section>

      {/* Trending Now Songs */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-pink-500" />
            <h2 className="text-lg sm:text-xl font-bold text-white">Trending Hits</h2>
          </div>
          <button
            onClick={() => navigate('/songs')}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
          >
            <span>See All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FALLBACK_SONGS.slice(0, 6).map((song: Song) => {
            const isCurrent = currentSong?.id === song.id;
            const liked = isFavorite(song.id);

            return (
              <div
                key={song.id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 group cursor-pointer ${
                  isCurrent
                    ? 'bg-purple-900/20 border-purple-500/40'
                    : 'bg-[#111118] hover:bg-white/[0.04] border-white/[0.06]'
                }`}
                onClick={() => playSong(song, FALLBACK_SONGS)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                    <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 fill-white text-white" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h4 className={`text-xs sm:text-sm font-bold truncate ${isCurrent ? 'text-purple-300' : 'text-white'}`}>
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-white/50 truncate">{song.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono text-white/40 hidden sm:inline">
                    {Math.floor((song.duration || 0) / 60)}:{((song.duration || 0) % 60).toString().padStart(2, '0')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(song);
                    }}
                    className="p-1.5 text-white/30 hover:text-pink-500 transition-colors cursor-pointer"
                  >
                    <Heart className={`w-4 h-4 ${liked ? 'fill-pink-500 text-pink-500' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Curated Editorial Playlists */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white">Curated Soundtracks</h2>
          <button
            onClick={() => navigate('/playlists')}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FALLBACK_PLAYLISTS.map((pl) => (
            <div
              key={pl.id}
              onClick={() => navigate(`/playlist/${pl.id}`)}
              className="p-4 rounded-2xl bg-[#111118] hover:bg-white/[0.04] border border-white/[0.06] transition-all space-y-3 cursor-pointer group"
            >
              <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                <img src={pl.coverUrl} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white/80">
                  {pl.songCount} Tracks
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">{pl.title}</h3>
                <p className="text-xs text-white/50 line-clamp-2 mt-0.5 leading-relaxed">{pl.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
