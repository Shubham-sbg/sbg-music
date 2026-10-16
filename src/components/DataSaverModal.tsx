import React, { useState, useEffect } from 'react';
import { Shield, Zap, Sparkles, X, Check, HardDrive, Wifi, Info } from 'lucide-react';
import { getDataSaverSettings, saveDataSaverSettings, DataSaverSettings } from '../services/dataSaverService';

interface DataSaverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DataSaverModal({ isOpen, onClose }: DataSaverModalProps) {
  const [settings, setSettings] = useState<DataSaverSettings>(getDataSaverSettings());

  useEffect(() => {
    if (isOpen) {
      setSettings(getDataSaverSettings());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleDataSaver = () => {
    const updated = saveDataSaverSettings({
      dataSaver: !settings.dataSaver,
    });
    setSettings(updated);
  };

  const handleTogglePreload = () => {
    if (settings.dataSaver) return;
    const updated = saveDataSaverSettings({
      preloadNextSong: !settings.preloadNextSong,
    });
    setSettings(updated);
  };

  const handleQualityChange = (quality: 'standard' | 'high') => {
    const updated = saveDataSaverSettings({
      downloadQuality: quality,
    });
    setSettings(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#121216] border border-purple-500/30 rounded-3xl p-6 shadow-2xl text-white space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Data Saver Settings</h3>
              <p className="text-xs text-white/50">Optimize streaming data and storage usage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Setting 1: Data Saver Master Switch */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Data Saver Mode</span>
              {settings.dataSaver && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Disables automatic audio prefetching and optimizes media requests to reduce mobile internet usage.
            </p>
          </div>
          <button
            onClick={handleToggleDataSaver}
            role="switch"
            aria-checked={settings.dataSaver}
            className={`w-13 h-7 rounded-full p-1 transition-colors duration-200 cursor-pointer shrink-0 ${
              settings.dataSaver ? 'bg-purple-600' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                settings.dataSaver ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Setting 2: Preload Next Song */}
        <div className={`p-4 rounded-2xl border transition-all ${
          settings.dataSaver 
            ? 'bg-white/[0.02] border-white/5 opacity-60' 
            : 'bg-white/5 border-white/10'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="font-bold text-sm text-white">Preload Next Track</span>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">
                {settings.dataSaver 
                  ? 'Disabled automatically while Data Saver is ON to prevent extra data consumption.' 
                  : 'Preloads a short audio buffer for seamless song transitions when Data Saver is OFF.'}
              </p>
            </div>
            <button
              onClick={handleTogglePreload}
              disabled={settings.dataSaver}
              role="switch"
              aria-checked={settings.preloadNextSong}
              className={`w-13 h-7 rounded-full p-1 transition-colors duration-200 shrink-0 ${
                settings.dataSaver 
                  ? 'bg-zinc-800 cursor-not-allowed' 
                  : settings.preloadNextSong ? 'bg-purple-600 cursor-pointer' : 'bg-white/20 cursor-pointer'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                  settings.preloadNextSong && !settings.dataSaver ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Setting 3: Download Quality */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-white">Offline Download Quality</span>
            <span className="text-[11px] font-mono text-purple-400 capitalize">
              {settings.downloadQuality} Quality
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQualityChange('standard')}
              className={`p-3 rounded-xl border text-left transition-all ${
                settings.downloadQuality === 'standard'
                  ? 'bg-purple-600/20 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">Standard</span>
                {settings.downloadQuality === 'standard' && <Check size={14} className="text-purple-400" />}
              </div>
              <p className="text-[10px] text-white/40">Saves device storage & bandwidth (~3-5 MB/song)</p>
            </button>

            <button
              onClick={() => handleQualityChange('high')}
              className={`p-3 rounded-xl border text-left transition-all ${
                settings.downloadQuality === 'high'
                  ? 'bg-purple-600/20 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs">High (Studio)</span>
                {settings.downloadQuality === 'high' && <Check size={14} className="text-purple-400" />}
              </div>
              <p className="text-[10px] text-white/40">Full master fidelity WAV/MP3 (~8-12 MB/song)</p>
            </button>
          </div>
        </div>

        {/* Honest Disclosure Notice */}
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-2.5 text-purple-200 text-xs">
          <Info size={16} className="shrink-0 mt-0.5 text-purple-400" />
          <p className="leading-relaxed">
            Streaming audio over the internet consumes mobile data. Data Saver minimizes usage by disabling background preloading and optimizing asset requests, but does not claim zero data consumption.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
