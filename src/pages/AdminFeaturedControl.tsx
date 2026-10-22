import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Play, 
  Youtube, 
  Music, 
  ListMusic, 
  User, 
  Disc, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Power, 
  Plus, 
  Clock, 
  Eye, 
  EyeOff, 
  Loader2,
  X,
  Search,
  Check,
  ArrowRight
} from 'lucide-react';
import { 
  UnifiedFeaturedConfig, 
  FeaturedHistoryItem, 
  FeaturedContentType, 
  Song, 
  Playlist,
  FeaturedCtaLink 
} from '../types';
import { 
  getActiveFeatured, 
  saveActiveFeatured, 
  setFeaturedEnabled, 
  removeActiveFeatured, 
  fetchFeaturedHistory, 
  activateHistoryItem, 
  deleteHistoryItem,
  invalidateFeaturedCaches,
  getSongArtwork,
  sanitizeAndValidateUrl
} from '../lib/featured';
import { fetchAllFirestoreSongs, usePaginatedPlaylists } from '../hooks/useCatalog';
import { useAuth } from '../context/AuthProvider';
import { fetchYouTubePlaylistServer } from '../lib/youtubeImportService';
import { 
  getNavigationVisibility, 
  saveNavigationVisibility, 
  NavigationVisibilitySettings, 
  DEFAULT_NAVIGATION_VISIBILITY 
} from '../lib/navigationSettings';

export default function AdminFeaturedControl() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'admin' || hasPermission('manage_featured');
  const userEmail = user?.email || user?.displayName || 'admin';

  // Active item state
  const [activeItem, setActiveItem] = useState<UnifiedFeaturedConfig | null>(null);
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<any | null>(null);
  const [historyItems, setHistoryItems] = useState<FeaturedHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Navigation & UI Visibility state (Firestore settings/navigationVisibility)
  const [navSettings, setNavSettings] = useState<NavigationVisibilitySettings>(DEFAULT_NAVIGATION_VISIBILITY);
  const [navLoading, setNavLoading] = useState(false);
  const [navSuccessMsg, setNavSuccessMsg] = useState('');
  const [navErrorMsg, setNavErrorMsg] = useState('');

  // Catalog items for picking
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<Playlist[]>([]);

  // Modal / Creator State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [historyItemToActivate, setHistoryItemToActivate] = useState<FeaturedHistoryItem | null>(null);

  // Form Fields
  const [formType, setFormType] = useState<FeaturedContentType>('song');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formThumbnail, setFormThumbnail] = useState('');
  const [formBadge, setFormBadge] = useState('FEATURED RELEASE');
  const [formCtaText, setFormCtaText] = useState('Listen Now');
  const [formCtaDest, setFormCtaDest] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(1);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formArtistName, setFormArtistName] = useState('');
  const [formAlbumName, setFormAlbumName] = useState('');
  const [formExternalLinks, setFormExternalLinks] = useState<FeaturedCtaLink[]>([]);

  // Specific Selection State
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubePlaylistId, setYoutubePlaylistId] = useState<string | null>(null);
  const [youtubeChannelTitle, setYoutubeChannelTitle] = useState('');
  const [youtubePreviewMeta, setYoutubePreviewMeta] = useState<any | null>(null);
  const [fetchingYt, setFetchingYt] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState('');

  // Load Active Item & History
  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [featRes, hist, songs, navVis] = await Promise.all([
        getActiveFeatured(forceRefresh),
        fetchFeaturedHistory(),
        fetchAllFirestoreSongs(forceRefresh),
        getNavigationVisibility(forceRefresh)
      ]);

      setActiveItem(featRes.config);
      setActiveSong(featRes.song || null);
      setActivePlaylist(featRes.playlist || null);
      setHistoryItems(hist);
      setAllSongs(songs);
      if (navVis) {
        setNavSettings(navVis);
      }

      // Try fetching playlists for picker
      try {
        const res = await fetch('/api/catalog/playlists');
        if (res.ok) {
          const pJson = await res.json();
          if (pJson.ok && Array.isArray(pJson.playlists)) {
            setAllPlaylists(pJson.playlists);
          }
        }
      } catch {}
    } catch (err: any) {
      console.error('[AdminFeaturedControl] Load failed:', err);
      setErrorMsg('Failed to load featured configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4500);
  };

  // Save Navigation Visibility to settings/navigationVisibility
  const handleSaveNavVisibility = async () => {
    setNavLoading(true);
    setNavSuccessMsg('');
    setNavErrorMsg('');
    try {
      await saveNavigationVisibility(navSettings, userEmail);
      setNavSuccessMsg('Navigation & UI visibility settings saved to settings/navigationVisibility successfully!');
      setTimeout(() => setNavSuccessMsg(''), 4500);
    } catch (err: any) {
      console.error('Failed to save navigation settings:', err);
      setNavErrorMsg('Failed to save navigation settings: ' + (err.message || String(err)));
    } finally {
      setNavLoading(false);
    }
  };

  const handleResetNavDefaults = () => {
    setNavSettings(DEFAULT_NAVIGATION_VISIBILITY);
  };

  // External Links helpers for editor modal
  const handleAddExternalLink = () => {
    const newLink: FeaturedCtaLink = {
      id: 'link_' + Date.now(),
      label: '',
      url: '',
      enabled: true,
      order: formExternalLinks.length + 1,
      icon: 'globe',
      description: '',
    };
    setFormExternalLinks([...formExternalLinks, newLink]);
  };

  const handleUpdateExternalLink = (index: number, updates: Partial<FeaturedCtaLink>) => {
    setFormExternalLinks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemoveExternalLink = (index: number) => {
    setFormExternalLinks((prev) => prev.filter((_, i) => i !== index));
  };

  // Open Form to Edit Current Active Item
  const handleOpenEdit = () => {
    if (!activeItem) return;
    setEditorMode('edit');
    setFormType(activeItem.type || 'song');
    setFormTitle(activeItem.title || '');
    setFormSubtitle(activeItem.subtitle || '');
    setFormDescription(activeItem.description || '');
    setFormThumbnail(activeItem.thumbnailUrl || '');
    setFormBadge(activeItem.badge || 'FEATURED RELEASE');
    setFormCtaText(activeItem.ctaText || 'Listen Now');
    setFormCtaDest(activeItem.ctaDestination || '');
    setFormDisplayOrder(activeItem.displayOrder || 1);
    setFormEnabled(activeItem.enabled !== false);
    setFormStartDate(activeItem.startDate || '');
    setFormEndDate(activeItem.endDate || '');
    setFormArtistName(activeItem.artistName || '');
    setFormAlbumName(activeItem.albumName || '');
    setFormExternalLinks(activeItem.externalLinks || []);
    setSelectedSongId(activeItem.songId || activeItem.featuredSongId || null);
    setSelectedPlaylistId(activeItem.playlistId || null);
    setYoutubePlaylistId(activeItem.youtubePlaylistId || null);
    setYoutubeChannelTitle(activeItem.channelTitle || '');
    setYoutubeInput(activeItem.youtubePlaylistId ? `https://youtube.com/playlist?list=${activeItem.youtubePlaylistId}` : '');
    setIsEditorOpen(true);
  };

  // Open Form to Create / Replace with New Item
  const handleOpenCreate = () => {
    setEditorMode('create');
    setFormType('song');
    setFormTitle('');
    setFormSubtitle('');
    setFormDescription('');
    setFormThumbnail('');
    setFormBadge('FEATURED RELEASE');
    setFormCtaText('Listen Now');
    setFormCtaDest('');
    setFormDisplayOrder(1);
    setFormEnabled(true);
    setFormStartDate('');
    setFormEndDate('');
    setFormArtistName('');
    setFormAlbumName('');
    setFormExternalLinks([
      { id: 'link_sbg_' + Date.now(), label: 'SBG ESPORTS', url: 'https://www.youtube.com/@SBGESPORTS', enabled: true, order: 1, icon: 'youtube', description: 'Official Gaming, Tournaments & Esports Hub' },
      { id: 'link_ig_' + Date.now(), label: 'Instagram', url: 'https://instagram.com/sbg_esports_official', enabled: true, order: 2, icon: 'instagram', description: 'Updates, Reels, Highlights & BTS' },
      { id: 'link_backup_' + Date.now(), label: 'SBG SONG Backup Website', url: 'https://sbgsongs.vercel.app', enabled: true, order: 3, icon: 'globe', description: 'Fast Mirror & Catalog Backup Server' }
    ]);
    setSelectedSongId(null);
    setSelectedPlaylistId(null);
    setYoutubePlaylistId(null);
    setYoutubeChannelTitle('');
    setYoutubePreviewMeta(null);
    setYoutubeInput('');
    setIsEditorOpen(true);
  };

  // Fetch YouTube Playlist Metadata
  const handleFetchYoutubeMetadata = async () => {
    const raw = youtubeInput.trim();
    if (!raw) return;
    let playlistId = raw;
    const match = raw.match(/[&?]list=([^&]+)/) || raw.match(/playlist\/([^?\/]+)/);
    if (match) playlistId = match[1];

    setFetchingYt(true);
    setErrorMsg('');
    try {
      const meta = await fetchYouTubePlaylistServer(playlistId);
      if (!meta) throw new Error('No metadata returned for playlist ID: ' + playlistId);

      setYoutubePlaylistId(playlistId);
      setYoutubeChannelTitle(meta.author || 'YouTube Curator');
      setYoutubePreviewMeta(meta);
      if (!formTitle) setFormTitle(meta.title || 'Featured YouTube Playlist');
      if (!formSubtitle) setFormSubtitle(meta.author || 'YouTube Curator');
      if (!formDescription && meta.description) setFormDescription(meta.description.slice(0, 250));
      if (!formThumbnail && meta.thumbnailUrl) setFormThumbnail(meta.thumbnailUrl);
      if (!formBadge || formBadge === 'FEATURED RELEASE') setFormBadge('YOUTUBE SPOTLIGHT');
      if (!formCtaText || formCtaText === 'Listen Now') setFormCtaText('Play Playlist');
      setFormCtaDest(`https://youtube.com/playlist?list=${playlistId}`);

      showNotification(`Loaded playlist "${meta.title}" (${meta.videos?.length || 0} items)`);
    } catch (err: any) {
      console.error('[AdminFeaturedControl] YouTube metadata fetch error:', err);
      setErrorMsg(`Failed to fetch YouTube playlist metadata: ${err.message || String(err)}`);
    } finally {
      setFetchingYt(false);
    }
  };

  // Save / Commit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    // Validation
    if (!formTitle.trim()) {
      setErrorMsg('Please enter a featured title.');
      return;
    }

    if (formType === 'song' && !selectedSongId) {
      setErrorMsg('Please select a song from the catalog.');
      return;
    }

    if (formType === 'playlist' && !selectedPlaylistId) {
      setErrorMsg('Please select a playlist from the catalog.');
      return;
    }

    if (formType === 'youtube_playlist' && !youtubePlaylistId) {
      setErrorMsg('Please provide a valid YouTube playlist URL or ID and click Fetch.');
      return;
    }

    // Check if replacing another active item
    const isReplacing = editorMode === 'create' && activeItem && activeItem.enabled && activeItem.title;
    if (isReplacing && !showReplaceConfirm) {
      setShowReplaceConfirm(true);
      return;
    }

    setActionLoading(true);
    setErrorMsg('');

    try {
      const payload: Partial<UnifiedFeaturedConfig> = {
        enabled: formEnabled,
        type: formType,
        title: formTitle.trim(),
        subtitle: formSubtitle.trim(),
        description: formDescription.trim(),
        thumbnailUrl: formThumbnail.trim(),
        badge: formBadge.trim() || 'FEATURED RELEASE',
        ctaText: formCtaText.trim() || 'Listen Now',
        ctaDestination: formCtaDest.trim(),
        displayOrder: formDisplayOrder || 1,
        externalLinks: formExternalLinks,
        startDate: formStartDate || null,
        endDate: formEndDate || null,
        artistName: formArtistName.trim(),
        albumName: formAlbumName.trim(),
        songId: formType === 'song' ? selectedSongId : null,
        featuredSongId: formType === 'song' ? selectedSongId : null,
        playlistId: formType === 'playlist' ? selectedPlaylistId : null,
        youtubePlaylistId: formType === 'youtube_playlist' ? youtubePlaylistId : null,
        youtubeUrl: formType === 'youtube_playlist' ? (youtubeInput.trim().startsWith('http') ? youtubeInput.trim() : `https://youtube.com/playlist?list=${youtubePlaylistId}`) : null,
        channelTitle: formType === 'youtube_playlist' ? youtubeChannelTitle : '',
        source: formType === 'youtube_playlist' ? 'youtube' : 'sbg',
      };

      await saveActiveFeatured(payload, true, userEmail);
      setIsEditorOpen(false);
      setShowReplaceConfirm(false);
      showNotification(`Featured item "${formTitle}" has been saved as the active homepage feature!`);
      await loadData(true);
    } catch (err: any) {
      console.error('[AdminFeaturedControl] Save failed:', err);
      setErrorMsg('Failed to save featured item: ' + (err.message || String(err)));
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Active Enable / Disable
  const handleToggleActive = async () => {
    if (!activeItem) return;
    setActionLoading(true);
    const newEnabled = !activeItem.enabled;
    try {
      await setFeaturedEnabled(newEnabled, userEmail);
      setActiveItem({ ...activeItem, enabled: newEnabled });
      showNotification(newEnabled ? 'Featured section enabled on homepage.' : 'Featured section disabled (hidden) from homepage.');
    } catch (err: any) {
      setErrorMsg('Failed to toggle status: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Remove / Archive Current Active Item
  const handleRemoveActive = async () => {
    if (!activeItem) return;
    if (!window.confirm('Are you sure you want to remove the currently active featured item? It will be archived in Featured History.')) return;

    setActionLoading(true);
    try {
      await removeActiveFeatured(userEmail);
      showNotification('Active featured item removed and archived to Featured History.');
      await loadData(true);
    } catch (err: any) {
      setErrorMsg('Failed to remove: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Activate an Item from History (prompts confirmation)
  const handleActivateHistoryClick = (item: FeaturedHistoryItem) => {
    if (activeItem && activeItem.enabled && activeItem.title) {
      setHistoryItemToActivate(item);
    } else {
      executeActivateHistory(item);
    }
  };

  const executeActivateHistory = async (item: FeaturedHistoryItem) => {
    setActionLoading(true);
    try {
      await activateHistoryItem(item, userEmail);
      setHistoryItemToActivate(null);
      showNotification(`Activated "${item.title}" as the active featured item.`);
      await loadData(true);
    } catch (err: any) {
      setErrorMsg('Failed to activate: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Item from History
  const handleDeleteHistory = async (id: string) => {
    if (!window.confirm('Delete this item permanently from history?')) return;
    try {
      await deleteHistoryItem(id);
      setHistoryItems((prev) => prev.filter((h) => h.id !== id));
      showNotification('History item deleted.');
    } catch (err: any) {
      setErrorMsg('Failed to delete history item.');
    }
  };

  // Type badge styling helper
  const getTypeBadge = (type?: FeaturedContentType) => {
    switch (type) {
      case 'song':
        return { label: 'Track / Song', icon: <Music size={12} />, bg: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
      case 'youtube_playlist':
        return { label: 'YouTube Playlist', icon: <Youtube size={12} />, bg: 'bg-red-500/20 text-red-300 border-red-500/30' };
      case 'playlist':
        return { label: 'Official Playlist', icon: <ListMusic size={12} />, bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'artist':
        return { label: 'Artist Spotlight', icon: <User size={12} />, bg: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
      case 'album':
        return { label: 'Album', icon: <Disc size={12} />, bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      default:
        return { label: 'Custom Release', icon: <Sparkles size={12} />, bg: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' };
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Top Banner & Control Bar */}
      <div className="bg-[#111112] p-6 sm:p-8 rounded-3xl border border-white/5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Featured Control</h1>
              <p className="text-xs text-white/50">Single source of truth for all homepage featured content. Only one item can be active at a time.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => loadData(true)}
            disabled={loading || actionLoading}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
            title="Refresh from server"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreate}
            disabled={!canManage || actionLoading}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>Create / Replace Featured</span>
          </button>
        </div>
      </div>

      {/* Status / Error alerts */}
      {statusMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle size={16} className="text-emerald-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SECTION 1: CURRENTLY ACTIVE FEATURED ITEM */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Currently Active Featured Item</h2>
          </div>
          {activeItem && (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              activeItem.enabled 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
            }`}>
              {activeItem.enabled ? 'Live on Homepage' : 'Section Disabled'}
            </span>
          )}
        </div>

        {activeItem && (activeItem.title || activeItem.songId || activeItem.featuredSongId || activeItem.youtubePlaylistId) ? (
          <div className="bg-[#111112] rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-white/5 pb-6">
              {/* Preview Thumbnail & Title */}
              <div className="flex items-start sm:items-center gap-5">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-black/60 border border-white/10 shrink-0 shadow-xl relative group">
                  {activeItem.thumbnailUrl || (activeSong && getSongArtwork(activeSong)) ? (
                    <img 
                      src={activeItem.thumbnailUrl || (activeSong ? getSongArtwork(activeSong) : '')} 
                      alt={activeItem.title} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <Music size={32} />
                    </div>
                  )}
                  {activeItem.type === 'youtube_playlist' && (
                    <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-red-600 text-white shadow-md">
                      <Youtube size={12} />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white font-extrabold text-[10px] uppercase tracking-wider border border-white/10">
                      {activeItem.badge || 'FEATURED'}
                    </span>
                    {(() => {
                      const badge = getTypeBadge(activeItem.type);
                      return (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      );
                    })()}
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {activeItem.title || 'Untitled Feature'}
                  </h3>

                  {activeItem.subtitle && (
                    <p className="text-xs sm:text-sm text-white/60">
                      {activeItem.subtitle}
                    </p>
                  )}

                  {activeItem.description && (
                    <p className="text-xs text-white/40 max-w-xl line-clamp-2 pt-0.5">
                      {activeItem.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 self-end md:self-center shrink-0">
                <button
                  onClick={handleToggleActive}
                  disabled={actionLoading || !canManage}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeItem.enabled
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-white/80 border-white/10'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/40 shadow-lg shadow-emerald-600/20'
                  }`}
                >
                  <Power size={13} />
                  <span>{activeItem.enabled ? 'Disable Section' : 'Enable Section'}</span>
                </button>

                <button
                  onClick={handleOpenEdit}
                  disabled={actionLoading || !canManage}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>Edit Details</span>
                </button>

                <button
                  onClick={handleOpenCreate}
                  disabled={actionLoading || !canManage}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-600/20"
                >
                  <RefreshCw size={13} />
                  <span>Replace Item</span>
                </button>

                <button
                  onClick={handleRemoveActive}
                  disabled={actionLoading || !canManage}
                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold border border-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Archive to history"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Metadata Footer matching Requirement 8 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-white/50 pt-2 border-t border-white/5">
              <div>
                <span className="block text-[10px] uppercase font-bold text-white/40 mb-0.5">Type:</span>
                <span className="font-semibold text-white">
                  {activeItem.type === 'song' ? 'Featured Song' :
                   activeItem.type === 'youtube_playlist' ? 'Featured YouTube Playlist' :
                   activeItem.type === 'playlist' ? 'Featured Playlist' :
                   activeItem.type === 'artist' ? 'Featured Artist' :
                   activeItem.type === 'album' ? 'Featured Album' :
                   'Featured Release / Banner'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-white/40 mb-0.5">Status:</span>
                <span className={`font-semibold ${activeItem.enabled ? 'text-emerald-400' : 'text-zinc-400'}`}>
                  {activeItem.enabled ? 'Active (Live on Homepage)' : 'Inactive (Section Disabled)'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-white/40 mb-0.5">Updated:</span>
                <span className="text-white/80">
                  {activeItem.updatedAt ? new Date(activeItem.updatedAt).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-white/40 mb-0.5">Updated by:</span>
                <span className="text-white/80 font-mono">
                  {activeItem.updatedBy || 'admin'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#111112] rounded-3xl border border-dashed border-white/10 p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">No Active Featured Item</h3>
              <p className="text-xs text-white/40 max-w-md mx-auto mt-1">
                The homepage featured hero is currently inactive. Select a song, YouTube playlist, or artist release to feature on the homepage.
              </p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="px-6 py-2.5 bg-white text-black font-extrabold text-xs rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
            >
              Activate a Featured Item
            </button>
          </div>
        )}
      </div>

      {/* SECTION 2: FEATURED HISTORY */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">FEATURED HISTORY</h2>
            <p className="text-xs text-white/40">Previous featured configurations without making them active. Click Activate to restore any item.</p>
          </div>
          <span className="text-xs text-white/30 font-mono">{historyItems.length} Archived</span>
        </div>

        {historyItems.length > 0 ? (
          <div className="bg-[#111112] rounded-3xl border border-white/5 overflow-hidden shadow-xl divide-y divide-white/5">
            {historyItems.map((hist) => {
              const badge = getTypeBadge(hist.type);
              return (
                <div key={hist.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/50 border border-white/10 shrink-0 shadow-md">
                      {hist.thumbnailUrl ? (
                        <img src={hist.thumbnailUrl} alt={hist.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <Music size={20} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${badge.bg}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                        <span className="text-[11px] text-white/40 font-mono">
                          Archived {hist.archivedAt ? new Date(hist.archivedAt).toLocaleDateString() : 'Previously'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white truncate max-w-md">{hist.title || 'Untitled'}</h4>
                      {hist.subtitle && <p className="text-xs text-white/50 truncate max-w-md">{hist.subtitle}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => handleActivateHistoryClick(hist)}
                      disabled={actionLoading || !canManage}
                      className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <ArrowRight size={13} />
                      <span>Activate</span>
                    </button>
                    <button
                      onClick={() => hist.id && handleDeleteHistory(hist.id)}
                      disabled={actionLoading || !canManage}
                      className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete permanently"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-[#111112] rounded-3xl border border-white/5 text-xs text-white/40">
            No previous featured configurations archived yet.
          </div>
        )}
      </div>

      {/* SECTION 3: NAVIGATION & UI VISIBILITY (settings/navigationVisibility) */}
      <div className="bg-[#111112] p-6 sm:p-8 rounded-3xl border border-white/5 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg">
              <Eye size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Navigation & UI Visibility</h2>
              <p className="text-xs text-white/50">
                Dynamically control menu item visibility across header, mobile navigation, and homepage. Saved to <span className="font-mono text-purple-400">settings/navigationVisibility</span>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleResetNavDefaults}
              disabled={navLoading}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-all cursor-pointer"
            >
              Reset Defaults
            </button>
            <button
              onClick={handleSaveNavVisibility}
              disabled={navLoading || !canManage}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              {navLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={14} />}
              <span>Save Navigation Settings</span>
            </button>
          </div>
        </div>

        {navSuccessMsg && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle size={15} className="text-emerald-400 shrink-0" />
            <span>{navSuccessMsg}</span>
          </div>
        )}

        {navErrorMsg && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs flex items-center gap-2.5">
            <AlertTriangle size={15} className="text-red-400 shrink-0" />
            <span>{navErrorMsg}</span>
          </div>
        )}

        {/* Visibility Toggles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Main Navigation Links */}
          <div className="space-y-3 bg-white/[0.02] p-4 sm:p-5 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2 pb-1 border-b border-white/5">
              <ListMusic size={14} />
              <span>Main Menu Items</span>
            </h3>
            
            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                <span>Home Page (/)</span>
                <input
                  type="checkbox"
                  checked={navSettings.showHome !== false}
                  onChange={(e) => setNavSettings({ ...navSettings, showHome: e.target.checked })}
                  className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                <span>Songs Catalog (/songs)</span>
                <input
                  type="checkbox"
                  checked={navSettings.showSongs !== false}
                  onChange={(e) => setNavSettings({ ...navSettings, showSongs: e.target.checked })}
                  className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                <span>AI Music Studio (/generate)</span>
                <input
                  type="checkbox"
                  checked={navSettings.showAiStudio !== false}
                  onChange={(e) => setNavSettings({ ...navSettings, showAiStudio: e.target.checked })}
                  className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                <span>User Library (/library)</span>
                <input
                  type="checkbox"
                  checked={navSettings.showLibrary !== false}
                  onChange={(e) => setNavSettings({ ...navSettings, showLibrary: e.target.checked })}
                  className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                <span>Playlists (/playlists)</span>
                <input
                  type="checkbox"
                  checked={navSettings.showPlaylists !== false}
                  onChange={(e) => setNavSettings({ ...navSettings, showPlaylists: e.target.checked })}
                  className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                <span>YouTube Search (/search?source=youtube)</span>
                <input
                  type="checkbox"
                  checked={navSettings.showYouTube !== false}
                  onChange={(e) => setNavSettings({ ...navSettings, showYouTube: e.target.checked })}
                  className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                <span>Favorite Songs (/favorites)</span>
                <input
                  type="checkbox"
                  checked={navSettings.showFavorites !== false}
                  onChange={(e) => setNavSettings({ ...navSettings, showFavorites: e.target.checked })}
                  className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                <span>Get App APK (/download)</span>
                <input
                  type="checkbox"
                  checked={navSettings.showGetApp !== false}
                  onChange={(e) => setNavSettings({ ...navSettings, showGetApp: e.target.checked })}
                  className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                <span>Search (/search)</span>
                <input
                  type="checkbox"
                  checked={navSettings.showSearch !== false}
                  onChange={(e) => setNavSettings({ ...navSettings, showSearch: e.target.checked })}
                  className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Column 2: Header Quick Action Buttons */}
          <div className="space-y-3 bg-white/[0.02] p-4 sm:p-5 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2 pb-1 border-b border-white/5">
              <Sparkles size={14} />
              <span>Header Action Buttons</span>
            </h3>

            <div className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                  <span className="font-semibold">"Generate Music" Button</span>
                  <input
                    type="checkbox"
                    checked={navSettings.showQuickAiButton !== false}
                    onChange={(e) => setNavSettings({ ...navSettings, showQuickAiButton: e.target.checked })}
                    className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                </label>
                <p className="text-[11px] text-white/40">Quick gradient CTA button in top navbar.</p>
              </div>

              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                  <span className="font-semibold">"Get App" Button</span>
                  <input
                    type="checkbox"
                    checked={navSettings.showQuickAppButton !== false}
                    onChange={(e) => setNavSettings({ ...navSettings, showQuickAppButton: e.target.checked })}
                    className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                </label>
                <p className="text-[11px] text-white/40">Direct APK download link button in header.</p>
              </div>

              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                  <span className="font-semibold">"New Playlist" Button</span>
                  <input
                    type="checkbox"
                    checked={navSettings.showCreatePlaylistButton !== false}
                    onChange={(e) => setNavSettings({ ...navSettings, showCreatePlaylistButton: e.target.checked })}
                    className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                </label>
                <p className="text-[11px] text-white/40">Allow logged-in users to create playlists from header.</p>
              </div>
            </div>
          </div>

          {/* Column 3: Homepage Layout Sections */}
          <div className="space-y-3 bg-white/[0.02] p-4 sm:p-5 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2 pb-1 border-b border-white/5">
              <Eye size={14} />
              <span>Homepage Promo Sections</span>
            </h3>

            <div className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                  <span className="font-semibold">Community Playlists</span>
                  <input
                    type="checkbox"
                    checked={navSettings.showCommunityPlaylistsOnHome !== false}
                    onChange={(e) => setNavSettings({ ...navSettings, showCommunityPlaylistsOnHome: e.target.checked })}
                    className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                </label>
                <p className="text-[11px] text-white/40">Display user-submitted & curated playlists on homepage.</p>
              </div>

              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                  <span className="font-semibold">AI Music Studio Promo</span>
                  <input
                    type="checkbox"
                    checked={navSettings.showAiPromoBannerOnHome !== false}
                    onChange={(e) => setNavSettings({ ...navSettings, showAiPromoBannerOnHome: e.target.checked })}
                    className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                </label>
                <p className="text-[11px] text-white/40">Large promotional banner for AI track generator.</p>
              </div>

              <div className="space-y-1">
                <label className="flex items-center justify-between text-xs text-white/80 cursor-pointer">
                  <span className="font-semibold">Official APK Download Banner</span>
                  <input
                    type="checkbox"
                    checked={navSettings.showApkDownloadSectionOnHome !== false}
                    onChange={(e) => setNavSettings({ ...navSettings, showApkDownloadSectionOnHome: e.target.checked })}
                    className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                </label>
                <p className="text-[11px] text-white/40">Official Android APK download section at bottom of homepage.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL: REPLACE ACTIVE ITEM (Requirement 3) */}
      {showReplaceConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#18181c] border border-amber-500/30 p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-xl">
              <AlertTriangle size={28} />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
                Another featured item is currently active.
                <br />
                <span className="text-amber-400">Replace it?</span>
              </h3>
              <p className="text-xs text-white/60">
                Only ONE primary featured item can be active at a time.
              </p>
              
              <div className="p-3.5 bg-black/50 border border-white/5 rounded-2xl text-left text-xs text-white/70 space-y-1.5 font-mono">
                <div className="text-[11px] text-amber-300 font-bold uppercase tracking-wider mb-1">Atomically executed on confirm:</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400 font-bold">1.</span>
                  <span>Deactivate previous item ({activeItem?.title || 'active feature'}).</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">2.</span>
                  <span>Activate new item ({formTitle || 'new feature'}).</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-blue-400 font-bold">3.</span>
                  <span>Update Firestore atomically.</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-purple-400 font-bold">4.</span>
                  <span>Refresh homepage state immediately.</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReplaceConfirm(false)}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmitForm(e as any)}
                disabled={actionLoading}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                {actionLoading ? 'Replacing...' : 'Yes, Replace & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: ACTIVATE FROM HISTORY */}
      {historyItemToActivate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181c] border border-purple-500/30 p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto">
              <RefreshCw size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">Activate from History?</h3>
              <p className="text-xs text-white/60">
                Replace active item with <span className="text-white font-semibold">"{historyItemToActivate.title}"</span>?
              </p>
              <p className="text-xs text-white/40 pt-1">
                The currently active item will be safely archived to history.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setHistoryItemToActivate(null)}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeActivateHistory(historyItemToActivate)}
                disabled={actionLoading}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/20"
              >
                {actionLoading ? 'Activating...' : 'Confirm & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161618] border border-white/10 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl my-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {editorMode === 'edit' ? 'Edit Featured Item' : 'Create / Set Active Featured Item'}
                </h3>
                <p className="text-xs text-white/40">Select content type, fill metadata, and publish directly to the homepage hero.</p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-6">
              {/* Type Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
                  Featured Content Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'song', label: 'Featured Song', icon: <Music size={15} /> },
                    { id: 'youtube_playlist', label: 'YouTube Playlist', icon: <Youtube size={15} /> },
                    { id: 'playlist', label: 'Official Playlist', icon: <ListMusic size={15} /> },
                    { id: 'artist', label: 'Featured Artist', icon: <User size={15} /> },
                    { id: 'album', label: 'Featured Album', icon: <Disc size={15} /> },
                    { id: 'release', label: 'Custom Release / Banner', icon: <Sparkles size={15} /> },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormType(t.id as FeaturedContentType)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all text-left ${
                        formType === t.id
                          ? 'bg-purple-600/20 border-purple-500/60 text-white shadow-lg shadow-purple-600/20'
                          : 'bg-black/30 border-white/5 text-white/50 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {t.icon}
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Type Picker: Song */}
              {formType === 'song' && (
                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/70">
                      Pick Song from Catalog *
                    </label>
                    {selectedSongId && (
                      <span className="text-[11px] text-emerald-400 font-mono">Selected: {selectedSongId}</span>
                    )}
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-3.5 text-white/30" />
                    <input
                      type="text"
                      placeholder="Search songs by title or artist..."
                      value={songSearchQuery}
                      onChange={(e) => setSongSearchQuery(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:border-white/30"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-white/5 border border-white/5 rounded-xl">
                    {allSongs
                      .filter((s) => !songSearchQuery || s.title.toLowerCase().includes(songSearchQuery.toLowerCase()) || s.artist.toLowerCase().includes(songSearchQuery.toLowerCase()))
                      .slice(0, 15)
                      .map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedSongId(s.id);
                            if (!formTitle || formTitle === 'Featured Content') setFormTitle(s.title);
                            if (!formSubtitle) setFormSubtitle(s.artist);
                            if (!formThumbnail) setFormThumbnail(getSongArtwork(s));
                          }}
                          className={`p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-white/5 transition-colors ${
                            selectedSongId === s.id ? 'bg-purple-600/20 text-white font-bold' : 'text-white/70'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-black/50 shrink-0">
                              {getSongArtwork(s) ? <img src={getSongArtwork(s)} alt="" className="w-full h-full object-cover" /> : null}
                            </div>
                            <div>
                              <div className="text-white font-medium">{s.title}</div>
                              <div className="text-[11px] text-white/40">{s.artist}</div>
                            </div>
                          </div>
                          {selectedSongId === s.id && <Check size={16} className="text-purple-400" />}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Conditional Type Picker: Official Playlist */}
              {formType === 'playlist' && (
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Pick Official Playlist from Catalog *
                    </label>
                    {selectedPlaylistId && (
                      <span className="text-[11px] text-emerald-400 font-mono">Selected: {selectedPlaylistId}</span>
                    )}
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-3.5 text-white/30" />
                    <input
                      type="text"
                      placeholder="Search playlists by title..."
                      value={playlistSearchQuery}
                      onChange={(e) => setPlaylistSearchQuery(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/40"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-white/5 border border-white/5 rounded-xl">
                    {allPlaylists
                      .filter((p) => !playlistSearchQuery || p.title.toLowerCase().includes(playlistSearchQuery.toLowerCase()))
                      .slice(0, 15)
                      .map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPlaylistId(p.id);
                            if (!formTitle) setFormTitle(p.title);
                            if (!formSubtitle) setFormSubtitle((p as any).curator || 'Official Playlist');
                            if (!formDescription && p.description) setFormDescription(p.description);
                            if (!formThumbnail && (p as any).coverUrl) setFormThumbnail((p as any).coverUrl);
                            if (!formCtaDest) setFormCtaDest(`/playlist/${p.id}`);
                          }}
                          className={`p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-white/5 transition-colors ${
                            selectedPlaylistId === p.id ? 'bg-emerald-600/20 text-white font-bold' : 'text-white/70'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-black/50 shrink-0">
                              {(p as any).coverUrl ? <img src={(p as any).coverUrl} alt="" className="w-full h-full object-cover" /> : null}
                            </div>
                            <div>
                              <div className="text-white font-medium">{p.title}</div>
                              <div className="text-[11px] text-white/40">{(p as any).curator || 'SBG Playlist'}</div>
                            </div>
                          </div>
                          {selectedPlaylistId === p.id && <Check size={16} className="text-emerald-400" />}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Conditional Type Picker: Artist Spotlight */}
              {formType === 'artist' && (
                <div className="p-4 bg-purple-950/20 border border-purple-500/20 rounded-2xl space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-300">
                    Artist Spotlight Information *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Artist Name (e.g. SBG Official)"
                      value={formArtistName}
                      onChange={(e) => {
                        setFormArtistName(e.target.value);
                        if (!formTitle) setFormTitle(e.target.value);
                      }}
                      className="bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500/40"
                    />
                    <input
                      type="text"
                      placeholder="Destination Route or Link (e.g. /songs?artist=...)"
                      value={formCtaDest}
                      onChange={(e) => setFormCtaDest(e.target.value)}
                      className="bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500/40"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Type Picker: Album */}
              {formType === 'album' && (
                <div className="p-4 bg-amber-950/20 border border-amber-500/20 rounded-2xl space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-300">
                    Album Information *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Album Title"
                      value={formAlbumName}
                      onChange={(e) => {
                        setFormAlbumName(e.target.value);
                        if (!formTitle) setFormTitle(e.target.value);
                      }}
                      className="bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-500/40"
                    />
                    <input
                      type="text"
                      placeholder="Artist Name"
                      value={formArtistName}
                      onChange={(e) => {
                        setFormArtistName(e.target.value);
                        if (!formSubtitle) setFormSubtitle(e.target.value);
                      }}
                      className="bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-amber-500/40"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Type Picker: YouTube Playlist */}
              {formType === 'youtube_playlist' && (
                <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-2xl space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-red-300">
                    YouTube Playlist URL or ID *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://youtube.com/playlist?list=PL... or PL..."
                      value={youtubeInput}
                      onChange={(e) => setYoutubeInput(e.target.value)}
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono outline-none focus:border-red-500/50"
                    />
                    <button
                      type="button"
                      onClick={handleFetchYoutubeMetadata}
                      disabled={fetchingYt || !youtubeInput.trim()}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      {fetchingYt ? <Loader2 size={13} className="animate-spin" /> : <Youtube size={14} />}
                      <span>Fetch Metadata</span>
                    </button>
                  </div>
                  {youtubePlaylistId && (
                    <div className="p-3.5 bg-black/50 border border-red-500/20 rounded-xl text-xs text-white/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Validated Playlist ID: <strong className="text-red-400 font-mono">{youtubePlaylistId}</strong></span>
                        <span className="text-[10px] text-white/40 font-mono">source = "youtube" (metadata only)</span>
                      </div>
                      {youtubePreviewMeta && (
                        <div className="flex items-center gap-3 pt-1 border-t border-white/5">
                          {youtubePreviewMeta.thumbnailUrl && (
                            <img src={youtubePreviewMeta.thumbnailUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-white truncate">{youtubePreviewMeta.title}</div>
                            <div className="text-[11px] text-white/50">{youtubePreviewMeta.author} • {youtubePreviewMeta.videos?.length || 0} tracks</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Common Display Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                    Featured Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SBG Anthem 2026"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                    Subtitle / Artist / Channel
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SBG Esports & Music"
                    value={formSubtitle}
                    onChange={(e) => setFormSubtitle(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    placeholder="FEATURED RELEASE"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                    Thumbnail Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://... image URL"
                    value={formThumbnail}
                    onChange={(e) => setFormThumbnail(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe this release to listeners on the homepage..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-white/30 resize-none"
                />
              </div>

              {/* CTA Action Config */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                    Primary CTA Button Text
                  </label>
                  <input
                    type="text"
                    placeholder="Listen Now"
                    value={formCtaText}
                    onChange={(e) => setFormCtaText(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                    CTA Destination URL / Route
                  </label>
                  <input
                    type="text"
                    placeholder="/songs or https://..."
                    value={formCtaDest}
                    onChange={(e) => setFormCtaDest(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>
              </div>

              {/* Brand & Promotional External Links (Admin-Configurable - Requirement 6) */}
              <div className="p-4 bg-purple-950/20 border border-purple-500/20 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-purple-300">
                      Promotional / Brand External Links
                    </label>
                    <p className="text-[11px] text-white/50">
                      These destination cards are prominently featured on the homepage hero (e.g. SBG ESPORTS, Instagram, Backup Website).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExternalLink}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Plus size={13} />
                    <span>Add Link</span>
                  </button>
                </div>

                <div className="space-y-3 pt-1">
                  {formExternalLinks.map((link, idx) => (
                    <div key={link.id || idx} className="p-3 bg-black/50 border border-white/10 rounded-xl space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            placeholder="Title (e.g. SBG ESPORTS)"
                            value={link.label}
                            onChange={(e) => handleUpdateExternalLink(idx, { label: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-400"
                          />
                        </div>
                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            placeholder="URL (https://...)"
                            value={link.url}
                            onChange={(e) => handleUpdateExternalLink(idx, { url: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-400 font-mono"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <select
                            value={link.icon || 'globe'}
                            onChange={(e) => handleUpdateExternalLink(idx, { icon: e.target.value })}
                            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-400 cursor-pointer"
                          >
                            <option value="youtube">YouTube</option>
                            <option value="instagram">Instagram</option>
                            <option value="globe">Website / Globe</option>
                            <option value="discord">Discord / Radio</option>
                            <option value="music">Music</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-8">
                          <input
                            type="text"
                            placeholder="Optional description (e.g. Official Gaming & Esports Hub)"
                            value={link.description || ''}
                            onChange={(e) => handleUpdateExternalLink(idx, { description: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 outline-none focus:border-purple-400"
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-center gap-1.5">
                          <span className="text-[10px] text-white/50">Order:</span>
                          <input
                            type="number"
                            min={1}
                            value={link.order || idx + 1}
                            onChange={(e) => handleUpdateExternalLink(idx, { order: parseInt(e.target.value) || 1 })}
                            className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none text-center"
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-center justify-end gap-2">
                          <label className="flex items-center gap-1 text-[11px] text-white/70 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={link.enabled !== false}
                              onChange={(e) => handleUpdateExternalLink(idx, { enabled: e.target.checked })}
                              className="rounded bg-black border-white/20 text-purple-600 focus:ring-0 w-3.5 h-3.5"
                            />
                            <span>Active</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveExternalLink(idx)}
                            className="p-1 text-white/40 hover:text-red-400 rounded transition-colors"
                            title="Remove link"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {formExternalLinks.length === 0 && (
                    <div className="text-center py-4 text-xs text-white/40">
                      No custom links added. The homepage will display standard default brand links.
                    </div>
                  )}
                </div>
              </div>

              {/* Display Order & Scheduling */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(parseInt(e.target.value) || 1)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                    Start Date / Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">
                    End Date / Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-white/30"
                  />
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="formEnabledCheck"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-black border-white/10 text-purple-600 focus:ring-0"
                />
                <label htmlFor="formEnabledCheck" className="text-xs text-white/80 cursor-pointer">
                  Activate immediately on the homepage
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-white hover:bg-zinc-100 text-black rounded-xl text-xs font-extrabold shadow-xl hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
                >
                  {actionLoading ? 'Saving...' : editorMode === 'edit' ? 'Save Changes' : 'Publish as Active Featured'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
