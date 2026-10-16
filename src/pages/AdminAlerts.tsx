import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { ImportAlert } from '../types';
import { AlertCircle, RotateCcw, CheckCircle2, Youtube, Clock, XCircle, Trash2, Delete } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';

export default function AdminAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<ImportAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      const q = query(
        collection(db, 'import_alerts'),
        where('status', 'in', ['failed', 'retrying']),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ImportAlert)));
    } catch (e) {
      console.error('Failed to fetch import alerts', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleRetry = async (alert: ImportAlert) => {
    setRetryingId(alert.id);
    try {
      // 1. Mark as retrying
      await updateDoc(doc(db, 'import_alerts', alert.id), { status: 'retrying' });
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'retrying' } : a));

      // 2. Check if it exists
      const existingQ = query(collection(db, 'songs'), where('youtubeVideoId', '==', alert.videoId));
      const existingSnap = await getDocs(existingQ);
      
      let songId = '';

      if (!existingSnap.empty) {
        songId = existingSnap.docs[0].id;
      } else {
        // 3. Fetch fresh metadata
        let title = alert.title;
        let artist = alert.artist;
        let thumb = alert.thumbnailUrl || `https://i.ytimg.com/vi/${alert.videoId}/hqdefault.jpg`;

        const metaRes = await fetch('/api/youtube/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: alert.videoId }),
        });
        
        const text = await metaRes.text();
        if (metaRes.ok && text) {
          try {
            const metaData = JSON.parse(text);
            title = metaData.title || title;
            artist = metaData.artist || artist;
            thumb = metaData.thumbnailUrl || thumb;
          } catch (e) {}
        } else if (metaRes.status === 403 || text.includes('quota')) {
          throw new Error('YouTube API Quota Exhausted');
        } else if (!metaRes.ok) {
          throw new Error(`Failed to fetch metadata (Status: ${metaRes.status})`);
        }

        // 4. Create song
        const docRef = await addDoc(collection(db, 'songs'), {
          title,
          artist,
          description: '',
          genre: 'Various',
          releaseDate: new Date().toISOString().split('T')[0],
          youtubeUrl: `https://www.youtube.com/watch?v=${alert.videoId}`,
          youtubeVideoId: alert.videoId,
          coverUrl: thumb,
          thumbnailUrl: thumb,
          audioUrl: `https://www.youtube.com/watch?v=${alert.videoId}`,
          duration: 0,
          durationSeconds: 0,
          explicitContent: false,
          downloadEnabled: false,
          published: true,
          showYoutubeSourceBadge: false,
          source: 'youtube',
          sourcePlaylistId: alert.jobId,
          createdBy: user?.displayName || 'System Retry',
          createdById: user?.uid || 'system',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        songId = docRef.id;
      }

      // 5. Mark as resolved
      await updateDoc(doc(db, 'import_alerts', alert.id), { status: 'resolved' });
      setAlerts(prev => prev.filter(a => a.id !== alert.id));
    } catch (e: any) {
      console.error('Retry failed:', e);
      const errorMsg = e.message || String(e);
      await updateDoc(doc(db, 'import_alerts', alert.id), { status: 'failed', errorMsg });
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'failed', errorMsg } : a));
    } finally {
      setRetryingId(null);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await updateDoc(doc(db, 'import_alerts', id), { status: 'resolved' });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error('Failed to dismiss alert:', e);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[#111112] border border-red-500/10 p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <AlertCircle className="text-red-400" size={24} />
            <span>Import Alerts</span>
          </h2>
          <p className="text-sm text-white/50 mt-1">
            Review and retry individual song imports that failed due to network errors, API quotas, or timeouts.
          </p>
        </div>
        <button 
          onClick={fetchAlerts}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl transition-colors border border-white/10"
        >
          Refresh Alerts
        </button>
      </div>

      <div className="bg-[#111112] border border-white/5 rounded-3xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-white/40 flex flex-col items-center gap-3">
            <RotateCcw className="animate-spin text-white/20" size={32} />
            <span className="text-sm font-medium">Checking for alerts...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-4 text-white/40">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <p className="font-bold text-white mb-1 text-base">All clear!</p>
              <p className="text-xs">No pending import failures found.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {alerts.map(alert => (
              <div key={alert.id} className="p-6 flex flex-col md:flex-row md:items-center gap-6 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4 flex-1">
                  {alert.thumbnailUrl ? (
                    <img 
                      src={alert.thumbnailUrl} 
                      alt={alert.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 shrink-0">
                      <Youtube size={24} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-base truncate">{alert.title}</h4>
                    <p className="text-xs text-white/40 mt-0.5 truncate">{alert.artist}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold uppercase border border-red-500/20">
                        {alert.status}
                      </span>
                      <span className="text-[11px] text-red-300/80 font-mono truncate max-w-xs md:max-w-md">
                        {alert.errorMsg}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    disabled={retryingId === alert.id}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Dismiss"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() => handleRetry(alert)}
                    disabled={retryingId === alert.id || alert.status === 'retrying'}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:hover:scale-100 disabled:bg-white/50"
                  >
                    <RotateCcw size={14} className={retryingId === alert.id ? 'animate-spin' : ''} />
                    <span>{retryingId === alert.id ? 'Retrying...' : 'Retry Import'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
