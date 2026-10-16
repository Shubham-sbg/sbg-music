import React, { useState, useEffect, useCallback } from 'react';
import {
  Music,
  Disc,
  Radio,
  Sparkles,
  Volume2,
  Sliders,
  ListMusic,
  Keyboard,
  Play,
  Pause,
  Shuffle,
  Repeat,
  Heart,
  Plus,
} from 'lucide-react';
import { Track, RepeatMode } from './types';
import { INITIAL_TRACKS } from './data/mockTracks';
import { audioEngine } from './utils/audioEngine';
import { StickyAudioPlayer } from './components/StickyAudioPlayer';
import { TrackList } from './components/TrackList';
import { QueueDrawer } from './components/QueueDrawer';
import { AudioVisualizer } from './components/AudioVisualizer';
import { formatTime } from './utils/formatTime';

export default function App() {
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(INITIAL_TRACKS[0]?.duration || 180);
  const [volume, setVolume] = useState<number>(0.8);
  const [prevVolume, setPrevVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [queue, setQueue] = useState<Track[]>(INITIAL_TRACKS);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [selectedGenre, setSelectedGenre] = useState<string>('All');

  const currentTrack = queue[currentTrackIndex] || tracks[0] || null;

  // Setup audio callbacks
  useEffect(() => {
    audioEngine.setCallbacks(
      (time) => {
        setCurrentTime(time);
      },
      () => {
        handleTrackEnded();
      }
    );
  }, [repeatMode, isShuffle, currentTrackIndex, queue]);

  // Handle Track Completion
  const handleTrackEnded = useCallback(() => {
    if (repeatMode === 'one' && currentTrack) {
      audioEngine.seek(0);
      audioEngine.resume();
      setCurrentTime(0);
      setIsPlaying(true);
      return;
    }

    if (currentTrackIndex < queue.length - 1) {
      handleNextTrack();
    } else if (repeatMode === 'all') {
      setCurrentTrackIndex(0);
      const nextSong = queue[0];
      if (nextSong) {
        setDuration(nextSong.duration);
        audioEngine.playTrack(nextSong, 0);
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [repeatMode, currentTrackIndex, queue, currentTrack]);

  // Play / Pause toggle
  const handlePlayPause = () => {
    if (!currentTrack) return;

    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      if (currentTime === 0) {
        audioEngine.playTrack(currentTrack, 0);
      } else {
        audioEngine.resume();
      }
      setIsPlaying(true);
    }
  };

  // Change Track
  const handleSelectTrack = (track: Track) => {
    const foundIndex = queue.findIndex((t) => t.id === track.id);
    let targetIndex = foundIndex;

    if (foundIndex === -1) {
      // Add to queue and select
      const newQueue = [...queue, track];
      setQueue(newQueue);
      targetIndex = newQueue.length - 1;
    }

    setCurrentTrackIndex(targetIndex);
    setDuration(track.duration);
    setCurrentTime(0);
    audioEngine.playTrack(track, 0);
    setIsPlaying(true);
  };

  // Next Track
  const handleNextTrack = () => {
    if (queue.length === 0) return;

    let nextIndex: number;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = (currentTrackIndex + 1) % queue.length;
    }

    setCurrentTrackIndex(nextIndex);
    const nextSong = queue[nextIndex];
    if (nextSong) {
      setDuration(nextSong.duration);
      setCurrentTime(0);
      audioEngine.playTrack(nextSong, 0);
      setIsPlaying(true);
    }
  };

  // Previous Track
  const handlePrevTrack = () => {
    // If more than 3 seconds into current track, restart current track
    if (currentTime > 3) {
      audioEngine.seek(0);
      setCurrentTime(0);
      return;
    }

    if (queue.length === 0) return;

    const prevIndex = (currentTrackIndex - 1 + queue.length) % queue.length;
    setCurrentTrackIndex(prevIndex);
    const prevSong = queue[prevIndex];
    if (prevSong) {
      setDuration(prevSong.duration);
      setCurrentTime(0);
      audioEngine.playTrack(prevSong, 0);
      setIsPlaying(true);
    }
  };

  // Seeking
  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
    audioEngine.seek(seconds);
  };

  // Volume
  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
    audioEngine.setVolume(clamped, clamped === 0);
  };

  // Mute toggle
  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      const restoreVol = prevVolume > 0 ? prevVolume : 0.5;
      setVolume(restoreVol);
      audioEngine.setVolume(restoreVol, false);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      audioEngine.setVolume(volume, true);
    }
  };

  // Shuffle toggle
  const handleToggleShuffle = () => {
    setIsShuffle(!isShuffle);
  };

  // Repeat toggle (cycle: off -> all -> one)
  const handleToggleRepeat = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  // Favorite toggle
  const handleToggleLike = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isLiked: !t.isLiked } : t))
    );
    setQueue((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isLiked: !t.isLiked } : t))
    );
  };

  // Queue actions
  const handleAddToQueue = (track: Track) => {
    setQueue((prev) => [...prev, track]);
  };

  const handleRemoveFromQueue = (index: number) => {
    setQueue((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (index === currentTrackIndex && updated.length > 0) {
        const nextIdx = Math.min(index, updated.length - 1);
        setCurrentTrackIndex(nextIdx);
        setDuration(updated[nextIdx].duration);
      }
      return updated;
    });
  };

  const handleClearQueue = () => {
    if (currentTrack) {
      setQueue([currentTrack]);
      setCurrentTrackIndex(0);
    } else {
      setQueue([]);
    }
  };

  // Genre filter
  const genres = ['All', 'Cinematic Bass', 'Synthwave', 'Cyberpunk Bass', 'Chill Lo-Fi', 'Trap & Bass', 'Esports Hype'];
  const filteredTracks = selectedGenre === 'All'
    ? tracks
    : tracks.filter((t) => t.genre === selectedGenre);

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 pb-32">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#09090b]/80 backdrop-blur-md border-b border-neutral-800/60 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-neutral-950 font-black shadow-md shadow-amber-500/20">
            <Music className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              SBG MUSIC
              <span className="text-[10px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                PRO PLAYER
              </span>
            </h1>
            <p className="text-[11px] text-neutral-400">#EveryMoveMatters · Audio Streaming Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsQueueOpen(!isQueueOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors"
          >
            <ListMusic className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Play Queue</span>
            <span className="px-1.5 py-0.2 bg-neutral-800 rounded-full text-[10px] text-neutral-300">
              {queue.length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-8">
        
        {/* Hero Featured Release Card */}
        {currentTrack && (
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-amber-950/30 border border-neutral-800/80 p-6 sm:p-8 shadow-2xl">
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                {/* Vinyl/Artwork */}
                <div className="relative group w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 shrink-0">
                  <img
                    src={currentTrack.artwork}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <AudioVisualizer isPlaying={isPlaying} barCount={12} className="h-8 flex items-end gap-1" />
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    <span>NOW ACTIVE IN ENGINE</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {currentTrack.title}
                  </h2>
                  <p className="text-base text-neutral-300 font-medium">
                    {currentTrack.artist} <span className="text-neutral-600">·</span> <span className="text-neutral-400">{currentTrack.album}</span>
                  </p>
                  <div className="flex items-center gap-3 pt-2 text-xs text-neutral-400">
                    <span>Genre: <strong className="text-neutral-200">{currentTrack.genre}</strong></span>
                    <span>·</span>
                    <span>Duration: <strong className="font-mono text-neutral-200">{formatTime(currentTrack.duration)}</strong></span>
                  </div>

                  <div className="pt-3 flex items-center gap-3">
                    <button
                      onClick={handlePlayPause}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-102 active:scale-98 transition-transform"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4 fill-current" />
                          <span>Pause Audio</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>Resume Audio</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleToggleLike(currentTrack.id)}
                      className={`p-2.5 rounded-xl border transition-colors ${currentTrack.isLiked ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-neutral-400 border-neutral-800 bg-neutral-900/60 hover:text-white'}`}
                      aria-label="Favorite Track"
                    >
                      <Heart className={`w-4 h-4 ${currentTrack.isLiked ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Mini Status Card */}
              <div className="w-full md:w-64 p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-3 text-xs">
                <div className="flex items-center justify-between text-neutral-400 font-semibold border-b border-neutral-800 pb-2">
                  <span>Player Status</span>
                  <span className="font-mono text-amber-400">{isPlaying ? 'PLAYING' : 'PAUSED'}</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Volume:</span>
                  <span className="font-mono text-neutral-200">{isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Repeat Mode:</span>
                  <span className="capitalize text-neutral-200">{repeatMode}</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Shuffle Mode:</span>
                  <span className="text-neutral-200">{isShuffle ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Keyboard Shortcuts Hint Bar */}
        <section className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-neutral-300">Keyboard Shortcuts:</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 font-mono text-[10px]">Space</kbd>
              <span>Play/Pause</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 font-mono text-[10px]">M</kbd>
              <span>Mute</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 font-mono text-[10px]">← / →</kbd>
              <span>Seek ±5s</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 font-mono text-[10px]">↑ / ↓</kbd>
              <span>Volume ±5%</span>
            </div>
          </div>
        </section>

        {/* Music Catalog Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Audio Catalog</h3>
              <p className="text-xs text-neutral-400">High-bitrate studio audio engineered for gameplay and streaming</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGenre(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${selectedGenre === g ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-neutral-950 border border-neutral-800/80 rounded-2xl p-2 sm:p-4 shadow-xl">
            <TrackList
              tracks={filteredTracks}
              currentTrackId={currentTrack?.id || null}
              isPlaying={isPlaying}
              onSelectTrack={handleSelectTrack}
              onTogglePlayPause={handlePlayPause}
              onToggleLike={handleToggleLike}
              onAddToQueue={handleAddToQueue}
            />
          </div>
        </section>

      </main>

      {/* Up Next Play Queue Drawer */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        queue={queue}
        currentTrackId={currentTrack?.id || null}
        onSelectTrack={handleSelectTrack}
        onRemoveTrack={handleRemoveFromQueue}
        onClearQueue={handleClearQueue}
      />

      {/* Sticky Bottom Audio Player Component */}
      <StickyAudioPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        repeatMode={repeatMode}
        isShuffle={isShuffle}
        queue={queue}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onToggleLike={handleToggleLike}
        onOpenQueue={() => setIsQueueOpen(!isQueueOpen)}
        isQueueOpen={isQueueOpen}
      />
    </div>
  );
}
