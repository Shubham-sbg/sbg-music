import React, { useState, useEffect } from 'react';
import { 
  fetchAllCampaigns, 
  createAdCampaign, 
  updateAdCampaign, 
  deleteAdCampaign, 
  toggleAdCampaignStatus,
  validateAdUrl,
  fetchAdSettings,
  saveAdSettings
} from '../lib/ads';
import { AdCampaign, AdPlacement, AdSettings } from '../types';
import ImageUploadInput from '../components/ImageUploadInput';
import { 
  Megaphone, 
  Plus, 
  Eye, 
  MousePointerClick, 
  Percent, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  Calendar,
  X,
  Radio,
  Volume2,
  Play,
  Settings
} from 'lucide-react';

const PLACEMENT_OPTIONS: { id: AdPlacement; label: string; description: string }[] = [
  { id: 'home_hero', label: 'Home Hero Banner', description: 'Prominent header banner on the public home page' },
  { id: 'between_recent', label: 'Between Songs Grid', description: 'Embedded between recently added tracks and featured sections' },
  { id: 'songs_page', label: 'Songs Page Top', description: 'Top promo banner on the public song catalog' },
  { id: 'playlist_page', label: 'Playlist Page', description: 'Featured banner inside playlist detail view' },
  { id: 'search_page', label: 'Search Page', description: 'Banner displayed above or below search results' },
  { id: 'footer', label: 'Footer Placement', description: 'Clean promotional strip at the bottom of pages' },
];

export default function AdminAds() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<AdCampaign | null>(null);

  // Global Ad Settings state
  const [adSettings, setAdSettings] = useState<AdSettings>({
    enabled: true,
    showAfterSongs: 2,
    adType: 'both',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [previewModalType, setPreviewModalType] = useState<'banner' | 'voice' | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [sponsorMessage, setSponsorMessage] = useState('');
  const [buttonLabel, setButtonLabel] = useState('Visit Website →');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [placement, setPlacement] = useState<AdPlacement>('home_hero');
  const [adType, setAdType] = useState<'banner' | 'voice' | 'sbg_promo' | 'third_party'>('banner');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdSenseConfigured = Boolean(
    (import.meta as any).env?.VITE_ADSENSE_CLIENT_ID || (window as any).__SBG_ADSENSE_CONFIGURED__
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [allCamps, settings] = await Promise.all([
        fetchAllCampaigns(),
        fetchAdSettings()
      ]);
      setCampaigns(allCamps);
      setAdSettings(settings);
    } catch (e) {
      console.error('Error loading ads data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveAdSettings(adSettings);
      alert('Ad frequency and global settings saved successfully.');
    } catch (e: any) {
      alert('Failed to save settings: ' + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const openCreateModal = (typeDefault?: 'banner' | 'voice' | any) => {
    const t = (typeof typeDefault === 'string' ? typeDefault : 'banner') as 'banner' | 'voice' | 'sbg_promo' | 'third_party';
    setEditingCampaign(null);
    setTitle('');
    setDescription('');
    setImageUrl('');
    setAudioUrl('');
    setSponsorMessage('');
    setButtonLabel('Visit Website →');
    setDestinationUrl('');
    setPlacement('home_hero');
    setAdType(t);
    setStartDate('');
    setEndDate('');
    setEnabled(true);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (camp: AdCampaign) => {
    setEditingCampaign(camp);
    setTitle(camp.title);
    setDescription(camp.description || '');
    setImageUrl(camp.imageUrl || '');
    setAudioUrl(camp.audioUrl || '');
    setSponsorMessage(camp.sponsorMessage || '');
    setButtonLabel(camp.buttonLabel || 'Visit Website →');
    setDestinationUrl(camp.destinationUrl || '');
    setPlacement(camp.placement || 'home_hero');
    setAdType(camp.type || 'banner');
    setStartDate(camp.startDate || '');
    setEndDate(camp.endDate || '');
    setEnabled(camp.enabled ?? true);
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Campaign title is required.');
      return;
    }

    let normalizedUrl = '';
    if (destinationUrl.trim()) {
      const urlCheck = validateAdUrl(destinationUrl);
      if (!urlCheck.isValid) {
        setFormError(urlCheck.error || 'Invalid destination URL.');
        return;
      }
      normalizedUrl = urlCheck.normalizedUrl;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        audioUrl: audioUrl.trim() || undefined,
        sponsorMessage: sponsorMessage.trim() || undefined,
        buttonLabel: buttonLabel.trim() || 'Visit Website →',
        destinationUrl: normalizedUrl,
        placement,
        type: adType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        enabled,
      };

      if (editingCampaign) {
        await updateAdCampaign(editingCampaign.id, payload);
      } else {
        await createAdCampaign(payload as any);
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save ad campaign.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (camp: AdCampaign) => {
    try {
      await toggleAdCampaignStatus(camp.id, camp.enabled ?? true);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === camp.id ? { ...c, enabled: !c.enabled } : c))
      );
    } catch (e) {
      console.error('Error toggling campaign:', e);
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await deleteAdCampaign(campaignId);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    } catch (e) {
      console.error('Error deleting campaign:', e);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Megaphone className="text-purple-400" size={24} />
            <span>Ads & Featured Promotions</span>
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Create promotional banners, manage external sponsor links, and track live CTR and impressions.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
        >
          <Plus size={16} />
          <span>New Ad Campaign</span>
        </button>
      </div>

      {/* Ad Network Provider Status Card */}
      <div className="bg-[#111112] border border-white/5 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Globe size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-white tracking-tight">External Ad Network Provider</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isAdSenseConfigured 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-white/5 text-white/40 border-white/10'
              }`}>
                {isAdSenseConfigured ? 'Active / Configured' : 'Not configured (SBG Promotions Active)'}
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1 max-w-xl">
              Internal SBG Promotions are automatically active and served across public pages. To integrate Google AdSense or an external banner network, provide <code className="text-purple-300 font-mono">ADSENSE_CLIENT_ID</code> in environment variables.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-black/40 border border-white/5 p-3 rounded-2xl shrink-0">
          <Radio size={16} className="text-purple-400 animate-pulse" />
          <div className="text-xs">
            <span className="text-white/40 block text-[10px] uppercase font-bold">Ad Serving Mode</span>
            <span className="text-white font-bold">Direct SBG Engine</span>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white tracking-tight">Active Campaigns & Analytics</h3>

        {loading ? (
          <div className="p-12 text-center text-white/40 text-xs">Loading ad campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="bg-[#111112] border border-white/5 rounded-3xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mx-auto">
              <Megaphone size={22} />
            </div>
            <h4 className="text-sm font-bold text-white">No Campaigns Created Yet</h4>
            <p className="text-xs text-white/40 max-w-sm mx-auto">
              Create your first promotional campaign to feature songs, merchandise, tickets, or partner websites.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-bold text-xs"
            >
              <Plus size={14} />
              <span>Create Campaign</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((camp) => {
              const impressions = camp.impressions || 0;
              const clicks = camp.clicks || 0;
              const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0';

              return (
                <div
                  key={camp.id}
                  className={`bg-[#111112] border rounded-3xl p-6 shadow-xl space-y-4 transition-all ${
                    camp.enabled ? 'border-white/10' : 'border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {camp.imageUrl ? (
                        <img
                          src={camp.imageUrl}
                          alt={camp.title}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 shrink-0">
                          <Sparkles size={18} />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/60 border border-white/10">
                            {(camp.placement || 'home_hero').replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            camp.enabled 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {camp.enabled ? 'Live' : 'Paused'}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white tracking-tight">{camp.title}</h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(camp)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        title="Edit Campaign"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(camp.id)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Delete Campaign"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {camp.description && (
                    <p className="text-xs text-white/60 line-clamp-2">{camp.description}</p>
                  )}

                  {/* Destination Link */}
                  <div className="flex items-center justify-between text-xs font-mono bg-black/40 p-2.5 rounded-xl border border-white/5">
                    <span className="text-white/40 truncate max-w-[200px]">{camp.destinationUrl}</span>
                    <a
                      href={camp.destinationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1 shrink-0 ml-2"
                    >
                      <span>Test Link</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  {/* Metrics Bar */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                    <div className="text-center">
                      <div className="text-[10px] uppercase font-bold text-white/40 flex items-center justify-center gap-1">
                        <Eye size={11} />
                        <span>Impressions</span>
                      </div>
                      <div className="text-sm font-bold text-white mt-0.5 font-mono">
                        {impressions.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] uppercase font-bold text-white/40 flex items-center justify-center gap-1">
                        <MousePointerClick size={11} />
                        <span>Clicks</span>
                      </div>
                      <div className="text-sm font-bold text-white mt-0.5 font-mono">
                        {clicks.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] uppercase font-bold text-white/40 flex items-center justify-center gap-1">
                        <Percent size={11} />
                        <span>CTR</span>
                      </div>
                      <div className="text-sm font-bold text-purple-300 mt-0.5 font-mono">
                        {ctr}%
                      </div>
                    </div>
                  </div>

                  {/* Quick Toggle Button */}
                  <button
                    onClick={() => handleToggle(camp)}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${
                      camp.enabled
                        ? 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    {camp.enabled ? 'Pause Campaign' : 'Enable & Publish'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Campaign Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111112] border border-white/10 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white tracking-tight">
                {editingCampaign ? 'Edit Ad Campaign' : 'New Promotional Campaign'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. SBG World Tour 2026 / New Album Drop"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-white/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                  Description / Subtitle (Optional)
                </label>
                <textarea
                  placeholder="e.g. Stream the latest release and get official limited edition merchandise."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-white/40 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                  Destination Link (URL) *
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/tickets or https://sbgmusic.com"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  required
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-white/40"
                />
                <p className="text-[11px] text-white/40 mt-1">
                  Only HTTP and HTTPS links are allowed. Users will open this in a new tab.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                  Button Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Visit Website →"
                  value={buttonLabel}
                  onChange={(e) => setButtonLabel(e.target.value)}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-white/40"
                />
              </div>

              <div>
                <ImageUploadInput
                  label="Banner / Artwork Image"
                  value={imageUrl}
                  onChange={setImageUrl}
                  storageFolder="ads"
                  placeholder="https://images.unsplash.com/... or upload image"
                  recommendedSize="Recommended: 1200x630px or 16:9 banner for home/header placements"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                  Placement on Website
                </label>
                <select
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value as AdPlacement)}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-white/40"
                >
                  {PLACEMENT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-[#111112] text-white">
                      {opt.label} — {opt.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                    Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-white/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-white/40"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="enableCampaign"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 bg-black/50 border-white/20"
                />
                <label htmlFor="enableCampaign" className="text-xs font-bold text-white cursor-pointer">
                  Publish campaign immediately upon saving
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingCampaign ? 'Update Campaign' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
