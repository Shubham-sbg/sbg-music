import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
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
  Filter,
  UserCheck,
  UserX,
  PieChart as PieChartIcon,
  Search,
  Activity,
  Radio,
  Share2,
  ExternalLink,
  Flame,
  Volume2,
  Compass,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Globe
} from 'lucide-react';
import { collection, doc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  fetchDailyAnalytics, 
  fetchTopSongsAnalytics, 
  fetchAllPlaylistsAnalytics,
  formatListenTime 
} from '../lib/analytics';
import { DailyAnalytics, SongAnalytics, PlaylistAnalytics } from '../types';

export interface RealtimePlaybackEvent {
  id: string;
  songId?: string;
  title?: string;
  artist?: string;
  source?: string;
  playbackSource?: string;
  eventType?: string;
  currentTime?: number;
  duration?: number;
  userId?: string | null;
  anonymousSessionId?: string;
  anonymousId?: string;
  deviceType?: string;
  timestamp?: number;
}

export interface DedicatedAnalyticsOverview {
  totalPlays: number;
  authenticatedPlays: number;
  anonymousPlays: number;
  totalWatchTimeSeconds: number;
  authenticatedWatchTimeSeconds: number;
  anonymousWatchTimeSeconds: number;
  totalListenSeconds?: number;
  authenticatedListenSeconds?: number;
  anonymousListenSeconds?: number;
  totalCompletions: number;
  authenticatedCompletions: number;
  anonymousCompletions: number;
  totalSkips: number;
  authenticatedSkips: number;
  anonymousSkips: number;
  uniqueVisitorsCount: number;
  authenticatedUniqueCount: number;
  anonymousUniqueCount: number;
  sourceBreakdown?: Record<string, number>;
  deviceBreakdown?: Record<string, number>;
  updatedAt?: number;
}

const SOURCE_COLORS: Record<string, string> = {
  Home: '#8b5cf6', // Violet
  Search: '#06b6d4', // Cyan
  YouTube: '#ef4444', // Red
  Playlist: '#f59e0b', // Amber
  Library: '#10b981', // Emerald
  Favorites: '#ec4899', // Pink
  'Song Page': '#3b82f6', // Blue
  Other: '#6b7280', // Gray
};

export default function AnalyticsDashboard() {
  const [listenerFilter, setListenerFilter] = useState<'all' | 'authenticated' | 'anonymous'>('all');
  const [timeRange, setTimeRange] = useState<'live' | 'today' | '7d' | '30d' | 'all'>('live');
  const [loading, setLoading] = useState(true);

  // Dedicated Firestore 'analytics' collection overview state
  const [realtimeOverview, setRealtimeOverview] = useState<DedicatedAnalyticsOverview>({
    totalPlays: 0,
    authenticatedPlays: 0,
    anonymousPlays: 0,
    totalWatchTimeSeconds: 0,
    authenticatedWatchTimeSeconds: 0,
    anonymousWatchTimeSeconds: 0,
    totalCompletions: 0,
    authenticatedCompletions: 0,
    anonymousCompletions: 0,
    totalSkips: 0,
    authenticatedSkips: 0,
    anonymousSkips: 0,
    uniqueVisitorsCount: 0,
    authenticatedUniqueCount: 0,
    anonymousUniqueCount: 0,
    sourceBreakdown: {},
  });

  // Real-time live playback events stream
  const [liveEvents, setLiveEvents] = useState<RealtimePlaybackEvent[]>([]);
  const [activeListenersCount, setActiveListenersCount] = useState<number>(0);
  
  // Historical context
  const [dailyData, setDailyData] = useState<DailyAnalytics[]>([]);
  const [topSongs, setTopSongs] = useState<SongAnalytics[]>([]);
  const [topPlaylists, setTopPlaylists] = useState<PlaylistAnalytics[]>([]);

  // 1. Subscribe to dedicated 'analytics/overview' document in real-time
  useEffect(() => {
    setLoading(true);

    const overviewDocRef = doc(db, 'analytics', 'overview');
    const unsubOverview = onSnapshot(
      overviewDocRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          setRealtimeOverview({
            totalPlays: data.totalPlays || 0,
            authenticatedPlays: data.authenticatedPlays || 0,
            anonymousPlays: data.anonymousPlays || 0,
            totalWatchTimeSeconds: data.totalWatchTimeSeconds || data.totalListenSeconds || 0,
            authenticatedWatchTimeSeconds: data.authenticatedWatchTimeSeconds || data.authenticatedListenSeconds || 0,
            anonymousWatchTimeSeconds: data.anonymousWatchTimeSeconds || data.anonymousListenSeconds || 0,
            totalCompletions: data.totalCompletions || 0,
            authenticatedCompletions: data.authenticatedCompletions || 0,
            anonymousCompletions: data.anonymousCompletions || 0,
            totalSkips: data.totalSkips || 0,
            authenticatedSkips: data.authenticatedSkips || 0,
            anonymousSkips: data.anonymousSkips || 0,
            uniqueVisitorsCount: data.uniqueVisitorsCount || 0,
            authenticatedUniqueCount: data.authenticatedUniqueCount || 0,
            anonymousUniqueCount: data.anonymousUniqueCount || 0,
            sourceBreakdown: data.sourceBreakdown || {},
            deviceBreakdown: data.deviceBreakdown || {},
            updatedAt: data.updatedAt,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Dedicated analytics/overview snapshot fallback:', err?.message || err);
        setLoading(false);
      }
    );

    // 2. Subscribe to real-time playback events
    const eventsQuery = query(
      collection(db, 'playbackEvents'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const events: RealtimePlaybackEvent[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setLiveEvents(events);

        // Calculate active listeners in past 15 mins
        const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
        const activeSessions = new Set<string>();
        events.forEach((ev) => {
          if ((ev.timestamp || 0) >= fifteenMinutesAgo) {
            const sid = ev.userId || ev.anonymousSessionId || ev.anonymousId;
            if (sid) activeSessions.add(sid);
          }
        });
        setActiveListenersCount(Math.max(activeSessions.size, events.length > 0 ? 1 : 0));
      },
      (err) => {
        console.warn('PlaybackEvents snapshot warning:', err?.message || err);
      }
    );

    // 3. Load historical daily and playlist analytics for time-series charts
    Promise.all([
      fetchDailyAnalytics(30),
      fetchTopSongsAnalytics(10),
      fetchAllPlaylistsAnalytics()
    ]).then(([daily, songs, playlists]) => {
      setDailyData(daily);
      setTopSongs(songs);
      setTopPlaylists(playlists);
    }).catch((e) => console.warn('Historical analytics fetch warning:', e));

    return () => {
      unsubOverview();
      unsubEvents();
    };
  }, []);

  // Filter daily analytics according to timeRange
  const filteredDailyList = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return [];
    if (timeRange === 'today') return dailyData.slice(-1);
    if (timeRange === '7d') return dailyData.slice(-7);
    if (timeRange === '30d') return dailyData.slice(-30);
    return dailyData;
  }, [dailyData, timeRange]);

  // Aggregate metrics dynamically based on listenerFilter & timeRange
  const aggregatedStats = useMemo(() => {
    let plays = 0;
    let watchTimeSecs = 0;
    let completions = 0;
    let skips = 0;
    let visitors = 0;

    const sourceCounts: Record<string, number> = {
      Home: 0,
      Search: 0,
      YouTube: 0,
      Playlist: 0,
      Library: 0,
      Favorites: 0,
      'Song Page': 0,
    };

    if (timeRange === 'live' || timeRange === 'all' || filteredDailyList.length === 0) {
      if (listenerFilter === 'authenticated') {
        plays = realtimeOverview.authenticatedPlays || 0;
        watchTimeSecs = realtimeOverview.authenticatedWatchTimeSeconds || 0;
        completions = realtimeOverview.authenticatedCompletions || 0;
        skips = realtimeOverview.authenticatedSkips || 0;
        visitors = realtimeOverview.authenticatedUniqueCount || 0;
      } else if (listenerFilter === 'anonymous') {
        plays = realtimeOverview.anonymousPlays || 0;
        watchTimeSecs = realtimeOverview.anonymousWatchTimeSeconds || 0;
        completions = realtimeOverview.anonymousCompletions || 0;
        skips = realtimeOverview.anonymousSkips || 0;
        visitors = realtimeOverview.anonymousUniqueCount || 0;
      } else {
        plays = realtimeOverview.totalPlays || 0;
        watchTimeSecs = realtimeOverview.totalWatchTimeSeconds || 0;
        completions = realtimeOverview.totalCompletions || 0;
        skips = realtimeOverview.totalSkips || 0;
        visitors = realtimeOverview.uniqueVisitorsCount || 0;
      }

      // Collect source breakdown from overview
      if (realtimeOverview.sourceBreakdown) {
        Object.entries(realtimeOverview.sourceBreakdown).forEach(([k, v]) => {
          if (k in sourceCounts) {
            sourceCounts[k] += Number(v || 0);
          } else {
            sourceCounts[k] = Number(v || 0);
          }
        });
      }
    } else {
      filteredDailyList.forEach((d) => {
        if (listenerFilter === 'authenticated') {
          plays += d.authenticatedPlays || 0;
          watchTimeSecs += d.authenticatedListenSeconds || 0;
          completions += d.authenticatedCompletedCount || 0;
          skips += d.authenticatedSkippedCount || 0;
          visitors += d.authenticatedUniqueCount || 0;
        } else if (listenerFilter === 'anonymous') {
          plays += d.anonymousPlays || 0;
          watchTimeSecs += d.anonymousListenSeconds || 0;
          completions += d.anonymousCompletedCount || 0;
          skips += d.anonymousSkippedCount || 0;
          visitors += d.anonymousUniqueCount || 0;
        } else {
          plays += d.totalPlays || 0;
          watchTimeSecs += d.totalListenSeconds || 0;
          completions += d.completedCount || 0;
          skips += d.skippedCount || 0;
          visitors += d.uniqueVisitorsCount || 0;
        }

        if (d.sourceBreakdown) {
          Object.entries(d.sourceBreakdown).forEach(([k, v]) => {
            sourceCounts[k] = (sourceCounts[k] || 0) + Number(v || 0);
          });
        }
      });
    }

    // Incorporate recent live events into source counts if in live mode and empty
    if (timeRange === 'live' && Object.values(sourceCounts).reduce((a, b) => a + b, 0) === 0) {
      liveEvents.forEach((ev) => {
        const src = ev.playbackSource || (ev.source === 'youtube' ? 'YouTube' : 'Home');
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      });
    }

    // Derived Rates
    const completionRate = plays > 0 ? Math.min(100, Math.round((completions / plays) * 100)) : 0;
    const skipRate = plays > 0 ? Math.min(100, Math.round((skips / plays) * 100)) : 0;
    const avgWatchTimePerPlay = plays > 0 ? Math.round(watchTimeSecs / plays) : 0;

    return {
      plays,
      watchTimeSecs,
      completions,
      skips,
      visitors,
      completionRate,
      skipRate,
      avgWatchTimePerPlay,
      sourceCounts,
    };
  }, [realtimeOverview, filteredDailyList, liveEvents, listenerFilter, timeRange]);

  // Transform source counts for the PieChart and distribution bar
  const sourceDistributionData = useMemo(() => {
    const raw = aggregatedStats.sourceCounts;
    const total = Object.values(raw).reduce((a, b) => a + b, 0);

    // If no plays logged yet, show clean empty distribution
    if (total === 0) {
      return [
        { name: 'Home', value: 0, percentage: 0, color: SOURCE_COLORS.Home },
        { name: 'Search', value: 0, percentage: 0, color: SOURCE_COLORS.Search },
        { name: 'YouTube', value: 0, percentage: 0, color: SOURCE_COLORS.YouTube },
        { name: 'Playlist', value: 0, percentage: 0, color: SOURCE_COLORS.Playlist },
      ];
    }

    return Object.entries(raw)
      .map(([name, count]) => {
        const value = Number(count || 0);
        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
        return {
          name,
          value,
          percentage,
          color: SOURCE_COLORS[name] || SOURCE_COLORS.Other,
        };
      })
      .filter((item) => item.value > 0 || ['Home', 'Search', 'YouTube', 'Playlist'].includes(item.name))
      .sort((a, b) => b.value - a.value);
  }, [aggregatedStats.sourceCounts]);

  // Time series chart data for playback watch time
  const timeSeriesData = useMemo(() => {
    if (filteredDailyList.length > 0) {
      return filteredDailyList.map((d) => ({
        date: d.date.slice(5),
        plays: listenerFilter === 'authenticated' ? (d.authenticatedPlays || 0) : listenerFilter === 'anonymous' ? (d.anonymousPlays || 0) : (d.totalPlays || 0),
        watchMinutes: Math.round(
          (listenerFilter === 'authenticated' ? (d.authenticatedListenSeconds || 0) : listenerFilter === 'anonymous' ? (d.anonymousListenSeconds || 0) : (d.totalListenSeconds || 0)) / 60
        ),
        completions: listenerFilter === 'authenticated' ? (d.authenticatedCompletedCount || 0) : listenerFilter === 'anonymous' ? (d.anonymousCompletedCount || 0) : (d.completedCount || 0),
      }));
    }

    // Fallback single data point
    return [
      {
        date: 'Today',
        plays: aggregatedStats.plays,
        watchMinutes: Math.round(aggregatedStats.watchTimeSecs / 60),
        completions: aggregatedStats.completions,
      }
    ];
  }, [filteredDailyList, listenerFilter, aggregatedStats]);

  const authPercentage = realtimeOverview.totalPlays > 0 
    ? Math.round((realtimeOverview.authenticatedPlays / realtimeOverview.totalPlays) * 100) 
    : 0;

  const anonPercentage = realtimeOverview.totalPlays > 0 
    ? Math.round((realtimeOverview.anonymousPlays / realtimeOverview.totalPlays) * 100) 
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Top Header & Real-time Live Controller */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#121216] border border-white/10 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-900/30">
              <Activity size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Real-Time Playback & Analytics Engine</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                Real-time watch time, playback volume, completion rates, and playback source distribution.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          {/* User Type Switcher */}
          <div className="flex items-center bg-black/60 border border-white/10 p-1 rounded-2xl shadow-inner">
            <button
              onClick={() => setListenerFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                listenerFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Users size={13} />
              <span>All Listeners</span>
            </button>
            <button
              onClick={() => setListenerFilter('authenticated')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                listenerFilter === 'authenticated'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <UserCheck size={13} />
              <span>Authenticated</span>
            </button>
            <button
              onClick={() => setListenerFilter('anonymous')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                listenerFilter === 'anonymous'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <UserX size={13} />
              <span>Anonymous</span>
            </button>
          </div>

          {/* Time Range Filter */}
          <div className="flex items-center bg-black/60 border border-white/10 p-1 rounded-2xl shadow-inner">
            <button
              onClick={() => setTimeRange('live')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                timeRange === 'live' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              Live
            </button>
            <button
              onClick={() => setTimeRange('today')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                timeRange === 'today' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                timeRange === '7d' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                timeRange === '30d' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              30D
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                timeRange === 'all' ? 'bg-white text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid: Watch Time, Volume, Completion Rate, Active Listeners */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Real-Time Watch Time */}
        <div className="bg-[#121216] border border-white/10 p-5 rounded-3xl shadow-xl relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Total Watch Time</span>
            <div className="w-9 h-9 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Clock size={18} />
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl font-black text-white tracking-tight">
              {formatListenTime(aggregatedStats.watchTimeSecs)}
            </h2>
            <div className="flex items-center justify-between text-[11px] text-white/50 mt-2 font-mono">
              <span>Avg: {aggregatedStats.avgWatchTimePerPlay}s / play</span>
              <span className="text-purple-400">Live</span>
            </div>
          </div>

          {/* Auth vs Anon Split Bar */}
          <div className="mt-3.5 pt-3 border-t border-white/5 space-y-1.5">
            <div className="flex justify-between text-[10px] text-white/60">
              <span className="text-blue-300">Auth: {formatListenTime(realtimeOverview.authenticatedWatchTimeSeconds || 0)}</span>
              <span className="text-emerald-300">Anon: {formatListenTime(realtimeOverview.anonymousWatchTimeSeconds || 0)}</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
              <div 
                className="bg-blue-500 h-full transition-all duration-500" 
                style={{ width: `${realtimeOverview.totalWatchTimeSeconds > 0 ? (realtimeOverview.authenticatedWatchTimeSeconds / realtimeOverview.totalWatchTimeSeconds) * 100 : 50}%` }} 
              />
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${realtimeOverview.totalWatchTimeSeconds > 0 ? (realtimeOverview.anonymousWatchTimeSeconds / realtimeOverview.totalWatchTimeSeconds) * 100 : 50}%` }} 
              />
            </div>
          </div>
        </div>

        {/* KPI 2: Playback Volume */}
        <div className="bg-[#121216] border border-white/10 p-5 rounded-3xl shadow-xl relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Playback Volume</span>
            <div className="w-9 h-9 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Play size={18} />
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl font-black text-white tracking-tight">
              {aggregatedStats.plays.toLocaleString()}
            </h2>
            <div className="flex items-center justify-between text-[11px] text-white/50 mt-2 font-mono">
              <span>Streams Recorded</span>
              <span className="text-blue-400">{authPercentage}% Authenticated</span>
            </div>
          </div>

          {/* Auth vs Anon Breakdown */}
          <div className="mt-3.5 pt-3 border-t border-white/5 space-y-1.5">
            <div className="flex justify-between text-[10px] text-white/60">
              <span className="text-blue-300">Auth: {(realtimeOverview.authenticatedPlays || 0).toLocaleString()}</span>
              <span className="text-emerald-300">Anon: {(realtimeOverview.anonymousPlays || 0).toLocaleString()}</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
              <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${authPercentage}%` }} />
              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${anonPercentage}%` }} />
            </div>
          </div>
        </div>

        {/* KPI 3: Completion Rate */}
        <div className="bg-[#121216] border border-white/10 p-5 rounded-3xl shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Completion Rate</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-baseline gap-2">
              <span>{aggregatedStats.completionRate}%</span>
              <span className="text-xs font-normal text-white/40">({aggregatedStats.completions} completed)</span>
            </h2>
            <div className="flex items-center justify-between text-[11px] text-white/50 mt-2 font-mono">
              <span>Skip Rate: {aggregatedStats.skipRate}%</span>
              <span className="text-emerald-400">{aggregatedStats.skips} skips</span>
            </div>
          </div>

          {/* Completion Ratio Progress */}
          <div className="mt-3.5 pt-3 border-t border-white/5 space-y-1.5">
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${aggregatedStats.completionRate}%` }} 
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/40">
              <span>0%</span>
              <span className="text-emerald-300 font-medium">{aggregatedStats.completionRate}% full retention</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Live Active Listeners */}
        <div className="bg-[#121216] border border-white/10 p-5 rounded-3xl shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Active Listeners</span>
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Radio size={18} className="animate-pulse" />
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{activeListenersCount}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
            </h2>
            <div className="flex items-center justify-between text-[11px] text-white/50 mt-2 font-mono">
              <span>Active in past 15m</span>
              <span className="text-amber-400">{liveEvents.length} events logged</span>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/50">
            <span>Unique Visitors:</span>
            <span className="font-semibold text-white">{aggregatedStats.visitors}</span>
          </div>
        </div>
      </div>

      {/* Main Section: Distribution Chart & Time Series */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Playback Source Distribution Chart */}
        <div className="lg:col-span-1 bg-[#121216] border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChartIcon size={18} className="text-purple-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Playback Source Distribution</h3>
              </div>
              <span className="text-[10px] bg-white/5 text-white/60 px-2 py-0.5 rounded-full border border-white/10 font-mono">
                {Object.values(aggregatedStats.sourceCounts).reduce((a, b) => a + b, 0)} Plays
              </span>
            </div>

            <p className="text-xs text-white/50 mb-4">
              Breakdown of songs triggered by entry point: Home, Search, YouTube, and Playlists.
            </p>

            {/* Recharts Pie / Donut Chart */}
            <div className="h-56 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {sourceDistributionData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        stroke="#121216" 
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1c1c24', 
                      borderColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                    formatter={(val: any, name: any, item: any) => [`${val} plays (${item.payload.percentage}%)`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Inner Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-white/40 uppercase tracking-wider font-mono">Top Source</span>
                <span className="text-sm font-bold text-white">
                  {sourceDistributionData[0]?.name || 'Home'}
                </span>
              </div>
            </div>
          </div>

          {/* Source Breakdown Bars */}
          <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
            {sourceDistributionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: item.color }} 
                  />
                  <span className="text-white/80 font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/40 font-mono">{item.value} plays</span>
                  <span className="text-white font-bold w-9 text-right font-mono">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Playback Watch Time & Stream Trends Time-Series Chart */}
        <div className="lg:col-span-2 bg-[#121216] border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Watch Time & Volume Trajectory</h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-purple-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-purple-500" /> Watch Time (Mins)
                </span>
                <span className="flex items-center gap-1 text-blue-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Plays
                </span>
              </div>
            </div>

            <p className="text-xs text-white/50 mb-6">
              Daily trajectory of listening minutes and play requests filtered for {listenerFilter} listeners.
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="watchTimeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="playsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="date" stroke="#ffffff40" fontSize={11} tickLine={false} />
                  <YAxis stroke="#ffffff40" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1c1c24', 
                      borderColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="watchMinutes" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#watchTimeGradient)" 
                    name="Watch Time (Minutes)"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="plays" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#playsGradient)" 
                    name="Total Plays"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Stats Footer */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5 text-center">
            <div>
              <span className="text-[10px] text-white/40 uppercase tracking-wider block">Avg Session</span>
              <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                {aggregatedStats.avgWatchTimePerPlay > 0 ? `${aggregatedStats.avgWatchTimePerPlay}s` : '0s'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-white/40 uppercase tracking-wider block">Auth Retention</span>
              <span className="text-sm font-bold text-blue-400 font-mono mt-0.5 block">
                {realtimeOverview.authenticatedPlays > 0 
                  ? `${Math.round((realtimeOverview.authenticatedCompletions / realtimeOverview.authenticatedPlays) * 100)}%` 
                  : '0%'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-white/40 uppercase tracking-wider block">Anon Retention</span>
              <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
                {realtimeOverview.anonymousPlays > 0 
                  ? `${Math.round((realtimeOverview.anonymousCompletions / realtimeOverview.anonymousPlays) * 100)}%` 
                  : '0%'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Live Playback Activity Stream */}
      <div className="bg-[#121216] border border-white/10 p-6 rounded-3xl shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2.5">
            <Radio size={20} className="text-emerald-400 animate-pulse" />
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Live Playback Activity Stream</h3>
              <p className="text-xs text-white/50">Real-time log of playback starts, sources, and user authentication status.</p>
            </div>
          </div>

          <span className="text-xs text-white/40 font-mono">
            Showing latest {liveEvents.length} events
          </span>
        </div>

        {liveEvents.length === 0 ? (
          <div className="py-12 text-center text-white/40 text-xs">
            No live playback events recorded yet. Play a track from Home, Search, YouTube, or Playlists to see live updates.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase tracking-wider font-mono">
                  <th className="pb-3 font-medium">Track Title</th>
                  <th className="pb-3 font-medium">Artist</th>
                  <th className="pb-3 font-medium">Playback Source</th>
                  <th className="pb-3 font-medium">Listener Identity</th>
                  <th className="pb-3 font-medium">Event Type</th>
                  <th className="pb-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {liveEvents.slice(0, 15).map((ev) => {
                  const sourceName = ev.playbackSource || (ev.source === 'youtube' ? 'YouTube' : 'Home');
                  const sourceColor = SOURCE_COLORS[sourceName] || '#a855f7';
                  const isAuth = Boolean(ev.userId);

                  const timeDisplay = ev.timestamp
                    ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : 'Just now';

                  return (
                    <tr key={ev.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-3 pr-4 font-semibold text-white max-w-[200px] truncate">
                        {ev.title || 'Untitled Track'}
                      </td>
                      <td className="py-3 pr-4 text-white/60 max-w-[150px] truncate">
                        {ev.artist || 'Unknown Artist'}
                      </td>
                      <td className="py-3 pr-4">
                        <span 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border"
                          style={{
                            backgroundColor: `${sourceColor}15`,
                            color: sourceColor,
                            borderColor: `${sourceColor}35`
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sourceColor }} />
                          {sourceName}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {isAuth ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            <UserCheck size={11} /> Authenticated User
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <UserX size={11} /> Anonymous Guest
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-white/50 font-mono text-[11px]">
                        {ev.eventType === 'playback_completed' ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Completed
                          </span>
                        ) : ev.eventType === 'playback_skipped' ? (
                          <span className="text-amber-400 font-medium">Skipped</span>
                        ) : (
                          <span className="text-purple-400 flex items-center gap-1">
                            <Play size={11} /> Started
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right text-white/40 font-mono text-[11px]">
                        {timeDisplay}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
