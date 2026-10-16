import React, { useState, useRef } from 'react';
import { storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  Upload, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  X, 
  Check, 
  Loader2, 
  AlertCircle,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Wand2
} from 'lucide-react';
import { generatePlaylistArtwork, PRESET_ARTWORKS, createProceduralArtwork } from '../lib/artworkGenerator';

interface ImageUploadInputProps {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  storageFolder?: string;
  placeholder?: string;
  recommendedSize?: string;
  required?: boolean;
  promptContext?: {
    title?: string;
    description?: string;
    genre?: string;
  };
}

export default function ImageUploadInput({
  label = 'Banner / Artwork Image',
  value,
  onChange,
  storageFolder = 'artwork',
  placeholder = 'https://images.unsplash.com/... or upload a file',
  recommendedSize = 'Recommended: 16:9 for banners (1200x630) or 1:1 for square artwork',
  required = false,
  promptContext,
}: ImageUploadInputProps) {
  const [mode, setMode] = useState<'upload' | 'url' | 'ai'>(
    value && !value.startsWith('data:') && !value.includes('firebasestorage') ? 'url' : 'upload'
  );
  const [uploading, setUploading] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleGenerateAi = async (styleOverride?: string) => {
    setGeneratingAi(true);
    setError(null);
    setGenerationNotice(null);
    try {
      const title = promptContext?.title?.trim() || 'SBG Playlist';
      const result = await generatePlaylistArtwork({
        title,
        description: promptContext?.description,
        genre: promptContext?.genre,
        style: styleOverride,
      });

      onChange(result.imageUrl);
      setGenerationNotice(
        result.source === 'gemini-ai'
          ? 'Generated via Gemini AI model'
          : 'Generated unique high-res procedural artwork'
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to auto-generate artwork.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP, GIF).');
      return;
    }

    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file size must be less than 10MB.');
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
      const uniquePath = `${storageFolder}/${Date.now()}_${cleanName}.${ext}`;
      const storageRef = ref(storage, uniquePath);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setProgress(pct);
        },
        async (uploadError: any) => {
          console.error('Firebase Storage upload error:', uploadError);
          setError(`Storage upload failed: ${uploadError.message || 'Check storage permissions'}`);
          setUploading(false);
          setProgress(null);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(storageRef);
            onChange(downloadUrl);
            setError(null);
          } catch (urlErr: any) {
            console.error('Error obtaining download URL:', urlErr);
            setError(`Failed to retrieve download URL: ${urlErr.message || 'Unknown error'}`);
          } finally {
            setUploading(false);
            setProgress(null);
          }
        }
      );
    } catch (err: any) {
      console.error('Error initiating upload:', err);
      setError(`Upload initialization failed: ${err.message || 'Storage error'}`);
      setUploading(false);
      setProgress(null);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header with Mode Switcher */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-white/60">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5 text-[11px]">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-bold transition-all ${
              mode === 'upload'
                ? 'bg-white text-black shadow'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Upload size={12} />
            <span>Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-bold transition-all ${
              mode === 'url'
                ? 'bg-white text-black shadow'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <LinkIcon size={12} />
            <span>Image URL</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-bold transition-all ${
              mode === 'ai'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow'
                : 'text-purple-300/70 hover:text-purple-300'
            }`}
          >
            <Sparkles size={12} className={mode === 'ai' ? 'animate-pulse' : ''} />
            <span>AI Artwork</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      {mode === 'ai' ? (
        <div className="space-y-3 p-4 bg-black/40 border border-purple-500/20 rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Wand2 size={13} className="text-purple-400" />
                <span>AI Artwork Generator</span>
              </span>
              <p className="text-[11px] text-white/40 mt-0.5">
                {promptContext?.title
                  ? `Styling artwork for: "${promptContext.title}"`
                  : 'Auto-generates unique 1:1 square album cover art'}
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => handleGenerateAi()}
              disabled={generatingAi}
              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {generatingAi ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Generate Now</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 block">
              Curated Style Presets
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_ARTWORKS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onChange(preset.url);
                    setGenerationNotice(`Applied preset: ${preset.title}`);
                  }}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all hover:scale-[1.02] ${
                    value === preset.url
                      ? 'bg-purple-500/20 border-purple-500/50 text-white'
                      : 'bg-white/5 hover:bg-white/10 border-white/5 text-white/70'
                  }`}
                >
                  <img
                    src={preset.url}
                    alt=""
                    className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate">{preset.title}</p>
                    <p className="text-[9px] text-white/40 truncate">{preset.theme}</p>
                  </div>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  const svg = createProceduralArtwork(promptContext?.title || 'SBG Music', promptContext?.description);
                  onChange(svg);
                  setGenerationNotice('Applied dynamic vinyl waveform artwork');
                }}
                className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all hover:scale-[1.02] bg-white/5 hover:bg-white/10 border-white/5 text-white/70`}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-900 via-purple-900 to-black flex items-center justify-center border border-white/10 shrink-0 text-[10px] font-bold text-white font-mono">
                  VINYL
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate">Procedural Vinyl</p>
                  <p className="text-[9px] text-white/40 truncate">Geometric Soundwave</p>
                </div>
              </button>
            </div>
          </div>

          {/* Current Selection / Preview */}
          {value && (
            <div className="mt-3 p-2.5 bg-black/60 rounded-xl border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={value}
                  alt="AI Artwork Preview"
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Artwork Attached
                  </span>
                  <p className="text-xs text-white/60 truncate mt-0.5">
                    {generationNotice || 'Custom artwork ready for playlist'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleGenerateAi()}
                  disabled={generatingAi}
                  className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title="Regenerate artwork"
                >
                  <RefreshCw size={13} className={generatingAi ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors"
                  title="Remove artwork"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : mode === 'upload' ? (
        <div className="space-y-2">
          {value ? (
            /* Image Preview Card */
            <div className="relative group rounded-2xl overflow-hidden border border-white/10 bg-black/60 p-3 flex items-center gap-3.5">
              <img
                src={value}
                alt="Artwork Preview"
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0 bg-neutral-900"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Check size={10} />
                    <span>Image Attached</span>
                  </span>
                </div>
                <p className="text-xs text-white/50 truncate font-mono">
                  {value.startsWith('data:') ? 'Local file uploaded' : value}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-purple-400 hover:text-purple-300 font-bold"
                  >
                    Replace Image
                  </button>
                  <span className="text-white/20">•</span>
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="text-xs text-red-400 hover:text-red-300 font-bold"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
                className="hidden"
              />
            </div>
          ) : (
            /* Drag & Drop Upload Zone */
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/15 bg-black/40 hover:border-white/30 hover:bg-black/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
                className="hidden"
              />

              {uploading ? (
                <div className="py-2 space-y-2">
                  <Loader2 size={24} className="animate-spin text-purple-400 mx-auto" />
                  <div className="text-xs font-bold text-white">
                    Uploading image... {progress !== null ? `${progress}%` : ''}
                  </div>
                  {progress !== null && (
                    <div className="w-48 mx-auto h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 mx-auto">
                    <Upload size={18} />
                  </div>
                  <div className="text-xs font-bold text-white">
                    Click to upload <span className="text-white/40 font-normal">or drag & drop</span>
                  </div>
                  <p className="text-[11px] text-white/40">
                    PNG, JPG, WebP, GIF (Max 10MB)
                  </p>
                </div>
              )}
            </div>
          )}

          {!value && (
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/20 rounded-xl">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-purple-400 shrink-0" />
                <span className="text-xs text-white/80 font-medium">Don't have artwork? Auto-generate with AI</span>
              </div>
              <button
                type="button"
                onClick={() => handleGenerateAi()}
                disabled={generatingAi}
                className="text-xs px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold rounded-lg border border-purple-500/30 transition-colors flex items-center gap-1.5 shrink-0"
              >
                {generatingAi ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                <span>Auto-Generate</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Direct URL Input Mode */
        <div className="space-y-2">
          <div className="relative">
            <input
              type="url"
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-white/40 pr-10"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                title="Clear"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {value && (
            <div className="flex items-center gap-3 p-2 bg-black/40 border border-white/5 rounded-xl">
              <img
                src={value}
                alt="Preview"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Invalid+Image';
                }}
                className="w-10 h-10 rounded-lg object-cover border border-white/10 bg-neutral-900 shrink-0"
              />
              <span className="text-[11px] text-white/50 truncate flex-1 font-mono">
                {value}
              </span>
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white p-1"
                title="Open image in new tab"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          )}

          {!value && (
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/20 rounded-xl">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-purple-400 shrink-0" />
                <span className="text-xs text-white/80 font-medium">Don't have an image URL? Auto-generate with AI</span>
              </div>
              <button
                type="button"
                onClick={() => handleGenerateAi()}
                disabled={generatingAi}
                className="text-xs px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold rounded-lg border border-purple-500/30 transition-colors flex items-center gap-1.5 shrink-0"
              >
                {generatingAi ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                <span>Auto-Generate</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 pt-1">
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      )}

      {/* Recommended Size Hint */}
      {recommendedSize && (
        <p className="text-[11px] text-white/35">
          {recommendedSize}
        </p>
      )}
    </div>
  );
}
