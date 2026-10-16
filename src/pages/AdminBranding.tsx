import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  getBrandingConfig, 
  saveBrandingConfig, 
  BrandingConfig, 
  DEFAULT_BRANDING 
} from '../lib/branding';
import { storage, auth } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  Palette, 
  Upload, 
  Image as ImageIcon, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Smartphone, 
  Globe, 
  Sliders, 
  ArrowLeft,
  Eye,
  Info,
  Layers,
  Sparkles
} from 'lucide-react';

interface ImageValidation {
  width: number;
  height: number;
  sizeKb: number;
  type: string;
}

export default function AdminBranding() {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'logos' | 'icons' | 'defaults'>('logos');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [imageMeta, setImageMeta] = useState<{ [key: string]: ImageValidation }>({});

  const fileInputRefs = {
    appLogo: useRef<HTMLInputElement>(null),
    websiteLogo: useRef<HTMLInputElement>(null),
    favicon: useRef<HTMLInputElement>(null),
    appIcon: useRef<HTMLInputElement>(null),
    splashLogo: useRef<HTMLInputElement>(null),
    loginLogo: useRef<HTMLInputElement>(null),
    defaultMusicArtwork: useRef<HTMLInputElement>(null),
    defaultUserAvatar: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getBrandingConfig(true);
      setBranding(data);
    } catch (err: any) {
      setErrorMsg('Failed to load branding configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (key: keyof BrandingConfig, file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg(`Invalid file type (${file.type}). Allowed formats: PNG, JPEG, WEBP, SVG.`);
      return;
    }

    // 2. Validate file size (max 5MB)
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setErrorMsg(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds 5 MB limit.`);
      return;
    }

    // 3. Inspect image dimensions
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.onload = async () => {
      setImageMeta((prev) => ({
        ...prev,
        [key]: {
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          sizeKb: Math.round(file.size / 1024),
          type: file.type,
        },
      }));

      // Upload to Firebase Storage
      try {
        setUploadProgress((prev) => ({ ...prev, [key]: 10 }));
        const storagePath = `branding/${key}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const fileRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(fileRef, file, {
          contentType: file.type,
          customMetadata: {
            uploadedBy: auth.currentUser?.email || 'admin',
            assetRole: key,
          },
        });

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress((prev) => ({ ...prev, [key]: pct }));
          },
          (err) => {
            console.error('Storage upload failed:', err);
            setErrorMsg(`Upload failed: ${err.message || 'Firebase Storage error.'}`);
            setUploadProgress((prev) => {
              const cp = { ...prev };
              delete cp[key];
              return cp;
            });
          },
          async () => {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            setBranding((prev) => ({ ...prev, [key]: downloadUrl }));
            setUploadProgress((prev) => {
              const cp = { ...prev };
              delete cp[key];
              return cp;
            });
            setSuccessMsg(`Uploaded ${key} successfully! Click "Save & Publish" to apply.`);
          }
        );
      } catch (uploadErr: any) {
        setErrorMsg(`Failed to initiate upload: ${uploadErr.message}`);
      }
    };
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await saveBrandingConfig(branding);
      setSuccessMsg('Branding published successfully! All users and client apps updated.');
    } catch (err: any) {
      setErrorMsg(`Failed to save branding: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (key: keyof BrandingConfig) => {
    setBranding((prev) => ({ ...prev, [key]: DEFAULT_BRANDING[key] }));
    setSuccessMsg(`Reset ${key} to official default. Click "Save & Publish" to confirm.`);
  };

  const handleResetAll = () => {
    if (confirm('Reset ALL branding assets to official SBG MUSIC defaults?')) {
      setBranding(DEFAULT_BRANDING);
      setSuccessMsg('Reset all assets to official defaults. Click "Save & Publish" to confirm.');
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Breadcrumb & Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
              <Link to="/admin" className="hover:text-purple-400 transition-colors">Admin</Link>
              <span>/</span>
              <span className="text-zinc-200">Settings</span>
              <span>/</span>
              <span className="text-purple-400 font-semibold">Branding CMS</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Palette className="w-8 h-8 text-purple-400" />
              SBG MUSIC Branding CMS
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Centralized branding and logo management across Android APK, web portal, and PWA.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleResetAll}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-sm font-semibold transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset All Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Publishing...' : 'Save & Publish'}
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 text-sm animate-fade-in">
            <Check className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3 text-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Live Admin Branding Previews (Section 4 Requirement) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* 1. Current Primary Logo Preview */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-purple-400 font-bold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Current In-App / Web Logo
              </span>
              <span className="text-[11px] text-zinc-500">Live Preview</span>
            </div>
            
            <div className="h-44 rounded-xl bg-[#141416] border border-zinc-800/80 flex items-center justify-center p-4 relative group overflow-hidden">
              <img 
                src={branding.appLogo} 
                alt="Current Primary Logo"
                className="max-h-36 max-w-full object-contain filter drop-shadow-lg group-hover:scale-105 transition-transform" 
                onError={(e) => { (e.target as any).src = DEFAULT_BRANDING.appLogo; }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-xs font-semibold text-white bg-zinc-800/90 px-3 py-1.5 rounded-lg border border-zinc-700">Official Brand Mark</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Target: 512 × 512 px</span>
              <span className="text-emerald-400 font-medium">SVG / PNG with alpha</span>
            </div>
          </div>

          {/* 2. Current App Icon Preview */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-purple-400 font-bold flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                Current Android Launcher Icon
              </span>
              <span className="text-[11px] text-zinc-500">Live Preview</span>
            </div>
            
            <div className="h-44 rounded-xl bg-[#141416] border border-zinc-800/80 flex items-center justify-center gap-6 p-4">
              {/* Standard squircle icon */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-20 h-20 rounded-[22px] overflow-hidden shadow-2xl border border-zinc-700/60 bg-[#121214]">
                  <img 
                    src={branding.appIcon} 
                    alt="Current App Icon" 
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as any).src = DEFAULT_BRANDING.appIcon; }}
                  />
                </div>
                <span className="text-[10px] text-zinc-400">Square/Adaptive</span>
              </div>

              {/* Round icon */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-20 h-20 rounded-full overflow-hidden shadow-2xl border border-zinc-700/60 bg-[#121214]">
                  <img 
                    src={branding.appIcon} 
                    alt="Current Round Icon" 
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as any).src = DEFAULT_BRANDING.appIcon; }}
                  />
                </div>
                <span className="text-[10px] text-zinc-400">Round Icon</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Label: SBG MUSIC</span>
              <span className="text-purple-400 font-medium">All Mipmap Densities</span>
            </div>
          </div>

          {/* 3. Current Splash Screen Preview */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-purple-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Current Splash Screen
              </span>
              <span className="text-[11px] text-zinc-500">Live Preview</span>
            </div>
            
            <div className="h-44 rounded-xl bg-[#141416] border border-zinc-800/80 flex items-center justify-center p-2 overflow-hidden">
              <div className="w-24 h-40 rounded-xl bg-[#121214] border border-zinc-700/80 shadow-2xl flex flex-col items-center justify-center p-2 relative">
                <img 
                  src={branding.splashLogo} 
                  alt="Splash Preview" 
                  className="w-16 h-auto object-contain"
                  onError={(e) => { (e.target as any).src = DEFAULT_BRANDING.splashLogo; }}
                />
                <span className="absolute bottom-2 text-[8px] font-bold text-purple-400 tracking-wider">SBG MUSIC</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Aspect: 9:16 Portrait</span>
              <span className="text-indigo-400 font-medium">Launch Transition</span>
            </div>
          </div>

        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-800 gap-6">
          <button
            onClick={() => setActiveTab('logos')}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'logos' ? 'text-purple-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Brand & App Logos
            {activeTab === 'logos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />}
          </button>
          <button
            onClick={() => setActiveTab('icons')}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'icons' ? 'text-purple-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Application & Browser Icons
            {activeTab === 'icons' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />}
          </button>
          <button
            onClick={() => setActiveTab('defaults')}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'defaults' ? 'text-purple-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Default Artwork & Avatars
            {activeTab === 'defaults' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />}
          </button>
        </div>

        {/* Brand Asset Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {activeTab === 'logos' && (
            <>
              {/* 1. App Primary Logo */}
              <AssetCard
                title="Primary SBG MUSIC Logo"
                description="Used in Header navigation, Player modal, and Mobile drawer."
                assetKey="appLogo"
                url={branding.appLogo}
                meta={imageMeta['appLogo']}
                uploadingPct={uploadProgress['appLogo']}
                onUpload={(f) => handleFileSelect('appLogo', f)}
                onReset={() => handleReset('appLogo')}
                onUrlChange={(url) => setBranding((p) => ({ ...p, appLogo: url }))}
                fileInputRef={fileInputRefs.appLogo}
              />

              {/* 2. Website Logo */}
              <AssetCard
                title="Website Header Logo"
                description="Prominently displayed at the top of the desktop and tablet website."
                assetKey="websiteLogo"
                url={branding.websiteLogo}
                meta={imageMeta['websiteLogo']}
                uploadingPct={uploadProgress['websiteLogo']}
                onUpload={(f) => handleFileSelect('websiteLogo', f)}
                onReset={() => handleReset('websiteLogo')}
                onUrlChange={(url) => setBranding((p) => ({ ...p, websiteLogo: url }))}
                fileInputRef={fileInputRefs.websiteLogo}
              />

              {/* 3. Splash Screen Logo */}
              <AssetCard
                title="Splash Screen Logo"
                description="Displays upon launching Android APK and progressive web app."
                assetKey="splashLogo"
                url={branding.splashLogo}
                meta={imageMeta['splashLogo']}
                uploadingPct={uploadProgress['splashLogo']}
                onUpload={(f) => handleFileSelect('splashLogo', f)}
                onReset={() => handleReset('splashLogo')}
                onUrlChange={(url) => setBranding((p) => ({ ...p, splashLogo: url }))}
                fileInputRef={fileInputRefs.splashLogo}
              />

              {/* 4. Login Screen Logo */}
              <AssetCard
                title="Login & Auth Modal Logo"
                description="Displayed above the Google Sign-In and Admin email login forms."
                assetKey="loginLogo"
                url={branding.loginLogo}
                meta={imageMeta['loginLogo']}
                uploadingPct={uploadProgress['loginLogo']}
                onUpload={(f) => handleFileSelect('loginLogo', f)}
                onReset={() => handleReset('loginLogo')}
                onUrlChange={(url) => setBranding((p) => ({ ...p, loginLogo: url }))}
                fileInputRef={fileInputRefs.loginLogo}
              />
            </>
          )}

          {activeTab === 'icons' && (
            <>
              {/* 5. Android Launcher App Icon */}
              <AssetCard
                title="Android App Icon"
                description="Launcher icon bundled into APK mipmaps and desktop shortcut."
                assetKey="appIcon"
                url={branding.appIcon}
                meta={imageMeta['appIcon']}
                uploadingPct={uploadProgress['appIcon']}
                onUpload={(f) => handleFileSelect('appIcon', f)}
                onReset={() => handleReset('appIcon')}
                onUrlChange={(url) => setBranding((p) => ({ ...p, appIcon: url }))}
                fileInputRef={fileInputRefs.appIcon}
              />

              {/* 6. Browser Favicon */}
              <AssetCard
                title="Browser Favicon"
                description="Small icon visible in browser tabs and bookmarks bar."
                assetKey="favicon"
                url={branding.favicon}
                meta={imageMeta['favicon']}
                uploadingPct={uploadProgress['favicon']}
                onUpload={(f) => handleFileSelect('favicon', f)}
                onReset={() => handleReset('favicon')}
                onUrlChange={(url) => setBranding((p) => ({ ...p, favicon: url }))}
                fileInputRef={fileInputRefs.favicon}
              />
            </>
          )}

          {activeTab === 'defaults' && (
            <>
              {/* 7. Default Music Artwork */}
              <AssetCard
                title="Default Music Artwork"
                description="Fallback image rendered for songs or playlists missing cover art."
                assetKey="defaultMusicArtwork"
                url={branding.defaultMusicArtwork}
                meta={imageMeta['defaultMusicArtwork']}
                uploadingPct={uploadProgress['defaultMusicArtwork']}
                onUpload={(f) => handleFileSelect('defaultMusicArtwork', f)}
                onReset={() => handleReset('defaultMusicArtwork')}
                onUrlChange={(url) => setBranding((p) => ({ ...p, defaultMusicArtwork: url }))}
                fileInputRef={fileInputRefs.defaultMusicArtwork}
              />

              {/* 8. Default User Avatar */}
              <AssetCard
                title="Default User Avatar"
                description="Fallback profile icon for new or anonymous users."
                assetKey="defaultUserAvatar"
                url={branding.defaultUserAvatar}
                meta={imageMeta['defaultUserAvatar']}
                uploadingPct={uploadProgress['defaultUserAvatar']}
                onUpload={(f) => handleFileSelect('defaultUserAvatar', f)}
                onReset={() => handleReset('defaultUserAvatar')}
                onUrlChange={(url) => setBranding((p) => ({ ...p, defaultUserAvatar: url }))}
                fileInputRef={fileInputRefs.defaultUserAvatar}
              />
            </>
          )}

        </div>

      </div>
    </div>
  );
}

function AssetCard({
  title,
  description,
  assetKey,
  url,
  meta,
  uploadingPct,
  onUpload,
  onReset,
  onUrlChange,
  fileInputRef,
}: {
  title: string;
  description: string;
  assetKey: string;
  url: string;
  meta?: ImageValidation;
  uploadingPct?: number;
  onUpload: (file: File) => void;
  onReset: () => void;
  onUrlChange: (url: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-lg text-white">{title}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
          </div>
          <button
            onClick={onReset}
            title="Reset to default"
            className="text-xs text-zinc-500 hover:text-purple-400 transition-colors p-1"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Thumbnail Preview with Checkerboard for Transparency */}
        <div className="mt-4 h-44 rounded-xl border border-zinc-800 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] bg-[#141416] flex items-center justify-center p-3 relative group overflow-hidden">
          <img
            src={url}
            alt={title}
            className="max-h-36 max-w-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform"
            onError={(e) => {
              (e.target as any).src = DEFAULT_BRANDING[assetKey as keyof BrandingConfig];
            }}
          />

          {uploadingPct !== undefined && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
              <span className="text-sm font-bold text-purple-400">{uploadingPct}% Uploading...</span>
              <div className="w-36 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300" 
                  style={{ width: `${uploadingPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {meta && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Dimensions: {meta.width} × {meta.height} px</span>
            <span>Size: {meta.sizeKb} KB</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-2 border-t border-zinc-800/60">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef as any}
            className="hidden"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload New File
          </button>
        </div>

        {/* Direct URL input option */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="Asset URL (https://...)"
            className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>
    </div>
  );
}
