import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  HardDrive, 
  Copy, 
  Check, 
  FileCode, 
  Sparkles, 
  Trash2, 
  ExternalLink, 
  Radio, 
  Plus, 
  Layers, 
  RefreshCw, 
  ShieldCheck, 
  Loader2, 
  Download,
  Star,
  FileCheck,
  Cpu
} from 'lucide-react';
import { AndroidRelease } from '../types';
import { 
  listAllReleases, 
  saveRelease, 
  setDefaultRelease, 
  deleteRelease, 
  validateApkFile, 
  uploadApkToStorage,
  DEFAULT_STANDALONE_RELEASE,
  triggerDirectApkDownload
} from '../lib/apkReleaseService';
import { useAuth } from '../context/AuthProvider';

export default function AdminGetAppControl() {
  const { user } = useAuth();
  const userEmail = user?.email || 'admin@sbgmusic.com';

  const [releases, setReleases] = useState<AndroidRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidation, setFileValidation] = useState<{
    isValid: boolean;
    error?: string;
    sizeBytes: number;
    sizeFormatted: string;
    sha256?: string;
    suggestedVersion?: string;
  } | null>(null);
  const [validatingFile, setValidatingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [appName, setAppName] = useState('SBG MUSIC');
  const [versionName, setVersionName] = useState('2.5.0');
  const [versionCode, setVersionCode] = useState(250);
  const [releaseName, setReleaseName] = useState('Official Production Build');
  const [releaseNotes, setReleaseNotes] = useState(
    '• User Offline Storage: Download eligible tracks straight to device storage\n• Dual Catalog: Stream YouTube discovery tracks alongside high-bitrate SBG releases\n• Synchronized LRC Lyrics: Real-time word-by-word synced lyrics\n• Battery & Data Saver: Intelligent local audio caching'
  );
  const [minAndroid, setMinAndroid] = useState('Android 5.0+ (Lollipop to 15)');
  const [targetAndroid, setTargetAndroid] = useState('Android 14 (API Level 34)');
  const [buttonText, setButtonText] = useState('Download Android APK');
  const [installInstructions, setInstallInstructions] = useState(
    '1. Download APK: Tap Download Android APK button.\n2. Allow Unknown Sources: In Android Settings, allow installation from your browser.\n3. Open and Install: Tap the downloaded file in notification bar and choose Install.\n4. Sign In & Enjoy: Automatically sync playlists, favorites, and offline songs!'
  );
  const [makeDefault, setMakeDefault] = useState(true);
  const [isPublished, setIsPublished] = useState(true);

  const fetchReleases = async () => {
    setLoading(true);
    try {
      const data = await listAllReleases();
      setReleases(data);
    } catch (e) {
      console.warn('Failed to fetch releases:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setValidatingFile(true);
    setFileValidation(null);

    try {
      const res = await validateApkFile(file);
      setFileValidation(res);

      if (res.suggestedVersion) {
        setVersionName(res.suggestedVersion);
        const codeNum = parseInt(res.suggestedVersion.replace(/\./g, ''), 10);
        if (!isNaN(codeNum)) setVersionCode(codeNum);
      }
    } catch (err: any) {
      setFileValidation({
        isValid: false,
        error: err.message || 'Validation error',
        sizeBytes: file.size,
        sizeFormatted: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      });
    } finally {
      setValidatingFile(false);
    }
  };

  const handleUploadAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setStatusMsg({ type: 'error', text: 'Please select an Android APK file to upload.' });
      return;
    }

    if (fileValidation && !fileValidation.isValid) {
      setStatusMsg({ type: 'error', text: fileValidation.error || 'Invalid APK file.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    const releaseId = `rel_${Date.now()}`;

    try {
      // 1. Upload APK to Firebase Storage
      const { taskPromise } = uploadApkToStorage(
        selectedFile,
        releaseId,
        (prog) => setUploadProgress(prog.percent)
      );

      const { downloadUrl, storagePath } = await taskPromise;

      // 2. Save metadata document to Firestore androidReleases/{releaseId}
      const newRelease: AndroidRelease = {
        id: releaseId,
        appName: appName.trim(),
        versionName: versionName.trim(),
        versionCode: Number(versionCode) || 1,
        releaseName: releaseName.trim(),
        releaseNotes: releaseNotes.trim(),
        storagePath,
        downloadUrl,
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
        fileSizeFormatted: fileValidation?.sizeFormatted || `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
        sha256: fileValidation?.sha256 || '',
        minAndroidVersion: minAndroid.trim(),
        targetAndroidVersion: targetAndroid.trim(),
        downloadButtonText: buttonText.trim(),
        installInstructions: installInstructions.trim(),
        published: isPublished,
        isDefault: makeDefault,
        downloadCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: userEmail,
      };

      await saveRelease(newRelease, makeDefault);

      setStatusMsg({
        type: 'success',
        text: `Release v${versionName} uploaded and published successfully to Firebase Storage & Firestore!`,
      });
      setShowUploadModal(false);
      setSelectedFile(null);
      setFileValidation(null);
      setUploadProgress(null);
      await fetchReleases();
    } catch (err: any) {
      console.error('Failed to upload/save release:', err);
      setStatusMsg({ type: 'error', text: err.message || 'Failed to upload APK to Firebase Storage.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (rel: AndroidRelease) => {
    if (!window.confirm(`Set v${rel.versionName} as the default active release for all website visitors?`)) {
      return;
    }

    try {
      await setDefaultRelease(rel.id, userEmail);
      setStatusMsg({ type: 'success', text: `v${rel.versionName} is now the active default release.` });
      await fetchReleases();
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Failed to set default release.' });
    }
  };

  const handleDelete = async (rel: AndroidRelease) => {
    if (!window.confirm(`Permanently delete release v${rel.versionName} and remove its binary from Firebase Storage?`)) {
      return;
    }

    try {
      await deleteRelease(rel.id);
      setStatusMsg({ type: 'success', text: `Release v${rel.versionName} deleted.` });
      await fetchReleases();
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Failed to delete release.' });
    }
  };

  const handleSeedDefault = async () => {
    try {
      await saveRelease(DEFAULT_STANDALONE_RELEASE, true);
      setStatusMsg({ type: 'success', text: 'Initialized default official release in Firestore androidReleases.' });
      await fetchReleases();
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Failed to seed default release.' });
    }
  };

  const defaultRelease = releases.find((r) => r.isDefault) || (releases.length > 0 ? releases[0] : null);

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="bg-[#111112] p-6 sm:p-8 rounded-3xl border border-white/5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-xl">
            <Smartphone size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Get App / APK Management</h1>
            <p className="text-xs text-white/50">
              Manage Android releases, upload APKs to Firebase Storage, and dynamically control the <span className="font-mono text-purple-400">/download</span> page.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {releases.length === 0 && !loading && (
            <button
              onClick={handleSeedDefault}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 transition-all cursor-pointer"
            >
              Seed Official v2.4.0
            </button>
          )}

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>Upload New APK</span>
          </button>
        </div>
      </div>

      {/* Status Feedback */}
      {statusMsg && (
        <div className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-3 border ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* ACTIVE DEFAULT RELEASE HERO CARD */}
      {defaultRelease && (
        <div className="rounded-3xl bg-gradient-to-r from-purple-950/40 via-[#141418] to-black border border-purple-500/30 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                <Star size={12} className="fill-current" />
                <span>Active Website Default Release</span>
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight">
                {defaultRelease.appName} v{defaultRelease.versionName}
              </h2>

              <p className="text-xs text-white/60">
                Package: <span className="font-mono text-white/80">{defaultRelease.fileName}</span> • Size: <span className="font-mono text-emerald-400">{defaultRelease.fileSizeFormatted}</span> • Released: {new Date(defaultRelease.createdAt).toLocaleDateString()}
              </p>

              {defaultRelease.storagePath && (
                <div className="text-[11px] font-mono text-purple-300/80 bg-purple-950/40 px-3 py-1 rounded-lg border border-purple-500/20 inline-block">
                  Storage Path: {defaultRelease.storagePath}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => triggerDirectApkDownload(defaultRelease)}
                className="px-5 py-3 bg-white text-black hover:bg-white/90 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Download size={15} />
                <span>Test Direct Download</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RELEASES LIST TABLE */}
      <div className="bg-[#111112] rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">All Android Releases</h2>
            <p className="text-xs text-white/50">Stored in Firestore collection <span className="font-mono text-purple-400">androidReleases</span></p>
          </div>
          <button
            onClick={fetchReleases}
            className="p-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-colors cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-white/40 text-xs">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-purple-400" />
            Loading releases...
          </div>
        ) : releases.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Smartphone size={32} className="mx-auto text-white/20" />
            <p className="text-xs text-white/50">No Android releases found in Firestore database.</p>
            <button
              onClick={handleSeedDefault}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Seed Official Release (v2.4.0)
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {releases.map((rel) => {
              const isDef = Boolean(rel.isDefault);
              return (
                <div key={rel.id} className="p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-extrabold text-white text-base">v{rel.versionName}</span>
                      <span className="text-xs text-white/60 font-mono">({rel.fileName})</span>
                      {isDef ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                          Active Default
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-white/50 border border-white/10 uppercase tracking-wider">
                          Archived
                        </span>
                      )}
                      {rel.published ? (
                        <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                          Published
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                          Draft
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-white/50 font-mono flex-wrap">
                      <span>Size: {rel.fileSizeFormatted}</span>
                      <span>Target: {rel.targetAndroidVersion}</span>
                      <span>Min: {rel.minAndroidVersion}</span>
                      <span>Created: {new Date(rel.createdAt).toLocaleDateString()}</span>
                    </div>

                    {rel.sha256 && (
                      <div className="flex items-center gap-2 text-[11px] font-mono text-white/40 pt-1">
                        <span>SHA-256:</span>
                        <span className="truncate max-w-xs">{rel.sha256}</span>
                        <button
                          onClick={() => handleCopy(rel.sha256, rel.id)}
                          className="hover:text-white transition-colors cursor-pointer"
                          title="Copy Checksum"
                        >
                          {copiedId === rel.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isDef && (
                      <button
                        onClick={() => handleSetDefault(rel)}
                        className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-xl text-xs font-bold border border-purple-500/30 transition-all cursor-pointer"
                      >
                        Make Default
                      </button>
                    )}

                    <button
                      onClick={() => triggerDirectApkDownload(rel)}
                      className="p-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition-all cursor-pointer"
                      title="Download APK"
                    >
                      <Download size={15} />
                    </button>

                    <button
                      onClick={() => handleDelete(rel)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs transition-colors cursor-pointer border border-red-500/20"
                      title="Delete Release"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111116] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-8 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Upload New Android APK</h3>
                  <p className="text-xs text-white/50">Stored in Firebase Storage & Firestore</p>
                </div>
              </div>

              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 text-white/40 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadAndSave} className="space-y-4">
              {/* File Select */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-white/60">
                  Select Android APK File (.apk) *
                </label>
                <div className="border-2 border-dashed border-white/15 hover:border-purple-500/50 rounded-2xl p-6 text-center bg-white/[0.02] transition-colors relative cursor-pointer">
                  <input
                    type="file"
                    accept=".apk,application/vnd.android.package-archive"
                    onChange={handleFileSelect}
                    required
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2">
                    <FileCode size={32} className="mx-auto text-purple-400" />
                    <p className="text-xs font-bold text-white">
                      {selectedFile ? selectedFile.name : 'Choose APK file or drag and drop here'}
                    </p>
                    <p className="text-[11px] text-white/40">Only genuine signed .apk archives</p>
                  </div>
                </div>

                {validatingFile && (
                  <div className="text-xs text-purple-400 flex items-center gap-2 pt-1 font-mono">
                    <Loader2 size={13} className="animate-spin" />
                    <span>Verifying ZIP headers & calculating SHA-256 hash...</span>
                  </div>
                )}

                {fileValidation && (
                  <div className={`p-3 rounded-xl text-xs font-mono border ${
                    fileValidation.isValid
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/20 text-red-300'
                  }`}>
                    {fileValidation.isValid ? (
                      <div className="space-y-1">
                        <div>✓ Valid APK package structure</div>
                        <div>Size: {fileValidation.sizeFormatted}</div>
                        <div className="truncate">SHA-256: {fileValidation.sha256}</div>
                      </div>
                    ) : (
                      <div>✕ {fileValidation.error}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Version & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1">
                    Version Name *
                  </label>
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    required
                    placeholder="2.5.0"
                    className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1">
                    Version Code *
                  </label>
                  <input
                    type="number"
                    value={versionCode}
                    onChange={(e) => setVersionCode(parseInt(e.target.value, 10))}
                    required
                    placeholder="250"
                    className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Release Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1">
                  Release Name
                </label>
                <input
                  type="text"
                  value={releaseName}
                  onChange={(e) => setReleaseName(e.target.value)}
                  placeholder="Official Production Build"
                  className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-purple-500"
                />
              </div>

              {/* Compatibility */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1">
                    Minimum Android Version
                  </label>
                  <input
                    type="text"
                    value={minAndroid}
                    onChange={(e) => setMinAndroid(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1">
                    Target Android Version
                  </label>
                  <input
                    type="text"
                    value={targetAndroid}
                    onChange={(e) => setTargetAndroid(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Release Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1">
                  Release Notes / What's New (one bullet per line)
                </label>
                <textarea
                  rows={3}
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-xs outline-none focus:border-purple-500 font-mono"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={makeDefault}
                    onChange={(e) => setMakeDefault(e.target.checked)}
                    className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-bold">Set as Active Default Release</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span>Publish Immediately</span>
                </label>
              </div>

              {/* Upload Progress */}
              {uploadProgress !== null && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs text-purple-300 font-mono">
                    <span>Uploading APK to Firebase Storage...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !selectedFile || (fileValidation !== null && !fileValidation.isValid)}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span>{isSubmitting ? 'Uploading APK...' : 'Upload & Save Release'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
