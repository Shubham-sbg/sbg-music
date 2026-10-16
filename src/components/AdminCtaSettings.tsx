import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Link as LinkIcon, ExternalLink, Save, Check, AlertCircle } from 'lucide-react';

export default function AdminCtaSettings() {
  const [label, setLabel] = useState('Official Release Link');
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    async function loadCtaConfig() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'cta_config'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.label) setLabel(data.label);
          if (data.url) setUrl(data.url);
          if (typeof data.enabled === 'boolean') setEnabled(data.enabled);
        }
      } catch (err) {
        console.error('Failed to load CTA settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCtaConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus('');

    try {
      await setDoc(doc(db, 'settings', 'cta_config'), {
        label: label.trim() || 'Official Link',
        url: url.trim(),
        enabled,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setStatus('CTA Configuration saved successfully!');
    } catch (err: any) {
      console.error(err);
      setStatus('Save failed: ' + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-white/40 text-xs py-6">Loading CTA settings...</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
          CTA Button Label *
        </label>
        <input
          type="text"
          required
          placeholder="e.g. Listen on Spotify, Stream Now, Buy Merch"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full p-3.5 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-white/30 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
          Destination External URL *
        </label>
        <input
          type="url"
          required
          placeholder="https://open.spotify.com/album/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-3.5 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-white/30 text-sm font-mono"
        />
        <span className="text-[11px] text-white/40 mt-1 block">
          External link will open in a new tab (<code className="text-white/60">target="_blank" rel="noopener noreferrer"</code>).
        </span>
      </div>

      <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4 rounded border-white/20 bg-black/50 text-blue-500 focus:ring-0"
        />
        <span className="text-xs text-white/80 font-bold">Enable Compact Premium CTA Button on Featured Banner</span>
      </label>

      {/* Button Preview */}
      {enabled && url && (
        <div className="pt-2 p-4 bg-black/40 border border-white/5 rounded-2xl">
          <span className="text-[10px] uppercase tracking-wider font-mono text-white/40 mb-2 block">Live Button Preview:</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-black font-bold px-4 py-2 rounded-xl text-xs hover:scale-105 transition-transform shadow-lg"
          >
            <span>{label || 'Official Link'}</span>
            <ExternalLink size={14} />
          </a>
        </div>
      )}

      {status && (
        <div
          className={`p-3.5 rounded-xl text-xs ${
            status.includes('failed')
              ? 'bg-red-500/20 text-red-200 border border-red-500/30'
              : 'bg-green-500/20 text-green-200 border border-green-500/30'
          }`}
        >
          {status}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full p-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
      >
        <Save size={16} />
        <span>{saving ? 'Saving...' : 'Save CTA Settings'}</span>
      </button>
    </form>
  );
}
