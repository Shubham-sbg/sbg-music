import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  getAllDiscoveryTagsAdmin, 
  saveDiscoveryTag, 
  deleteDiscoveryTag, 
  DiscoveryTag, 
  DEFAULT_DISCOVERY_TAGS 
} from '../lib/discoveryTags';
import { 
  Flame, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  RefreshCw, 
  AlertCircle, 
  ArrowUpDown, 
  Search, 
  Sliders, 
  Sparkles, 
  Eye, 
  EyeOff 
} from 'lucide-react';

export default function AdminDiscoveryTags() {
  const [tags, setTags] = useState<DiscoveryTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTag, setCurrentTag] = useState<Partial<DiscoveryTag>>({
    name: '',
    searchQuery: '',
    icon: '🔥',
    image: '',
    enabled: true,
    priority: 10,
  });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setLoading(true);
    try {
      const data = await getAllDiscoveryTagsAdmin();
      setTags(data);
    } catch (err: any) {
      setErrorMsg('Failed to load discovery tags.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setCurrentTag({
      name: '',
      searchQuery: '',
      icon: '🔥',
      image: '',
      enabled: true,
      priority: (tags.length + 1) * 10,
    });
    setIsEditing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleOpenEdit = (tag: DiscoveryTag) => {
    setCurrentTag({ ...tag });
    setIsEditing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTag.name?.trim()) {
      setErrorMsg('Tag name is required.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await saveDiscoveryTag(currentTag);
      setSuccessMsg(`Tag "${currentTag.name}" saved successfully!`);
      setIsEditing(false);
      await loadTags();
    } catch (err: any) {
      setErrorMsg(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete tag "${name}"?`)) return;
    try {
      await deleteDiscoveryTag(id);
      setSuccessMsg(`Tag "${name}" removed.`);
      await loadTags();
    } catch (err: any) {
      setErrorMsg(`Delete failed: ${err.message}`);
    }
  };

  const handleToggleEnabled = async (tag: DiscoveryTag) => {
    try {
      await saveDiscoveryTag({ ...tag, enabled: !tag.enabled });
      await loadTags();
    } catch (err: any) {
      setErrorMsg(`Update failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
              <Link to="/admin" className="hover:text-purple-400">Admin</Link>
              <span>/</span>
              <span className="text-zinc-200">Settings</span>
              <span>/</span>
              <span className="text-purple-400 font-semibold">Discovery Tags</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Flame className="w-8 h-8 text-amber-400" />
              Trending Discovery Tags CMS
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Curate trending search queries displayed as quick-chips across the public homepage and search bar.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAdd}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Add Discovery Tag
            </button>
          </div>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 text-sm">
            <Check className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Edit Modal / Form Drawer */}
        {isEditing && (
          <div className="p-6 rounded-2xl bg-zinc-900 border border-purple-500/40 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                {currentTag.id ? 'Edit Discovery Tag' : 'Create New Discovery Tag'}
              </h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Tag Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arijit Singh, Desi Hip-Hop"
                  value={currentTag.name || ''}
                  onChange={(e) => setCurrentTag((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Search Query * (executed on click)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arijit Singh, Tum Hi Ho"
                  value={currentTag.searchQuery || ''}
                  onChange={(e) => setCurrentTag((p) => ({ ...p, searchQuery: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Icon / Emoji (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 🎤, 🔥, 🎧, ⚡"
                  value={currentTag.icon || ''}
                  onChange={(e) => setCurrentTag((p) => ({ ...p, icon: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://... image url"
                  value={currentTag.image || ''}
                  onChange={(e) => setCurrentTag((p) => ({ ...p, image: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Sort Priority (Lower numbers appear first)
                </label>
                <input
                  type="number"
                  value={currentTag.priority || 10}
                  onChange={(e) => setCurrentTag((p) => ({ ...p, priority: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentTag.enabled ?? true}
                    onChange={(e) => setCurrentTag((p) => ({ ...p, enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
                <span className="text-xs font-medium text-zinc-300">
                  {currentTag.enabled ? 'Tag Active / Visible' : 'Tag Disabled'}
                </span>
              </div>

              <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-semibold hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 flex items-center gap-2"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Discovery Tag
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tag List Table */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-300">
              Active Discovery Tags ({tags.filter((t) => t.enabled).length} of {tags.length})
            </span>
            <button
              onClick={loadTags}
              className="text-xs text-zinc-400 hover:text-purple-400 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
              Loading discovery tags...
            </div>
          ) : tags.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-sm">
              No discovery tags configured yet. Click "Add Discovery Tag" to create one.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Icon or Image */}
                    <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 text-lg overflow-hidden">
                      {tag.image ? (
                        <img src={tag.image} alt={tag.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{tag.icon || '🎵'}</span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{tag.name}</span>
                        {!tag.enabled && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Disabled
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                        <Search className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="font-mono text-zinc-300">"{tag.searchQuery}"</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-500">Priority: {tag.priority}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handleToggleEnabled(tag)}
                      title={tag.enabled ? 'Disable Tag' : 'Enable Tag'}
                      className={`p-2 rounded-xl text-xs font-semibold border transition-all ${
                        tag.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {tag.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(tag)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-purple-600/20 text-zinc-300 hover:text-purple-300 border border-zinc-700 hover:border-purple-500/30 transition-all"
                      title="Edit Tag"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(tag.id, tag.name)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-700 hover:border-rose-500/30 transition-all"
                      title="Delete Tag"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
