import React, { useState, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  ExternalLink, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Play, 
  Sparkles,
  Link2,
  Globe,
  Tag,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { Song, ExternalLinkItem } from '../types';
import ImageUploadInput from './ImageUploadInput';
import { invalidateCache } from '../hooks/useCatalog';

interface EditFeaturedModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedSong: Song) => void;
}

// URL validation utility
export function sanitizeAndValidateUrl(url: string): { isValid: boolean; normalizedUrl: string; error?: string } {
  const trimmed = url.trim();
  if (!trimmed) {
    return { isValid: false, normalizedUrl: '', error: 'URL cannot be empty' };
  }

  // Check for disallowed protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return { isValid: false, normalizedUrl: '', error: 'Invalid or unsafe URL protocol.' };
  }

  let finalUrl = trimmed;
  if (!/^https?:\/\//i.test(finalUrl)) {
    // If it looks like a domain, prepend https://
    finalUrl = `https://${finalUrl}`;
  }

  try {
    const parsed = new URL(finalUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { isValid: false, normalizedUrl: '', error: 'URL must use http or https.' };
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { isValid: false, normalizedUrl: '', error: 'Please enter a valid website domain.' };
    }
    return { isValid: true, normalizedUrl: parsed.toString() };
  } catch (e) {
    return { isValid: false, normalizedUrl: '', error: 'Please enter a valid website URL.' };
  }
}

export default function EditFeaturedModal({ song, isOpen, onClose, onSaved }: EditFeaturedModalProps) {
  if (!isOpen || !song) return null;

  // Form State
  const [title, setTitle] = useState(song.title || '');
  const [artist, setArtist] = useState(song.artist || '');
  const [description, setDescription] = useState(song.description || '');
  const [genre, setGenre] = useState(song.genre || '');
  const [releaseDate, setReleaseDate] = useState(song.releaseDate || '');
  const [durationSeconds, setDurationSeconds] = useState<number>(song.durationSeconds || song.duration || 180);
  const [explicitContent, setExplicitContent] = useState<boolean>(song.explicitContent ?? false);
  const [published, setPublished] = useState(song.published ?? true);
  const [isFeatured, setIsFeatured] = useState(song.isFeatured ?? false);
  const [featuredBadge, setFeaturedBadge] = useState(song.featuredBadge || 'FEATURED RELEASE');
  const [featuredDescription, setFeaturedDescription] = useState(song.featuredDescription || '');
  const [showYoutubeSourceBadge, setShowYoutubeSourceBadge] = useState(song.showYoutubeSourceBadge ?? false);
  const [downloadEnabled, setDownloadEnabled] = useState(song.downloadEnabled ?? false);

  // Cover Artwork State
  const [coverUrl, setCoverUrl] = useState(song.imageUrl || song.customCoverUrl || song.coverUrl || song.thumbnailUrl || '');

  // Hero Image State
  const [heroImageUrl, setHeroImageUrl] = useState(song.heroImageUrl || song.imageUrl || song.customCoverUrl || song.coverUrl || song.thumbnailUrl || '');
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string>(song.heroImageUrl || song.imageUrl || song.customCoverUrl || song.coverUrl || song.thumbnailUrl || '');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // External Links State
  const [externalLinkEnabled, setExternalLinkEnabled] = useState(song.externalLinkEnabled ?? true);
  const [externalLinkLabel, setExternalLinkLabel] = useState(song.externalLinkLabel || 'Official Website');
  const [externalLinkUrl, setExternalLinkUrl] = useState(song.externalUrl || song.externalLinkUrl || '');
  
  // Multiple links support
  const [externalLinks, setExternalLinks] = useState<ExternalLinkItem[]>(() => {
    if (song.externalLinks && song.externalLinks.length > 0) {
      return song.externalLinks;
    }
    const initialUrl = song.externalUrl || song.externalLinkUrl || '';
    if (initialUrl) {
      return [
        {
          id: '1',
          label: song.externalLinkLabel || 'Official Website',
          url: initialUrl,
          enabled: song.externalLinkEnabled ?? true,
        },
      ];
    }
    return [
      {
        id: '1',
        label: 'Official Website',
        url: '',
        enabled: true,
      },
    ];
  });

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reset form when active song changes
  useEffect(() => {
    if (song) {
      setTitle(song.title || '');
      setArtist(song.artist || '');
      setDescription(song.description || '');
      setGenre(song.genre || '');
      setReleaseDate(song.releaseDate || '');
      setDurationSeconds(song.durationSeconds || song.duration || 180);
      setExplicitContent(song.explicitContent ?? false);
      setPublished(song.published ?? true);
      setIsFeatured(song.isFeatured ?? false);
      setFeaturedBadge(song.featuredBadge || 'FEATURED RELEASE');
      setFeaturedDescription(song.featuredDescription || '');
      setShowYoutubeSourceBadge(song.showYoutubeSourceBadge ?? false);
      setDownloadEnabled(song.downloadEnabled ?? false);
      
      const initialCover = song.imageUrl || song.customCoverUrl || song.coverUrl || song.thumbnailUrl || '';
      const initialHero = song.heroImageUrl || initialCover;
      setCoverUrl(initialCover);
      setHeroImageUrl(song.heroImageUrl || '');
      setHeroImagePreview(initialHero);
      setHeroImageFile(null);
      setUploadProgress(null);

      const initialExtUrl = song.externalUrl || song.externalLinkUrl || '';
      setExternalLinkEnabled(song.externalLinkEnabled ?? true);
      setExternalLinkLabel(song.externalLinkLabel || 'Official Website');
      setExternalLinkUrl(initialExtUrl);

      if (song.externalLinks && song.externalLinks.length > 0) {
        setExternalLinks(song.externalLinks);
      } else if (initialExtUrl) {
        setExternalLinks([
          {
            id: '1',
            label: song.externalLinkLabel || 'Official Website',
            url: initialExtUrl,
            enabled: song.externalLinkEnabled ?? true,
          },
        ]);
      } else {
        setExternalLinks([
          {
            id: '1',
            label: 'Official Website',
            url: '',
            enabled: true,
          },
        ]);
      }

      setStatusMessage(null);
    }
  }, [song]);

  // Handle local image file selection
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.type.startsWith('image/')) {
        setStatusMessage({ type: 'error', text: 'Please select a valid image file (PNG, JPG, WebP).' });
        return;
      }
      setHeroImageFile(selected);
      const objectUrl = URL.createObjectURL(selected);
      setHeroImagePreview(objectUrl);
      setStatusMessage(null);
    }
  };

  // Add another external link
  const handleAddLink = () => {
    setExternalLinks((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        label: 'Official Website',
        url: '',
        enabled: true,
      },
    ]);
  };

  // Remove external link
  const handleRemoveLink = (id: string) => {
    setExternalLinks((prev) => prev.filter((l) => l.id !== id));
  };

  // Update specific external link field
  const handleUpdateLink = (id: string, field: keyof ExternalLinkItem, value: any) => {
    setExternalLinks((prev) =>
      prev.map((link) => (link.id === id ? { ...link, [field]: value } : link))
    );
  };

  // Validate all external links before saving
  const validateLinks = (): boolean => {
    if (!externalLinkEnabled) return true;

    for (const link of externalLinks) {
      if (link.enabled && link.url.trim()) {
        const val = sanitizeAndValidateUrl(link.url);
        if (!val.isValid) {
          setStatusMessage({
            type: 'error',
            text: `Invalid link for "${link.label || 'Website'}": ${val.error}`,
          });
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setStatusMessage({ type: 'error', text: 'Song title is required.' });
      return;
    }

    if (!validateLinks()) {
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      let finalHeroImageUrl = heroImageUrl.trim();

      // Upload hero image if file was selected
      if (heroImageFile) {
        const ext = heroImageFile.name.split('.').pop() || 'jpg';
        const filename = `hero_${song.id}_${Date.now()}.${ext}`;
        const heroRef = ref(storage, `songs/${song.id}/${filename}`);
        
        const uploadTask = uploadBytesResumable(heroRef, heroImageFile);
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setUploadProgress(pct);
            },
            (error) => reject(error),
            async () => {
              finalHeroImageUrl = await getDownloadURL(heroRef);
              resolve();
            }
          );
        });
      }

      // Clean & normalize external links
      const cleanedLinks = externalLinks
        .map((link) => {
          const rawUrl = link.url.trim();
          if (!rawUrl) return null;
          const val = sanitizeAndValidateUrl(rawUrl);
          return {
            id: link.id,
            label: link.label.trim() || 'Official Website',
            url: val.isValid ? val.normalizedUrl : rawUrl,
            enabled: link.enabled ?? true,
          };
        })
        .filter(Boolean) as ExternalLinkItem[];

      const primaryLink = cleanedLinks[0];
      const primaryExtUrl = primaryLink ? primaryLink.url : externalLinkUrl.trim();

      const updateData: Partial<Song> = {
        title: title.trim(),
        artist: artist.trim() || 'SBG Artist',
        description: description.trim(),
        genre: genre.trim(),
        releaseDate: releaseDate.trim(),
        duration: durationSeconds || 0,
        durationSeconds: durationSeconds || 0,
        explicitContent: explicitContent || false,
        published,
        isFeatured,
        featuredBadge: featuredBadge.trim() || 'FEATURED RELEASE',
        featuredDescription: featuredDescription.trim(),
        showYoutubeSourceBadge,
        downloadEnabled,
        coverUrl: coverUrl.trim(),
        customCoverUrl: coverUrl.trim(),
        imageUrl: coverUrl.trim(),
        thumbnailUrl: coverUrl.trim() || (song.youtubeVideoId ? `https://i.ytimg.com/vi/${song.youtubeVideoId}/hqdefault.jpg` : song.thumbnailUrl || ''),
        heroImageUrl: finalHeroImageUrl || heroImageUrl.trim() || '',
        externalUrl: primaryExtUrl,
        externalLinkEnabled,
        externalLinkLabel: primaryLink ? primaryLink.label : externalLinkLabel.trim() || 'Official Website',
        externalLinkUrl: primaryExtUrl,
        externalLinks: cleanedLinks,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'songs', song.id), updateData);

      invalidateCache('published_songs_list');
      invalidateCache('admin_songs_list');

      setStatusMessage({ type: 'success', text: 'Featured section & song details updated successfully!' });
      
      const updatedSongObj: Song = {
        ...song,
        ...updateData,
        heroImageUrl: finalHeroImageUrl || song.heroImageUrl,
      };

      if (onSaved) {
        onSaved(updatedSongObj);
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e: any) {
      console.error('Error saving song hero details:', e);
      setStatusMessage({ type: 'error', text: 'Save failed: ' + (e.message || String(e)) });
    } finally {
      setSaving(false);
    }
  };

  // Preview active display hero image
  const displayPreviewImage =
    heroImagePreview || heroImageUrl || song.coverUrl || song.thumbnailUrl || '';

  // Active preview badge
  const displayBadge = featuredBadge.trim() || 'FEATURED RELEASE';
  const displayTitle = title.trim() || song.title || 'Song Title';
  const displayArtist = artist.trim() || song.artist || 'SBG Artist';
  const displayDesc =
    featuredDescription.trim() ||
    description.trim() ||
    song.description ||
    `The latest track by ${displayArtist}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-[#111112] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#161618]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Edit Featured Hero & Song Details</h2>
              <p className="text-xs text-white/40">Manage hero player artwork, public display metadata, and website links.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1">
          
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-4 rounded-2xl text-xs flex items-center gap-3 border ${
                statusMessage.type === 'error'
                  ? 'bg-red-500/10 text-red-300 border-red-500/20'
                  : 'bg-green-500/10 text-green-300 border-green-500/20'
              }`}
            >
              {statusMessage.type === 'error' ? (
                <AlertCircle size={18} className="shrink-0 text-red-400" />
              ) : (
                <Check size={18} className="shrink-0 text-green-400" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* REAL-TIME LIVE PREVIEW */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-white/60 flex items-center gap-1.5">
                <Eye size={14} className="text-purple-400" />
                <span>Live Home Page Hero Preview</span>
              </label>
              <span className="text-[11px] text-white/40 font-mono">Real-time Public View</span>
            </div>

            <div className="relative h-[260px] sm:h-[290px] rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl">
              {/* Background / Hero Player Image */}
              {displayPreviewImage ? (
                <img
                  src={displayPreviewImage}
                  alt="Hero Preview"
                  className="absolute inset-0 w-full h-full object-cover object-center transition-all duration-300"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center">
                  <ImageIcon size={48} className="text-white/20" />
                </div>
              )}

              {/* Dark Gradient Overlay for Maximum Legibility */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-transparent z-10" />

              {/* Foreground Content */}
              <div className="relative z-20 h-full flex flex-col justify-center px-6 sm:px-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 mb-2.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.3em] bg-white/10 text-white/90 border border-white/20 px-3 py-1 rounded-full backdrop-blur-md">
                    {displayBadge}
                  </span>
                  {isFeatured && (
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
                      Home Hero
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 line-clamp-1">
                  {displayTitle}
                </h1>
                
                <p className="text-white/70 text-xs sm:text-sm font-medium mb-1 line-clamp-1">
                  By <span className="text-white">{displayArtist}</span>
                </p>

                <p className="text-white/50 text-xs line-clamp-2 mb-6 max-w-md">
                  {displayDesc}
                </p>

                {/* Live Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-xs flex items-center gap-2 shadow-[0_8px_20px_rgba(255,255,255,0.2)]">
                    <Play size={14} fill="currentColor" /> PLAY NOW
                  </div>

                  {externalLinkEnabled && externalLinks.filter(l => l.enabled && l.url).map((link, idx) => (
                    <div
                      key={link.id || idx}
                      className="bg-black/60 hover:bg-black/80 text-white border border-white/20 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 backdrop-blur-md"
                    >
                      <Globe size={13} className="text-purple-400" />
                      <span>{link.label || 'Official Website'}</span>
                      <ExternalLink size={11} className="text-white/50" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: SONG COVER ARTWORK MANAGEMENT */}
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ImageIcon size={16} className="text-purple-400" />
                  <span>Song Cover Artwork (1:1 Square)</span>
                </h3>
                <p className="text-xs text-white/40">
                  Manage the primary square album cover used in song cards, player, playlists, and search results. Saved permanently in Firebase Storage & Firestore.
                </p>
              </div>
              {coverUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCoverUrl('');
                  }}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-bold"
                >
                  <Trash2 size={13} />
                  <span>Remove Cover</span>
                </button>
              )}
            </div>

            <div>
              <ImageUploadInput
                label="Primary Song Cover Artwork"
                value={coverUrl}
                onChange={(newUrl) => {
                  setCoverUrl(newUrl);
                }}
                storageFolder={`songs/${song.id}/cover`}
                placeholder="https://... or upload custom 1:1 square artwork"
                recommendedSize="Recommended: High-res square artwork (500x500 or 1000x1000px, 1:1 ratio)"
              />
            </div>
          </div>

          {/* SECTION 2: HERO & BANNER IMAGE MANAGEMENT */}
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ImageIcon size={16} className="text-purple-400" />
                  <span>Custom Hero & Banner Image (16:9 Banner)</span>
                </h3>
                <p className="text-xs text-white/40">
                  Upload a wide landscape banner for the Home page hero section. Saved in Firebase Storage as <code className="text-purple-300 font-mono">heroImageUrl</code>.
                </p>
              </div>
              {heroImageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setHeroImageUrl('');
                    setHeroImagePreview(coverUrl || song.coverUrl || song.thumbnailUrl || '');
                    setHeroImageFile(null);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-bold"
                >
                  <Trash2 size={13} />
                  <span>Reset Hero Banner</span>
                </button>
              )}
            </div>

            <div>
              <ImageUploadInput
                label="Home Hero Banner Artwork"
                value={heroImageUrl}
                onChange={(newUrl) => {
                  setHeroImageUrl(newUrl);
                  setHeroImagePreview(newUrl || coverUrl || song.coverUrl || song.thumbnailUrl || '');
                }}
                storageFolder={`songs/${song.id}/hero`}
                placeholder="https://images.unsplash.com/... or upload hero banner"
                recommendedSize="Recommended: High-res landscape image (1920x1080 or 1200x630, 16:9 ratio)"
              />
            </div>
          </div>

          {/* SECTION 2: FEATURED SECTION SETTINGS & BADGE */}
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Tag size={16} className="text-purple-400" />
              <span>Featured Banner & Badging</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1.5">
                  Featured Badge Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. FEATURED RELEASE, NEW TRACK, SBG ANTHEM"
                  value={featuredBadge}
                  onChange={(e) => setFeaturedBadge(e.target.value)}
                  className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:border-white/30 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1.5">
                  Hero Short Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Custom punchy summary for the home banner"
                  value={featuredDescription}
                  onChange={(e) => setFeaturedDescription(e.target.value)}
                  className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:border-white/30 outline-none"
                />
              </div>
            </div>

            {/* Featured and Published Toggles */}
            <div className="flex flex-wrap items-center gap-6 pt-1">
              <label className="flex items-center gap-2.5 text-xs cursor-pointer text-white/80 hover:text-white">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-black/60 text-purple-600 focus:ring-0"
                />
                <span className="font-semibold">Pin as Featured Hero Track on Home Page</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs cursor-pointer text-white/80 hover:text-white">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-black/60 text-purple-600 focus:ring-0"
                />
                <span>Published (Visible to public)</span>
              </label>
            </div>
          </div>

          {/* SECTION 3: EXTERNAL WEBSITE LINK MANAGEMENT */}
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe size={16} className="text-purple-400" />
                  <span>External Website Links</span>
                </h3>
                <p className="text-xs text-white/40">
                  Provide links to official websites, SBG esports, artist portals, or streaming platforms.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={externalLinkEnabled}
                  onChange={(e) => setExternalLinkEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-black"
                />
                <span className="font-bold text-white">Enable Links</span>
              </label>
            </div>

            {externalLinkEnabled && (
              <div className="space-y-3">
                {externalLinks.map((link, index) => {
                  const urlValidation = link.url.trim()
                    ? sanitizeAndValidateUrl(link.url)
                    : { isValid: true, normalizedUrl: '', error: undefined };
                  return (
                    <div
                      key={link.id}
                      className="p-3.5 bg-black/60 rounded-xl border border-white/10 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                          <Link2 size={13} className="text-purple-400" />
                          <span>Link #{index + 1}</span>
                        </span>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-[11px] text-white/60 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={link.enabled ?? true}
                              onChange={(e) => handleUpdateLink(link.id, 'enabled', e.target.checked)}
                              className="w-3.5 h-3.5 rounded bg-black"
                            />
                            <span>Active</span>
                          </label>

                          {externalLinks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(link.id)}
                              className="text-red-400/70 hover:text-red-300 p-1 rounded-lg"
                              title="Remove Link"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
                            Link Button Label
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Official Website, SBG Esports, Buy Merch"
                            value={link.label}
                            onChange={(e) => handleUpdateLink(link.id, 'label', e.target.value)}
                            className="w-full p-2.5 bg-black/80 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:border-white/30 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
                            Website Destination URL
                          </label>
                          <input
                            type="text"
                            placeholder="https://sbgmusic.com"
                            value={link.url}
                            onChange={(e) => handleUpdateLink(link.id, 'url', e.target.value)}
                            className={`w-full p-2.5 bg-black/80 border rounded-xl text-white placeholder-white/30 text-xs focus:border-white/30 outline-none font-mono ${
                              link.url.trim() && !urlValidation.isValid
                                ? 'border-red-500/50 text-red-200'
                                : 'border-white/10'
                            }`}
                          />
                        </div>
                      </div>

                      {link.url.trim() && !urlValidation.isValid && (
                        <p className="text-[11px] text-red-400 flex items-center gap-1">
                          <AlertCircle size={12} />
                          <span>{urlValidation.error || 'Enter a valid website URL.'}</span>
                        </p>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleAddLink}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-xl text-xs font-bold text-white/80 hover:text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Another Website Link</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 4: GENERAL TRACK METADATA */}
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white">Track Metadata</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                  Track Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:border-white/30 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                  Artist / Performer
                </label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:border-white/30 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                  Genre
                </label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:border-white/30 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                  Release Date *
                </label>
                <input
                  type="date"
                  required
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:border-white/30 outline-none [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                  Duration (Seconds) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:border-white/30 outline-none"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={explicitContent}
                    onChange={(e) => setExplicitContent(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-black/60 text-purple-600 focus:ring-0"
                  />
                  <span className="font-bold text-white/80">Explicit Content (E Badge)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">
                Full Description / Bio
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Track background or lyrics notes..."
                className="w-full p-3 bg-black/60 border border-white/10 rounded-xl text-white placeholder-white/30 text-xs focus:border-white/30 outline-none resize-none"
              />
            </div>

            {/* Badging & Download Toggles */}
            <div className="flex flex-wrap items-center gap-6 pt-1">
              {song.source === 'youtube' && (
                <label className="flex items-center gap-2 text-xs cursor-pointer text-white/70 hover:text-white">
                  <input
                    type="checkbox"
                    checked={showYoutubeSourceBadge}
                    onChange={(e) => setShowYoutubeSourceBadge(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-black"
                  />
                  <span>Show YouTube Source Badge in public view</span>
                </label>
              )}

              {song.source === 'upload' && (
                <label className="flex items-center gap-2 text-xs cursor-pointer text-white/70 hover:text-white">
                  <input
                    type="checkbox"
                    checked={downloadEnabled}
                    onChange={(e) => setDownloadEnabled(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-black"
                  />
                  <span>Enable Public MP3 Download</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 bg-[#161618] flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-xs font-bold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-2.5 bg-white text-black hover:bg-white/90 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
