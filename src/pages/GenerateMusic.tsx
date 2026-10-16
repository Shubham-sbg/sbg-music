import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationVisibility } from '../lib/navigationSettings';
import { 
  Sparkles, 
  Music, 
  Play, 
  Pause, 
  Download, 
  Plus, 
  RefreshCw, 
  Sliders, 
  Volume2, 
  Check, 
  Clock, 
  HardDrive, 
  Radio, 
  Flame, 
  Layers, 
  Heart,
  ChevronRight,
  Disc,
  Library,
  Zap,
  Info
} from 'lucide-react';
import { 
  synthesizeMusicTrack, 
  convertGeneratedToSong, 
  GeneratedTrackResult, 
  MusicGenerationParams 
} from '../services/musicGenerationEngine';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthProvider';
import { addToUserLibrary } from '../services/libraryService';
import { OfflineDownloadService } from '../services/offlineDownloadService';
import { addToSbgCatalog } from '../services/catalogService';
import { 
  getUserWeeklyQuota, 
  recordGeneration, 
  subscribeToQuota, 
  UserQuotaInfo, 
  MAX_WEEKLY_GENERATIONS 
} from '../services/aiQuotaService';

interface PromptPreset {
  label: string;
  genre: 'lofi' | 'synthwave' | 'hiphop' | 'cinematic' | 'edm' | 'ambient' | 'gaming';
  prompt: string;
  duration: number;
  bpm: number;
}

const PRESETS: PromptPreset[] = [
  {
    label: '🎧 Lo-Fi Chill Study',
    genre: 'lofi',
    prompt: 'Mellow Rhodes piano chords with relaxing vinyl crackle and chill hip-hop beat',
    duration: 30,
    bpm: 75,
  },
  {
    label: '⚡ Cyberpunk Neon Drive',
    genre: 'synthwave',
    prompt: '80s retro synthwave with driving sawtooth bass, neon arpeggiator, and retro drums',
    duration: 30,
    bpm: 110,
  },
  {
    label: '🏆 SBG Esports Anthem',
    genre: 'gaming',
    prompt: 'High energy gaming battle theme with dramatic electronic synth lead and driving drop',
    duration: 30,
    bpm: 135,
  },
  {
    label: '🎹 Dark 808 Trap Beat',
    genre: 'hiphop',
    prompt: 'Punchy 808 sub bass, crisp rolling hi-hats, and melodic bell leads',
    duration: 30,
    bpm: 90,
  },
  {
    label: '🌌 Cinematic Epic Swell',
    genre: 'cinematic',
    prompt: 'Dramatic cinematic orchestral swell with deep bass drums and majestic harmony',
    duration: 45,
    bpm: 80,
  },
  {
    label: '🧘 Zen Ambient Healing',
    genre: 'ambient',
    prompt: 'Floating ambient synth pads with peaceful harmonic chords and serene soundscapes',
    duration: 30,
    bpm: 65,
  },
];

export default function GenerateMusic() {
  const navigate = useNavigate();
  const { settings } = useNavigationVisibility();
  const { playSong, currentSong, isPlaying: globalPlaying } = usePlayer();
  const { user } = useAuth();

  useEffect(() => {
    if (settings.showAiStudio === false) {
      navigate('/', { replace: true });
    }
  }, [settings.showAiStudio, navigate]);

  if (settings.showAiStudio === false) {
    return null;
  }

  // Generator State
  const [prompt, setPrompt] = useState('Mellow Rhodes piano chords with relaxing vinyl crackle and chill hip-hop beat');
  const [genre, setGenre] = useState<'lofi' | 'synthwave' | 'hiphop' | 'cinematic' | 'edm' | 'ambient' | 'gaming'>('lofi');
  const [duration, setDuration] = useState<number>(30);
  const [bpm, setBpm] = useState<number>(75);
  const [modelMode, setModelMode] = useState<'free' | 'lyria-clip' | 'lyria-pro'>('free');

  // Generation Progress
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStep, setProgressStep] = useState('');

  // Results
  const [currentTrack, setCurrentTrack] = useState<GeneratedTrackResult | null>(null);
  const [history, setHistory] = useState<GeneratedTrackResult[]>([]);
  
  // Local Audio Player
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingLocal, setIsPlayingLocal] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Action Feedbacks
  const [librarySaved, setLibrarySaved] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [catalogSaved, setCatalogSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Quota & Weekly Limit (Max 5/week per user)
  const [quota, setQuota] = useState<UserQuotaInfo>({
    used: 0,
    max: MAX_WEEKLY_GENERATIONS,
    remaining: MAX_WEEKLY_GENERATIONS,
    resetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    resetsInText: '7d remaining',
    isLimitReached: false,
  });
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  // Subscribe to real-time quota updates
  useEffect(() => {
    getUserWeeklyQuota(user?.uid).then((q) => setQuota(q));
    const unsubscribe = subscribeToQuota(user?.uid, (q) => {
      setQuota(q);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Apply preset
  const handleSelectPreset = (p: PromptPreset) => {
    setPrompt(p.prompt);
    setGenre(p.genre);
    setDuration(p.duration);
    setBpm(p.bpm);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    // Check weekly quota limit (Max 5/week per user)
    if (quota.isLimitReached || quota.remaining <= 0) {
      setShowQuotaModal(true);
      setStatusMessage(`Weekly limit reached (${quota.used}/${quota.max} used). Resets in ${quota.resetsInText}.`);
      return;
    }

    setIsGenerating(true);
    setProgressPercent(5);
    setProgressStep('Connecting to AI Music Studio...');
    setLibrarySaved(false);
    setOfflineSaved(false);
    setCatalogSaved(false);

    try {
      // 1. Try server endpoint first (handles Lyria if configured, or free Gemini 3.8 composition)
      let generatedResult: GeneratedTrackResult | null = null;

      try {
        const response = await fetch('/api/music/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            genre,
            durationSeconds: duration,
            requestedModel: modelMode === 'free' ? 'free-ai' : (modelMode === 'lyria-pro' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview'),
          }),
        });

        const data = await response.json();

        if (data.ok && data.source === 'lyria-api' && data.audioBase64) {
          // Lyria API provided direct audio
          const binary = atob(data.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
          const audioUrl = URL.createObjectURL(blob);

          generatedResult = {
            id: `lyria_${Date.now()}`,
            title: prompt.slice(0, 30),
            artist: 'Google Lyria AI',
            genre: genre.toUpperCase(),
            durationSeconds: duration,
            audioBlob: blob,
            audioUrl,
            bpm,
            lyrics: data.lyrics,
            generatedAt: Date.now(),
            modelUsed: data.model || 'Google Lyria',
          };
        }
      } catch (serverErr) {
        console.warn('Server generation notice, switching to client polyphonic synthesis:', serverErr);
      }

      // 2. Free High-Fidelity Polyphonic Synthesis Engine
      if (!generatedResult) {
        generatedResult = await synthesizeMusicTrack(
          {
            prompt,
            genre,
            durationSeconds: duration,
            bpm,
            includeDrums: true,
          },
          (pct, step) => {
            setProgressPercent(pct);
            setProgressStep(step);
          }
        );
      }

      setCurrentTrack(generatedResult);
      setHistory((prev) => [generatedResult!, ...prev]);

      // Deduct from weekly quota and sync count
      try {
        const freshQuota = await recordGeneration(user?.uid);
        setQuota(freshQuota);
      } catch (e) {
        console.warn('Quota sync warning:', e);
      }

      setStatusMessage(`Generated "${generatedResult.title}" successfully! (${quota.remaining - 1} generations left this week)`);
      setTimeout(() => setStatusMessage(null), 4000);

      // Preload in local audio element
      if (audioRef.current) {
        audioRef.current.src = generatedResult.audioUrl;
        audioRef.current.play().then(() => setIsPlayingLocal(true)).catch(() => {});
      }
    } catch (err: any) {
      console.error('Music generation failed:', err);
      setStatusMessage(err?.message || 'Music generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
      setProgressPercent(0);
    }
  };

  // Local Playback Controls
  const togglePlayLocal = () => {
    if (!audioRef.current) return;
    if (isPlayingLocal) {
      audioRef.current.pause();
      setIsPlayingLocal(false);
    } else {
      audioRef.current.play().then(() => setIsPlayingLocal(true)).catch(() => {});
    }
  };

  // Global SBG Player Queue Load
  const handlePlayInSbgPlayer = () => {
    if (!currentTrack) return;
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingLocal(false);
    }
    const song = convertGeneratedToSong(currentTrack);
    playSong(song, [song], undefined, 0, 'AI Music Studio');
  };

  // Save to Library
  const handleSaveToLibrary = async () => {
    if (!currentTrack || !user?.uid) return;
    try {
      const song = convertGeneratedToSong(currentTrack);
      await addToUserLibrary(user.uid, song);
      setLibrarySaved(true);
      setStatusMessage('Saved to your SBG Library!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // Save to Offline Storage
  const handleSaveOffline = async () => {
    if (!currentTrack) return;
    try {
      const song = convertGeneratedToSong(currentTrack);
      await OfflineDownloadService.enqueueDownload(song);
      setOfflineSaved(true);
      setStatusMessage('Saved to Offline Downloads!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // Download WAV file
  const handleDownloadWav = () => {
    if (!currentTrack) return;
    const a = document.createElement('a');
    a.href = currentTrack.audioUrl;
    a.download = `${currentTrack.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatusMessage('Downloaded WAV track to your device.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Hidden local audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setAudioDuration(audioRef.current.duration || 0);
          }
        }}
        onEnded={() => setIsPlayingLocal(false)}
      />

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-black border border-purple-500/20 p-6 sm:p-10 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles size={14} className="text-purple-400" />
            <span>AI Music Studio • Free Tier Enabled</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Create Custom Tracks & Beats with AI
          </h1>
          <p className="text-sm sm:text-base text-white/70 leading-relaxed">
            Generate original, high-quality music instantly. Choose from Lo-Fi, Synthwave, Hip-Hop, Orchestral, or Gaming beats. No paid subscriptions or API keys required.
          </p>
        </div>

        {/* Decorative Glow */}
        <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Status feedback toast */}
      {statusMessage && (
        <div className="px-4 py-3 bg-purple-600/20 border border-purple-500/40 text-purple-200 text-xs sm:text-sm font-semibold rounded-2xl flex items-center gap-2 animate-fadeIn shadow-lg">
          <Check size={16} className="text-purple-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Controls & Prompt (7 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Weekly Free Quota Status Card */}
          <div className="bg-gradient-to-r from-purple-950/30 via-[#131219] to-indigo-950/20 border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <Flame size={16} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <span>Weekly Free Allowance</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                      {quota.remaining} / {quota.max} Left
                    </span>
                  </h3>
                  <p className="text-[11px] text-white/50">
                    Limit: 5 AI music generations per week per user
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-white/70 font-mono bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 w-fit">
                <Clock size={13} className="text-purple-400" />
                <span>Resets: {quota.resetsInText}</span>
              </div>
            </div>

            {/* 5-Step Segmented Quota Dots */}
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: quota.max }).map((_, idx) => {
                  const isConsumed = idx < quota.used;
                  return (
                    <div
                      key={idx}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        isConsumed
                          ? 'bg-zinc-700/60 border border-white/5'
                          : 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                      }`}
                      title={isConsumed ? `Track #${idx + 1} Generated` : `Available Track Slot #${idx + 1}`}
                    />
                  );
                })}
              </div>

              <div className="flex justify-between text-[10px] text-white/40 pt-0.5">
                <span>{quota.used} / {quota.max} used</span>
                <span>{quota.remaining} remaining this week</span>
              </div>
            </div>

            {quota.isLimitReached && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-fadeIn">
                <Info size={14} className="shrink-0" />
                <span>You've reached your free weekly allowance of 5 tracks. Next generation available in {quota.resetsInText}.</span>
              </div>
            )}
          </div>
          
          {/* Prompt Presets */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={14} className="text-yellow-400" />
              Quick Inspiration Presets
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectPreset(p)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 rounded-xl text-xs font-medium text-white/80 hover:text-white transition-all active:scale-95"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Text Input */}
          <div className="space-y-2 bg-[#101014] border border-white/10 rounded-2xl p-5 shadow-xl">
            <label className="text-xs font-bold text-white flex items-center justify-between">
              <span>Track Prompt & Musical Style</span>
              <span className="text-white/40 text-[11px]">Be descriptive</span>
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Mellow lo-fi beats with relaxing piano chords and gentle vinyl texture..."
              className="w-full bg-black/40 border border-white/10 focus:border-purple-500 rounded-xl p-3.5 text-sm text-white placeholder-white/30 outline-none transition-all resize-none"
            />
          </div>

          {/* Genre Selection Chips */}
          <div className="space-y-2 bg-[#101014] border border-white/10 rounded-2xl p-5 shadow-xl">
            <label className="text-xs font-bold text-white block">Select Musical Genre</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'lofi', name: 'Lo-Fi Chill', icon: '🎧' },
                { id: 'synthwave', name: 'Synthwave', icon: '⚡' },
                { id: 'gaming', name: 'Gaming / SBG', icon: '🎮' },
                { id: 'hiphop', name: '808 Trap', icon: '🎹' },
                { id: 'cinematic', name: 'Cinematic', icon: '🌌' },
                { id: 'edm', name: 'EDM / Dance', icon: '🎛️' },
                { id: 'ambient', name: 'Ambient', icon: '🧘' },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setGenre(g.id as any);
                    if (g.id === 'lofi') setBpm(75);
                    if (g.id === 'synthwave') setBpm(110);
                    if (g.id === 'gaming') setBpm(135);
                    if (g.id === 'hiphop') setBpm(90);
                    if (g.id === 'cinematic') setBpm(80);
                    if (g.id === 'edm') setBpm(128);
                    if (g.id === 'ambient') setBpm(65);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                    genre === g.id
                      ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-md'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-base">{g.icon}</span>
                  <span className="truncate">{g.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Audio Parameters: Duration & Tempo (BPM) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Duration Selector */}
            <div className="bg-[#101014] border border-white/10 rounded-2xl p-4 space-y-2">
              <label className="text-xs font-bold text-white flex items-center justify-between">
                <span>Duration</span>
                <span className="text-purple-400 font-mono">{duration}s</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[15, 30, 45, 60].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      duration === d
                        ? 'bg-purple-600 text-white border-purple-500 shadow'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {/* Tempo BPM Slider */}
            <div className="bg-[#101014] border border-white/10 rounded-2xl p-4 space-y-2">
              <label className="text-xs font-bold text-white flex items-center justify-between">
                <span>Tempo</span>
                <span className="text-purple-400 font-mono">{bpm} BPM</span>
              </label>
              <input
                type="range"
                min={60}
                max={150}
                step={1}
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value, 10))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-white/40">
                <span>60 Slow</span>
                <span>100 Mid</span>
                <span>150 Fast</span>
              </div>
            </div>
          </div>

          {/* Engine Mode */}
          <div className="bg-[#101014] border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span className="flex items-center gap-1.5">
                <Sliders size={14} className="text-purple-400" />
                Generation Engine
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">Free Forever</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setModelMode('free')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                  modelMode === 'free'
                    ? 'bg-purple-600/30 border-purple-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                Free Synth Engine
                <span className="block text-[10px] font-normal text-emerald-400 mt-0.5">Unlimited</span>
              </button>
              <button
                onClick={() => setModelMode('lyria-clip')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                  modelMode === 'lyria-clip'
                    ? 'bg-purple-600/30 border-purple-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                Lyria Clip (30s)
                <span className="block text-[10px] font-normal text-white/40 mt-0.5">Auto-fallback</span>
              </button>
              <button
                onClick={() => setModelMode('lyria-pro')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                  modelMode === 'lyria-pro'
                    ? 'bg-purple-600/30 border-purple-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                Lyria Pro (Full)
                <span className="block text-[10px] font-normal text-white/40 mt-0.5">Auto-fallback</span>
              </button>
            </div>
          </div>

          {/* Generate Action Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || quota.isLimitReached}
            className={`w-full py-4 text-white font-bold text-base rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer ${
              quota.isLimitReached
                ? 'bg-zinc-800 text-white/40 border border-white/10 cursor-not-allowed opacity-80'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/20 disabled:opacity-50'
            }`}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={20} className="animate-spin text-white" />
                <span>Generating Track ({progressPercent}%)...</span>
              </>
            ) : quota.isLimitReached ? (
              <>
                <Clock size={18} className="text-amber-400" />
                <span>Weekly Limit Reached (5/5 Used)</span>
              </>
            ) : (
              <>
                <Sparkles size={20} className="text-yellow-300" />
                <span>Generate Music Now ({quota.remaining} Left This Week)</span>
              </>
            )}
          </button>

          {/* Progress bar during generation */}
          {isGenerating && (
            <div className="space-y-1.5 p-4 bg-black/40 border border-purple-500/30 rounded-2xl animate-fadeIn">
              <div className="flex justify-between text-xs text-white/70">
                <span>{progressStep || 'Synthesizing...'}</span>
                <span className="font-mono text-purple-400">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Player, Visualizer & Track Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Active Track Card */}
          <div className="bg-[#101014] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
              <Disc size={16} className="text-purple-400" />
              <span>Studio Monitor</span>
            </h3>

            {currentTrack ? (
              <div className="space-y-6">
                
                {/* Artwork & Waveform Header */}
                <div className="relative rounded-2xl overflow-hidden aspect-video bg-gradient-to-br from-purple-900/60 to-black border border-white/10 flex flex-col justify-between p-5">
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-mono text-purple-300">
                      {currentTrack.genre} • {currentTrack.bpm} BPM
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                      Ready
                    </span>
                  </div>

                  {/* Waveform Simulation Bars */}
                  <div className="flex items-end justify-center gap-1 h-20 w-full px-4">
                    {Array.from({ length: 28 }).map((_, i) => {
                      const heights = [30, 45, 65, 80, 50, 95, 40, 70, 85, 60, 90, 75, 55, 65, 80, 95, 40, 50, 70, 85, 60, 40, 75, 55, 65, 45, 30, 20];
                      const height = isPlayingLocal ? heights[i % heights.length] : 20;
                      return (
                        <div
                          key={i}
                          style={{ height: `${height}%` }}
                          className={`w-1.5 rounded-full transition-all duration-150 ${
                            isPlayingLocal ? 'bg-gradient-to-t from-purple-500 to-indigo-400' : 'bg-white/20'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-white truncate">{currentTrack.title}</h4>
                    <p className="text-xs text-white/50">{currentTrack.artist}</p>
                  </div>
                </div>

                {/* Local Scrubbing & Time */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-white/50 font-mono">
                    <span>{Math.floor(currentTime)}s</span>
                    <span>{currentTrack.durationSeconds}s</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={audioDuration || currentTrack.durationSeconds}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => {
                      const newT = parseFloat(e.target.value);
                      setCurrentTime(newT);
                      if (audioRef.current) audioRef.current.currentTime = newT;
                    }}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                {/* Primary Play Button */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={togglePlayLocal}
                    className="w-16 h-16 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-xl shadow-purple-600/30 transition-all active:scale-95 cursor-pointer"
                  >
                    {isPlayingLocal ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                  </button>
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    onClick={handlePlayInSbgPlayer}
                    className="flex items-center justify-center gap-2 p-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl border border-white/10 transition-all active:scale-95"
                  >
                    <Radio size={14} className="text-purple-400" />
                    <span>Play in SBG Player</span>
                  </button>

                  <button
                    onClick={handleDownloadWav}
                    className="flex items-center justify-center gap-2 p-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl border border-white/10 transition-all active:scale-95"
                  >
                    <Download size={14} className="text-emerald-400" />
                    <span>Download WAV</span>
                  </button>

                  <button
                    onClick={handleSaveToLibrary}
                    disabled={librarySaved}
                    className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {librarySaved ? <Check size={14} className="text-green-400" /> : <Library size={14} className="text-indigo-400" />}
                    <span>{librarySaved ? 'In Library' : 'Add to Library'}</span>
                  </button>

                  <button
                    onClick={handleSaveOffline}
                    disabled={offlineSaved}
                    className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {offlineSaved ? <Check size={14} className="text-green-400" /> : <HardDrive size={14} className="text-blue-400" />}
                    <span>{offlineSaved ? 'Offline Saved' : 'Save Offline'}</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01] space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-white/30">
                  <Music size={28} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">No Track Generated Yet</h4>
                  <p className="text-xs text-white/40 mt-1 max-w-xs mx-auto">
                    Choose a preset or type a prompt, then tap "Generate Music Now" to create your first track.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Session History */}
          {history.length > 1 && (
            <div className="bg-[#101014] border border-white/10 rounded-3xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider">
                Session Creations ({history.length})
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setCurrentTrack(item);
                      if (audioRef.current) {
                        audioRef.current.src = item.audioUrl;
                        audioRef.current.play().then(() => setIsPlayingLocal(true)).catch(() => {});
                      }
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      currentTrack?.id === item.id
                        ? 'bg-purple-600/20 border-purple-500 text-white'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate">{item.title}</div>
                      <div className="text-[10px] text-white/40 font-mono">
                        {item.genre} • {item.durationSeconds}s
                      </div>
                    </div>
                    <Play size={14} className="text-purple-400 shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Weekly Quota Exceeded Modal */}
      {showQuotaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#15151a] border border-purple-500/30 p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-5 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Clock size={28} />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Weekly Limit Reached</h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                To guarantee free access and optimal studio performance for all SBG listeners, each user is allotted <strong>5 free track generations per week</strong>.
              </p>
            </div>

            {/* Quota Progress Summary */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Used this week:</span>
                <strong className="text-white">{quota.used} / {quota.max} tracks</strong>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Quota Refresh In:</span>
                <strong className="text-purple-400 font-mono">{quota.resetsInText}</strong>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Reset Date:</span>
                <span className="text-white/80">{quota.resetDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowQuotaModal(false)}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
