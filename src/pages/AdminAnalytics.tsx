import React, { useState, useEffect, useMemo } from 'react';
import { 
  fetchGlobalAnalytics, 
  fetchDailyAnalytics, 
  fetchTopSongsAnalytics, 
  fetchAllPlaylistsAnalytics,
  fetchSongImportsDistribution,
  fetchRealtimeListeners,
  fetchYouTubeAnalytics,
  RealtimeListenerInfo,
  YouTubeAnalyticsSummary,
  formatListenTime 
} from '../lib/analytics';
import { GlobalAnalytics, DailyAnalytics, SongAnalytics, PlaylistAnalytics } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  CartesianGrid 
} from 'recharts';
import { 
  Play, 
  Clock, 
  Users, 
  CheckCircle2, 
  TrendingUp, 
  Music, 
  ListMusic, 
  Calendar,
  Sparkles,
  RefreshCw,
  Eye,
  X,
  Filter,
  UserCheck,
  UserX,
  Compass,
  ArrowUpDown,
  Smartphone,
  PieChart,
  Youtube,
  Search,
  Activity,
  Radio,
  Share2,
  ExternalLink
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import AnalyticsDashboard from '../components/AnalyticsDashboard';

export default function AdminAnalytics() {
  const [analyticsViewMode, setAnalyticsViewMode] = useState<'realtime' | 'detailed'>('realtime');
  const [listenerFilter, setListenerFilter] = useState<'all' | 'authenticated' | 'anonymous'>('all');
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | '90d' | 'all' | 'custom'>('7d');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'sbg' | 'youtube'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState<GlobalAnalytics | null>(null);
  const [dailyData, setDailyData] = useState<DailyAnalytics[]>([]);
  const [topSongs, setTopSongs] = useState<SongAnalytics[]>([]);
  const [topPlaylists, setTopPlaylists] = useState<PlaylistAnalytics[]>([]);
  const [selectedSong, setSelectedSong] = useState<SongAnalytics | null>(null);
  const [importData, setImportData] = useState<{ date: string; imports: number }[]>([]);
  
  // Real-Time Listener Stats & YouTube Metrics
  const [realtimeData, setRealtimeData] = useState<RealtimeListenerInfo>({ activeCount: 0, recentTracks: [] });
  const [youtubeStats, setYoutubeStats] = useState<YouTubeAnalyticsSummary | null>(null);
  const [trackSearchQuery, setTrackSearchQuery] = useState<string>('');

  // Sorting for top songs
  const [sortBy, setSortBy] = useState<'plays' | 'time' | 'completion' | 'anonPlays' | 'authPlays'>('plays');

  const loadData = async () => {
    setLoading(true);
    try {
      const [globalRes, dailyRes, songsRes, playlistsRes, importsRes, realtimeRes, ytRes] = await Promise.all([
        fetchGlobalAnalytics(),
        fetchDailyAnalytics(90),
        fetchTopSongsAnalytics(50),
        fetchAllPlaylistsAnalytics(),
        fetchSongImportsDistribution(30),
        fetchRealtimeListeners(),
        fetchYouTubeAnalytics()
      ]);

      setGlobalStats(globalRes);
      setDailyData(dailyRes);
      setTopSongs(songsRes);
      setTopPlaylists(playlistsRes);
      setImportData(importsRes);
      setRealtimeData(realtimeRes);
      setYoutubeStats(ytRes);
    } catch (e) {
      console.error('Error loading analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Set up Real-Time Firestore onSnapshot listener for live playback stream
    const q = query(
      collection(db, 'playbackEvents'),
      orderBy('timestamp', 'desc'),
      limit(25)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cutoff = Date.now() - 15 * 60 * 1000;
      const events = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((e) => (e.timestamp || 0) >= cutoff);

      const uniqueSessions = new Set<string>();
      const recentTracks: RealtimeListenerInfo['recentTracks'] = [];

      events.forEach((ev) => {
        const sess = ev.userId || ev.anonymousSessionId || ev.anonymousId;
        if (sess) uniqueSessions.add(sess);

        if (!recentTracks.some((t) => t.songId === ev.songId)) {
          recentTracks.push({
            songId: ev.songId || 'unknown',
            title: ev.title || 'Untitled Track',
            artist: ev.artist || 'Unknown Artist',
            source: ev.source || 'sbg',
            timestamp: ev.timestamp || Date.now(),
            isAnonymous: !ev.userId,
          });
        }
      });

      setRealtimeData({
        activeCount: Math.max(uniqueSessions.size, recentTracks.length),
        recentTracks: recentTracks.slice(0, 8),
      });
    }, (err) => {
      console.warn('Realtime listener subscription notice:', err?.message || err);
    });

    return () => unsubscribe();
  }, []);

  // Filter daily data based on timeRange / custom range
  const filteredDailyData = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return [];

    let filtered = [...dailyData];

    if (timeRange === 'today') {
      filtered = filtered.slice(-1);
    } else if (timeRange === '7d') {
      filtered = filtered.slice(-7);
    } else if (timeRange === '30d') {
      filtered = filtered.slice(-30);
    } else if (timeRange === '90d') {
      filtered = filtered.slice(-90);
    } else if (timeRange === 'custom' && startDate && endDate) {
      filtered = filtered.filter(d => Boolean(d.date && d.date >= startDate && d.date <= endDate));
    }

    return filtered;
  }, [dailyData, timeRange, startDate, endDate]);

  // Aggregate stats dynamically based on listenerFilter and timeRange
  const currentRangeStats = useMemo(() => {
    let plays = 0;
    let authPlays = 0;
    let anonPlays = 0;

    let seconds = 0;
    let authSeconds = 0;
    let anonSeconds = 0;

    let visitors = 0;
    let authVisitors = 0;
    let anonVisitors = 0;

    let completions = 0;
    let authCompletions = 0;
    let anonCompletions = 0;

    let skips = 0;
    let authSkips = 0;
    let anonSkips = 0;

    let anonSessions = 0;

    if (timeRange === 'all' || filteredDailyData.length === 0) {
      plays = globalStats?.totalPlays || 0;
      authPlays = globalStats?.authenticatedPlays || 0;
      anonPlays = globalStats?.anonymousPlays || 0;

      seconds = globalStats?.totalListenSeconds || 0;
      authSeconds = globalStats?.authenticatedListenSeconds || 0;
      anonSeconds = globalStats?.anonymousListenSeconds || 0;

      visitors = globalStats?.uniqueVisitorsCount || 0;
      authVisitors = globalStats?.authenticatedUniqueCount || 0;
      anonVisitors = globalStats?.anonymousUniqueCount || 0;

      completions = globalStats?.totalCompletions || 0;
      authCompletions = globalStats?.authenticatedCompletions || 0;
      anonCompletions = globalStats?.anonymousCompletions || 0;

      skips = globalStats?.totalSkips || 0;
      authSkips = globalStats?.authenticatedSkips || 0;
      anonSkips = globalStats?.anonymousSkips || 0;

      anonSessions = globalStats?.anonymousSessionsCount || 0;
    } else {
      filteredDailyData.forEach((d) => {
        plays += d.totalPlays || 0;
        authPlays += d.authenticatedPlays || 0;
        anonPlays += d.anonymousPlays || 0;

        seconds += d.totalListenSeconds || 0;
        authSeconds += d.authenticatedListenSeconds || 0;
        anonSeconds += d.anonymousListenSeconds || 0;

        visitors += d.uniqueVisitorsCount || 0;
        authVisitors += d.authenticatedUniqueCount || 0;
        anonVisitors += d.anonymousUniqueCount || 0;

        completions += d.completedCount || 0;
        authCompletions += d.authenticatedCompletedCount || 0;
        anonCompletions += d.anonymousCompletedCount || 0;

        skips += d.skippedCount || 0;
        authSkips += d.authenticatedSkippedCount || 0;
        anonSkips += d.anonymousSkippedCount || 0;

        anonSessions += d.anonymousUniqueCount || d.anonymousPlays ? Math.ceil((d.anonymousPlays || 0) / 1.5) : 0;
      });
    }

    // Apply listener filter selection
    let activePlays = plays;
    let activeSeconds = seconds;
    let activeVisitors = visitors;
    let activeCompletions = completions;
    let activeSkips = skips;

    if (listenerFilter === 'authenticated') {
      activePlays = authPlays;
      activeSeconds = authSeconds;
      activeVisitors = authVisitors;
      activeCompletions = authCompletions;
      activeSkips = authSkips;
    } else if (listenerFilter === 'anonymous') {
      activePlays = anonPlays;
      activeSeconds = anonSeconds;
      activeVisitors = anonVisitors;
      activeCompletions = anonCompletions;
      activeSkips = anonSkips;
    }

    const completionRate = activePlays > 0 ? Math.min(100, Math.round((activeCompletions / activePlays) * 100)) : 0;
    const skipRate = activePlays > 0 ? Math.min(100, Math.round((activeSkips / activePlays) * 100)) : 0;
    const avgDuration = activePlays > 0 ? Math.round(activeSeconds / activePlays) : 0;

    return {
      totalPlays: plays,
      authenticatedPlays: authPlays,
      anonymousPlays: anonPlays,

      totalListenSeconds: seconds,
      authenticatedListenSeconds: authSeconds,
      anonymousListenSeconds: anonSeconds,

      uniqueVisitors: visitors,
      authenticatedVisitors: authVisitors,
      anonymousVisitors: anonVisitors,

      activePlays,
      activeSeconds,
      activeVisitors,
      activeCompletions,
      completionRate,
      skipRate,
      avgDuration,

      anonSessions: anonSessions || anonVisitors || (anonPlays > 0 ? Math.ceil(anonPlays / 2) : 0),
    };
  }, [globalStats, filteredDailyData, timeRange, listenerFilter]);

  // Aggregate Source Breakdown
  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      Home: 0,
      Search: 0,
      'Song Page': 0,
      Playlist: 0,
      YouTube: 0,
      Library: 0,
      Favorites: 0,
    };

    filteredDailyData.forEach((d) => {
      if (d.sourceBreakdown) {
        Object.entries(d.sourceBreakdown).forEach(([k, v]) => {
          counts[k] = (counts[k] || 0) + (Number(v) || 0);
        });
      }
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts).map(([name, val]) => ({
      name,
      val,
      percentage: Math.round((val / total) * 100),
    }));
  }, [filteredDailyData]);

  // Sorted Top Songs Table
  const sortedTopSongs = useMemo(() => {
    return [...topSongs].sort((a, b) => {
      if (sortBy === 'plays') return (b.totalPlays || 0) - (a.totalPlays || 0);
      if (sortBy === 'time') return (b.totalListenSeconds || 0) - (a.totalListenSeconds || 0);
      if (sortBy === 'anonPlays') return (b.anonymousPlays || 0) - (a.anonymousPlays || 0);
      if (sortBy === 'authPlays') return (b.authenticatedPlays || 0) - (a.authenticatedPlays || 0);
      if (sortBy === 'completion') {
        const rateA = a.totalPlays ? ((a.completedCount || 0) / a.totalPlays) : 0;
        const rateB = b.totalPlays ? ((b.completedCount || 0) / b.totalPlays) : 0;
        return rateB - rateA;
      }
      return 0;
    });
  }, [topSongs, sortBy]);

  const hasData = currentRangeStats.totalPlays > 0 || currentRangeStats.totalListenSeconds > 0;

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Top View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111116] border border-white/10 p-2 rounded-2xl shadow-xl">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAnalyticsViewMode('realtime')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              analyticsViewMode === 'realtime'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity size={14} className={analyticsViewMode === 'realtime' ? 'animate-pulse text-emerald-300' : ''} />
            <span>Real-Time Live Dashboard</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block ml-0.5" />
          </button>

          <button
            onClick={() => setAnalyticsViewMode('detailed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              analyticsViewMode === 'detailed'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <PieChart size={14} />
            <span>Deep-Dive & Content Analytics</span>
          </button>
        </div>

        <div className="text-[11px] text-white/40 font-mono px-2 hidden sm:block">
          Dedicated Firestore Analytics Collection Engine
        </div>
      </div>

      {analyticsViewMode === 'realtime' ? (
        <AnalyticsDashboard />
      ) : (
        <>
          {/* Header & Main Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <TrendingUp className="text-purple-400" size={24} />
            <span>Playback & Watch Time Analytics</span>
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Real-time listener watch time, playback volume, completion rates, and anonymous vs authenticated activity.
          </p>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Listener Type Selector */}
          <div className="flex items-center bg-black/60 border border-white/10 p-1 rounded-2xl shadow-lg">
            <button
              onClick={() => setListenerFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                listenerFilter === 'all' ? 'bg-purple-600 text-white shadow-lg' : 'text-white/60 hover:text-white'
              }`}
            >
              <Users size={13} />
              <span>All Listeners</span>
            </button>
            <button
              onClick={() => setListenerFilter('authenticated')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                listenerFilter === 'authenticated' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/60 hover:text-white'
              }`}
            >
              <UserCheck size={13} />
              <span>Authenticated</span>
            </button>
            <button
              onClick={() => setListenerFilter('anonymous')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                listenerFilter === 'anonymous' ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/60 hover:text-white'
              }`}
            >
              <UserX size={13} />
              <span>Anonymous</span>
            </button>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center bg-black/60 border border-white/10 p-1 rounded-2xl shadow-lg">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeRange === 'today' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeRange === '7d' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeRange === '30d' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              30D
            </button>
            <button
              onClick={() => setTimeRange('90d')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeRange === '90d' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              90D
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeRange === 'all' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeRange('custom')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeRange === 'custom' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            title="Refresh Data"
            disabled={loading}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 shadow-lg"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {timeRange === 'custom' && (
        <div className="bg-[#111112] border border-white/10 p-4 rounded-2xl flex flex-wrap items-center gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-bold uppercase">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-bold uppercase">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
            />
          </div>
        </div>
      )}

      {/* LIVE NOW Listener Pulse & Active Stream Ticker */}
      <div className="bg-gradient-to-r from-purple-950/40 via-[#111116] to-black/60 border border-purple-500/20 p-5 rounded-3xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Live Active Listeners</span>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                Real-Time Stream
              </span>
            </div>
            <div className="text-xl md:text-2xl font-black text-white font-mono mt-0.5">
              {realtimeData.activeCount} <span className="text-xs font-normal text-white/50">listeners active in last 15m</span>
            </div>
          </div>
        </div>

        {/* Live Recent Tracks Pills */}
        <div className="flex flex-wrap items-center gap-2 max-w-xl">
          {realtimeData.recentTracks.length > 0 ? (
            realtimeData.recentTracks.slice(0, 4).map((t, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/80"
              >
                <Radio size={12} className={t.source === 'youtube' ? 'text-red-400' : 'text-purple-400'} />
                <span className="font-bold truncate max-w-[120px]">{t.title}</span>
                <span className="text-[9px] uppercase font-bold text-white/40">{t.source}</span>
              </div>
            ))
          ) : (
            <span className="text-xs text-white/40">Waiting for live playback activity...</span>
          )}
        </div>
      </div>

      {/* Primary KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Plays */}
        <div className="bg-[#111112] border border-white/5 p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-xs font-bold uppercase tracking-wider">Total Plays</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Play size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {currentRangeStats.activePlays.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                Auth: {currentRangeStats.authenticatedPlays.toLocaleString()}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                Anon: {currentRangeStats.anonymousPlays.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Listening Time */}
        <div className="bg-[#111112] border border-white/5 p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-xs font-bold uppercase tracking-wider">Listening Time</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-purple-300 tracking-tight">
              {formatListenTime(currentRangeStats.activeSeconds)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                Auth: {formatListenTime(currentRangeStats.authenticatedListenSeconds)}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                Anon: {formatListenTime(currentRangeStats.anonymousListenSeconds)}
              </span>
            </div>
          </div>
        </div>

        {/* Unique Listeners */}
        <div className="bg-[#111112] border border-white/5 p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-xs font-bold uppercase tracking-wider">Unique Listeners</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {currentRangeStats.activeVisitors.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                Auth: {currentRangeStats.authenticatedVisitors.toLocaleString()}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                Anon: {currentRangeStats.anonymousVisitors.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-[#111112] border border-white/5 p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-white/40">
            <span className="text-xs font-bold uppercase tracking-wider">Completion Rate</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-amber-300 tracking-tight">
              {currentRangeStats.completionRate}%
            </div>
            <p className="text-[11px] text-white/40 mt-1">Avg listen duration: {formatListenTime(currentRangeStats.avgDuration)}</p>
          </div>
        </div>
      </div>

      {/* Empty State Banner if no data */}
      {!hasData && (
        <div className="bg-[#111112] border border-white/10 p-8 rounded-3xl text-center space-y-3 shadow-2xl">
          <Calendar size={36} className="mx-auto text-white/30" />
          <h3 className="text-lg font-bold text-white">No playback data available for this period.</h3>
          <p className="text-xs text-white/50 max-w-md mx-auto">
            Playback events logged by listeners will appear here automatically in real time.
          </p>
        </div>
      )}

      {/* Anonymous Session Analytics Card */}
      <div className="bg-[#111112] border border-white/5 p-6 md:p-8 rounded-3xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <UserX className="text-emerald-400" size={20} />
              <span>Anonymous Listening Sessions Analytics</span>
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              Aggregated, privacy-conscious metrics for visitors listening without logging in.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
            No Sign-In Required
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
            <div className="text-[11px] font-bold text-white/40 uppercase">Anon Sessions</div>
            <div className="text-xl font-bold text-white mt-1">
              {currentRangeStats.anonSessions.toLocaleString()}
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
            <div className="text-[11px] font-bold text-white/40 uppercase">Avg Time / Session</div>
            <div className="text-xl font-bold text-emerald-300 mt-1">
              {formatListenTime(currentRangeStats.anonSessions > 0 ? currentRangeStats.anonymousListenSeconds / currentRangeStats.anonSessions : 0)}
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
            <div className="text-[11px] font-bold text-white/40 uppercase">Songs / Session</div>
            <div className="text-xl font-bold text-white mt-1">
              {currentRangeStats.anonSessions > 0 ? (currentRangeStats.anonymousPlays / currentRangeStats.anonSessions).toFixed(1) : '0.0'}
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
            <div className="text-[11px] font-bold text-white/40 uppercase">Completion Rate</div>
            <div className="text-xl font-bold text-amber-300 mt-1">
              {currentRangeStats.anonymousPlays > 0 ? Math.round((currentRangeStats.activeCompletions / currentRangeStats.anonymousPlays) * 100) : 0}%
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
            <div className="text-[11px] font-bold text-white/40 uppercase">Skip Rate</div>
            <div className="text-xl font-bold text-red-300 mt-1">
              {currentRangeStats.anonymousPlays > 0 ? Math.round((currentRangeStats.skipRate)) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Charts & Playback Source Breakdown Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Playback Trends Chart */}
        <div className="xl:col-span-2 bg-[#111112] border border-white/5 p-6 md:p-8 rounded-3xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Daily Playback Trends</h3>
              <p className="text-xs text-white/40 mt-0.5">
                Daily volume of plays and total watch time over time.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-white/60">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span>Plays</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span>Watch Time (Minutes)</span>
              </div>
            </div>
          </div>

          <div className="h-64 md:h-72 w-full pt-4">
            {filteredDailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredDailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPlays" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#ffffff40" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis stroke="#ffffff40" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#ffffff1a',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      name === 'Minutes' ? `${Math.round(val)} min` : val,
                      name === 'Minutes' ? 'Watch Time' : 'Plays',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey={listenerFilter === 'anonymous' ? 'anonymousPlays' : listenerFilter === 'authenticated' ? 'authenticatedPlays' : 'totalPlays'}
                    name="Plays"
                    stroke="#a855f7"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPlays)"
                  />
                  <Area
                    type="monotone"
                    dataKey={(d) => Math.round((listenerFilter === 'anonymous' ? d.anonymousListenSeconds || 0 : listenerFilter === 'authenticated' ? d.authenticatedListenSeconds || 0 : d.totalListenSeconds || 0) / 60)}
                    name="Minutes"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMinutes)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/30 text-xs gap-2">
                <Calendar size={28} />
                <span>No playback events logged for this date range.</span>
              </div>
            )}
          </div>
        </div>

        {/* Playback Source Breakdown */}
        <div className="bg-[#111112] border border-white/5 p-6 md:p-8 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Compass size={18} className="text-blue-400" />
              <span>Playback Source</span>
            </h3>
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Distribution</span>
          </div>

          <div className="space-y-3 pt-2">
            {sourceBreakdown.map((src) => (
              <div key={src.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70 font-medium">{src.name}</span>
                  <span className="text-white/40 font-mono">{src.val.toLocaleString()} plays ({src.percentage}%)</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, src.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dedicated YouTube Playback & Watch Time Tracking Section */}
      <div className="bg-[#111112] border border-white/5 p-6 md:p-8 rounded-3xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-lg">
              <Youtube size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>YouTube Playback & Discovery Tracking</span>
                <span className="text-[10px] bg-red-500/10 text-red-400 font-bold px-2 py-0.5 rounded-full uppercase">
                  Cloud Streams
                </span>
              </h3>
              <p className="text-xs text-white/40 mt-0.5">
                Metrics for YouTube discovery songs streamed through the unified player.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
            <div className="text-[11px] font-bold text-white/40 uppercase">YouTube Plays</div>
            <div className="text-xl font-bold text-white mt-1">
              {(youtubeStats?.totalPlays || 0).toLocaleString()}
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
            <div className="text-[11px] font-bold text-white/40 uppercase">YouTube Watch Time</div>
            <div className="text-xl font-bold text-red-300 mt-1">
              {formatListenTime(youtubeStats?.totalWatchTimeSeconds || 0)}
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
            <div className="text-[11px] font-bold text-white/40 uppercase">YT Completion Rate</div>
            <div className="text-xl font-bold text-amber-300 mt-1">
              {youtubeStats?.completionRate || 0}%
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl">
            <div className="text-[11px] font-bold text-white/40 uppercase">YT Skip Rate</div>
            <div className="text-xl font-bold text-purple-300 mt-1">
              {youtubeStats?.skipRate || 0}%
            </div>
          </div>
        </div>

        {/* Top YouTube Tracks List */}
        {youtubeStats?.topTracks && youtubeStats.topTracks.length > 0 && (
          <div className="pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Top YouTube Discovery Tracks</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {youtubeStats.topTracks.slice(0, 6).map((ytTrack) => (
                <div 
                  key={ytTrack.songId || ytTrack.id}
                  onClick={() => setSelectedSong(ytTrack)}
                  className="bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-2xl flex items-center gap-3 transition-all cursor-pointer group"
                >
                  {ytTrack.coverUrl ? (
                    <img
                      src={ytTrack.coverUrl}
                      alt={ytTrack.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                      <Youtube size={16} />
                    </div>
                  )}
                  <div className="truncate flex-1">
                    <div className="text-xs font-bold text-white truncate group-hover:text-red-300 transition-colors">
                      {ytTrack.title}
                    </div>
                    <div className="text-[10px] text-white/40 truncate">{ytTrack.artist}</div>
                  </div>
                  <div className="text-right font-mono text-[11px] font-bold text-red-300">
                    {(ytTrack.totalPlays || 0).toLocaleString()} plays
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Two Column Grid: Top Songs & Top Playlists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Songs Table with Track Search */}
        <div className="bg-[#111112] border border-white/5 p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Music size={18} className="text-purple-400" />
              <span>Track Analytics & Top Songs</span>
            </h3>

            {/* Search Track Input & Sort Control */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Filter track..."
                  value={trackSearchQuery}
                  onChange={(e) => setTrackSearchQuery(e.target.value)}
                  className="pl-7 pr-2.5 py-1 bg-black/50 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 outline-none focus:border-purple-500 w-32 sm:w-40"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white outline-none focus:border-purple-500"
              >
                <option value="plays">Total Plays</option>
                <option value="time">Watch Time</option>
                <option value="anonPlays">Anonymous Plays</option>
                <option value="authPlays">Auth Plays</option>
                <option value="completion">Completion Rate</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {sortedTopSongs.filter(s => !trackSearchQuery || (s.title && s.title.toLowerCase().includes(trackSearchQuery.toLowerCase())) || (s.artist && s.artist.toLowerCase().includes(trackSearchQuery.toLowerCase()))).length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase tracking-wider font-bold">
                    <th className="pb-3 pl-2">#</th>
                    <th className="pb-3">Song</th>
                    <th className="pb-3 text-right">Plays (Anon/Auth)</th>
                    <th className="pb-3 text-right">Watch Time</th>
                    <th className="pb-3 text-right pr-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedTopSongs
                    .filter(s => !trackSearchQuery || (s.title && s.title.toLowerCase().includes(trackSearchQuery.toLowerCase())) || (s.artist && s.artist.toLowerCase().includes(trackSearchQuery.toLowerCase())))
                    .map((song, idx) => {
                    const totalP = song.totalPlays || 0;
                    const anonP = song.anonymousPlays || 0;
                    const authP = song.authenticatedPlays || 0;

                    return (
                      <tr key={song.songId || idx} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-3 pl-2 font-mono text-white/30">{idx + 1}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            {song.coverUrl ? (
                              <img
                                src={song.coverUrl}
                                alt={song.title}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 shrink-0">
                                <Music size={14} />
                              </div>
                            )}
                            <div className="truncate max-w-[140px] sm:max-w-[180px]">
                              <div className="font-bold text-white truncate flex items-center gap-1.5">
                                <span>{song.title}</span>
                                {song.source === 'youtube' && (
                                  <span className="text-[9px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.2 rounded">YT</span>
                                )}
                              </div>
                              <div className="text-white/40 text-[11px] truncate">{song.artist}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono">
                          <div className="font-bold text-white">{totalP.toLocaleString()}</div>
                          <div className="text-[10px] text-white/40">
                            <span className="text-emerald-400">{anonP} anon</span> / <span className="text-blue-400">{authP} auth</span>
                          </div>
                        </td>
                        <td className="py-3 text-right text-purple-300 font-mono font-medium">
                          {formatListenTime(song.totalListenSeconds || 0)}
                        </td>
                        <td className="py-3 text-right pr-2">
                          <button
                            onClick={() => setSelectedSong(song)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                            title="View Track Analytics"
                          >
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-white/30 text-xs">
                No song analytics matching "{trackSearchQuery}" logged yet.
              </div>
            )}
          </div>
        </div>

        {/* Top Playlists Table */}
        <div className="bg-[#111112] border border-white/5 p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <ListMusic size={18} className="text-blue-400" />
              <span>Top Playlists</span>
            </h3>
            <span className="text-xs text-white/40">{topPlaylists.length} playlists</span>
          </div>

          <div className="overflow-x-auto">
            {topPlaylists.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase tracking-wider font-bold">
                    <th className="pb-3 pl-2">#</th>
                    <th className="pb-3">Playlist</th>
                    <th className="pb-3 text-right">Plays</th>
                    <th className="pb-3 text-right pr-2">Watch Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {topPlaylists.map((pl, idx) => (
                    <tr key={pl.playlistId || idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pl-2 font-mono text-white/30">{idx + 1}</td>
                      <td className="py-3 font-bold text-white truncate max-w-[180px]">
                        {pl.title || 'Untitled Playlist'}
                      </td>
                      <td className="py-3 text-right font-bold text-white font-mono">
                        {(pl.totalPlays || 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-blue-300 font-mono font-medium pr-2">
                        {formatListenTime(pl.totalListenSeconds || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-white/30 text-xs">
                No playlist plays logged yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Song Analytics Detail Modal */}
      {selectedSong && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111112] border border-white/10 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {selectedSong.coverUrl && (
                  <img
                    src={selectedSong.coverUrl}
                    alt={selectedSong.title}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-lg"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold text-white tracking-tight">{selectedSong.title}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      selectedSong.source === 'youtube' 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    }`}>
                      {selectedSong.source === 'youtube' ? 'YouTube Stream' : 'SBG Master Audio'}
                    </span>
                  </div>
                  <p className="text-xs text-white/50">{selectedSong.artist}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSong(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-black/50 border border-white/5 p-3.5 rounded-2xl text-center">
                <div className="text-[10px] font-bold text-white/40 uppercase">Total Plays</div>
                <div className="text-lg font-bold text-white mt-1">{(selectedSong.totalPlays || 0).toLocaleString()}</div>
              </div>
              <div className="bg-black/50 border border-white/5 p-3.5 rounded-2xl text-center">
                <div className="text-[10px] font-bold text-white/40 uppercase">Anon Plays</div>
                <div className="text-lg font-bold text-emerald-300 mt-1">{(selectedSong.anonymousPlays || 0).toLocaleString()}</div>
              </div>
              <div className="bg-black/50 border border-white/5 p-3.5 rounded-2xl text-center">
                <div className="text-[10px] font-bold text-white/40 uppercase">Auth Plays</div>
                <div className="text-lg font-bold text-blue-300 mt-1">{(selectedSong.authenticatedPlays || 0).toLocaleString()}</div>
              </div>
              <div className="bg-black/50 border border-white/5 p-3.5 rounded-2xl text-center">
                <div className="text-[10px] font-bold text-white/40 uppercase">Watch Time</div>
                <div className="text-lg font-bold text-purple-300 mt-1">{formatListenTime(selectedSong.totalListenSeconds || 0)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                <div className="text-[10px] font-bold text-white/40 uppercase">Completions</div>
                <div className="text-base font-bold text-emerald-300 mt-0.5">
                  {(selectedSong.completedCount || 0).toLocaleString()} ({selectedSong.totalPlays ? Math.round(((selectedSong.completedCount || 0) / selectedSong.totalPlays) * 100) : 0}%)
                </div>
              </div>
              <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                <div className="text-[10px] font-bold text-white/40 uppercase">Skips</div>
                <div className="text-base font-bold text-amber-300 mt-0.5">
                  {(selectedSong.skippedCount || 0).toLocaleString()} ({selectedSong.totalPlays ? Math.round(((selectedSong.skippedCount || 0) / selectedSong.totalPlays) * 100) : 0}%)
                </div>
              </div>
            </div>

            {selectedSong.lastPlayedAt && (
              <div className="text-xs text-white/40 text-center font-mono">
                Last played: {new Date(selectedSong.lastPlayedAt).toLocaleString()}
              </div>
            )}

            <button
              onClick={() => setSelectedSong(null)}
              className="w-full py-3 bg-white text-black font-bold text-xs rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              Close Track Analytics
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
