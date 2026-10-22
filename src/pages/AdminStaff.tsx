import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthProvider';
import { StaffUser, StaffPermissions, DEFAULT_STAFF_PERMISSIONS, DEFAULT_OWNER_PERMISSIONS } from '../types';
import { useAdminStaff } from '../hooks/useCatalog';
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  Key, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Lock, 
  AlertCircle,
  EyeOff
} from 'lucide-react';

export default function AdminStaff() {
  const { user, hasPermission } = useAuth();
  const canManageStaff = user?.role === 'owner' || hasPermission('manageStaff');
  const { staffList, refetch } = useAdminStaff(canManageStaff);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'owner' | 'admin' | 'staff'>('staff');
  const [permissions, setPermissions] = useState<StaffPermissions>(DEFAULT_STAFF_PERMISSIONS);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!canManageStaff) {
    return (
      <div className="p-8 text-center bg-[#111112] rounded-3xl border border-white/5 max-w-2xl mx-auto">
        <Lock size={48} className="mx-auto mb-4 text-amber-400" />
        <h2 className="text-xl font-bold mb-2">Owner Restricted</h2>
        <p className="text-white/40">Only the Owner has permission to manage staff accounts and role authorizations.</p>
      </div>
    );
  }

  const [statusState, setStatusState] = useState<'active' | 'disabled'>('active');

  const resetForm = () => {
    setDisplayName('');
    setEmail('');
    setPassword('');
    setRole('staff');
    setStatusState('active');
    setPermissions(DEFAULT_STAFF_PERMISSIONS);
    setFormError('');
    setEditingStaff(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (staff: StaffUser) => {
    setEditingStaff(staff);
    setDisplayName(staff.displayName || '');
    setEmail(staff.email || '');
    setPassword(staff.password || '');
    setRole(staff.role === 'owner' || staff.role === 'admin' ? staff.role : 'staff');
    setStatusState(staff.status === 'disabled' ? 'disabled' : 'active');
    setPermissions(staff.permissions || DEFAULT_STAFF_PERMISSIONS);
    setFormError('');
    setShowAddModal(true);
  };

  const handleTogglePermission = (key: keyof StaffPermissions, altKey?: keyof StaffPermissions) => {
    setPermissions((prev: any) => {
      const newVal = !prev[key];
      const updated = { ...prev, [key]: newVal };
      if (altKey) {
        updated[altKey] = newVal;
      }
      return updated;
    });
  };

  const handleToggleStaffStatus = async (staff: StaffUser) => {
    if (!staff.id) return;
    const newStatus = staff.status === 'disabled' ? 'active' : 'disabled';
    try {
      await updateDoc(doc(db, 'staff', staff.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      refetch();
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!displayName.trim()) {
      setFormError('Display name / staff name is required (e.g. Shadow).');
      return;
    }
    if (!email.trim()) {
      setFormError('Email address is required.');
      return;
    }

    setSaving(true);
    try {
      const normalizedPermissions = { ...permissions };
      // Ensure both key formats are saved
      normalizedPermissions.add_song = Boolean(permissions.add_song || permissions.addSongs);
      normalizedPermissions.addSongs = normalizedPermissions.add_song;
      
      normalizedPermissions.edit_song = Boolean(permissions.edit_song || permissions.editSongs);
      normalizedPermissions.editSongs = normalizedPermissions.edit_song;

      normalizedPermissions.delete_song = Boolean(permissions.delete_song || permissions.deleteSongs);
      normalizedPermissions.deleteSongs = normalizedPermissions.delete_song;

      normalizedPermissions.create_playlist = Boolean(permissions.create_playlist || permissions.createPlaylists);
      normalizedPermissions.createPlaylists = normalizedPermissions.create_playlist;

      normalizedPermissions.edit_playlist = Boolean(permissions.edit_playlist || permissions.editPlaylists);
      normalizedPermissions.editPlaylists = normalizedPermissions.edit_playlist;

      normalizedPermissions.add_playlist_song = Boolean(permissions.add_playlist_song || permissions.addPlaylistSong);
      normalizedPermissions.addPlaylistSong = normalizedPermissions.add_playlist_song;

      normalizedPermissions.import_youtube_playlist = Boolean(permissions.import_youtube_playlist || permissions.importYouTubePlaylists);
      normalizedPermissions.importYouTubePlaylists = normalizedPermissions.import_youtube_playlist;

      normalizedPermissions.manage_featured = Boolean(permissions.manage_featured || permissions.manageFeatured);
      normalizedPermissions.manageFeatured = normalizedPermissions.manage_featured;

      normalizedPermissions.manage_cta = Boolean(permissions.manage_cta || permissions.manageCta);
      normalizedPermissions.manageCta = normalizedPermissions.manage_cta;

      if (editingStaff?.id) {
        // Update existing staff
        await updateDoc(doc(db, 'staff', editingStaff.id), {
          displayName: displayName.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim() || editingStaff.password || 'official7sbgarmy770@77',
          role,
          status: statusState,
          permissions: (role === 'owner' || role === 'admin') ? DEFAULT_OWNER_PERMISSIONS : normalizedPermissions,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new staff
        await addDoc(collection(db, 'staff'), {
          displayName: displayName.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim() || 'official7sbgarmy770@77',
          role,
          status: statusState,
          permissions: (role === 'owner' || role === 'admin') ? DEFAULT_OWNER_PERMISSIONS : normalizedPermissions,
          createdBy: user?.displayName || 'Shadow',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setShowAddModal(false);
      resetForm();
      refetch();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to save staff record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove staff member "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'staff', id));
        refetch();
      } catch (err: any) {
        alert('Delete failed: ' + err.message);
      }
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Privacy Guarantee Banner */}
      <div className="bg-gradient-to-r from-blue-950/40 via-[#111112] to-purple-950/30 p-6 rounded-3xl border border-blue-500/20 shadow-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <EyeOff size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-blue-300">Public Privacy Enforcement</h2>
            <p className="text-xs text-white/50">
              Staff members are identified exclusively by their <strong>Display Name</strong> (e.g. <em>Shadow</em>). Staff email, UID, and credentials are never exposed publicly.
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-white text-black font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform shrink-0"
        >
          <UserPlus size={16} />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Main Staff List */}
      <div className="bg-[#111112] p-8 rounded-3xl border border-white/5 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Staff & Roles Management</h1>
            <p className="text-sm text-white/40">Manage staff team members and granular permissions.</p>
          </div>
          <span className="text-xs font-mono text-white/40">
            {staffList.length + 1} Total Accounts
          </span>
        </div>

        {/* Predefined Super Admin / Owner card */}
        <div className="p-5 bg-black/40 rounded-2xl border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-lg">
              S
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-lg text-white">Shadow (Main Admin)</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase tracking-wider">
                  Owner
                </span>
              </div>
              <p className="text-xs text-white/40 mt-0.5">
                Full unrestricted platform permissions & administrator controls.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30 font-mono">Protected Master Account</span>
          </div>
        </div>

        {/* Dynamic Staff List */}
        <div className="space-y-3">
          {staffList.map((staff) => (
            <div
              key={staff.id}
              className={`p-5 bg-black/30 rounded-2xl border transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                staff.status === 'disabled' ? 'border-red-500/20 opacity-60' : 'border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {staff.displayName?.[0]?.toUpperCase() || 'S'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-base text-white">{staff.displayName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        staff.role === 'owner' || staff.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}
                    >
                      {staff.role}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        staff.status === 'disabled'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-green-500/20 text-green-300 border-green-500/40'
                      }`}
                    >
                      {staff.status || 'active'}
                    </span>
                    <span className="text-xs text-white/40 font-mono truncate">{staff.email}</span>
                  </div>

                  {/* Complete 9 Permissions Chips Matrix */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(staff.permissions?.add_song || staff.permissions?.addSongs) && (
                      <span className="text-[10px] bg-white/5 text-white/70 px-2 py-0.5 rounded-md border border-white/10">
                        + Add Song
                      </span>
                    )}
                    {(staff.permissions?.edit_song || staff.permissions?.editSongs) && (
                      <span className="text-[10px] bg-white/5 text-white/70 px-2 py-0.5 rounded-md border border-white/10">
                        Edit Song
                      </span>
                    )}
                    {(staff.permissions?.delete_song || staff.permissions?.deleteSongs) && (
                      <span className="text-[10px] bg-red-500/10 text-red-300 px-2 py-0.5 rounded-md border border-red-500/20">
                        Delete Song
                      </span>
                    )}
                    {(staff.permissions?.create_playlist || staff.permissions?.createPlaylists) && (
                      <span className="text-[10px] bg-white/5 text-white/70 px-2 py-0.5 rounded-md border border-white/10">
                        + Create Playlist
                      </span>
                    )}
                    {(staff.permissions?.edit_playlist || staff.permissions?.editPlaylists) && (
                      <span className="text-[10px] bg-white/5 text-white/70 px-2 py-0.5 rounded-md border border-white/10">
                        Edit Playlist
                      </span>
                    )}
                    {(staff.permissions?.add_playlist_song || staff.permissions?.addPlaylistSong) && (
                      <span className="text-[10px] bg-white/5 text-white/70 px-2 py-0.5 rounded-md border border-white/10">
                        + Playlist Songs
                      </span>
                    )}
                    {(staff.permissions?.import_youtube_playlist || staff.permissions?.importYouTubePlaylists) && (
                      <span className="text-[10px] bg-red-500/10 text-red-300 px-2 py-0.5 rounded-md border border-red-500/20">
                        + YouTube Import
                      </span>
                    )}
                    {(staff.permissions?.manage_featured || staff.permissions?.manageFeatured) && (
                      <span className="text-[10px] bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-md border border-purple-500/20">
                        Manage Featured
                      </span>
                    )}
                    {(staff.permissions?.manage_cta || staff.permissions?.manageCta) && (
                      <span className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-md border border-blue-500/20">
                        Manage CTA
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  onClick={() => handleToggleStaffStatus(staff)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    staff.status === 'disabled'
                      ? 'bg-green-500/10 text-green-300 border-green-500/30 hover:bg-green-500/20'
                      : 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20'
                  }`}
                  title={staff.status === 'disabled' ? 'Enable Staff Account' : 'Disable Staff Account'}
                >
                  {staff.status === 'disabled' ? 'Enable' : 'Disable'}
                </button>
                <button
                  onClick={() => handleOpenEdit(staff)}
                  className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors border border-white/10"
                  title="Edit Staff & Permissions"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={() => handleDeleteStaff(staff.id!, staff.displayName || 'Staff Member')}
                  className="p-2 text-red-400/80 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors border border-red-500/20"
                  title="Delete Staff Member"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {staffList.length === 0 && (
            <div className="text-center py-12 text-white/30 text-sm">
              No additional staff accounts created yet. Click "Add Staff Member" to grant team access.
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingStaff ? 'Edit Staff Account' : 'Add New Staff Member'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">
                  Public Display Name / Staff Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shadow, Alex, Vortex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-white/30 text-sm"
                />
                <span className="text-[11px] text-white/40 mt-1 block">
                  This is the name visible on public activity ("Added by Shadow").
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">
                  Private Login Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="staff@sbgmusic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-white/30 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">
                  Login Password (Optional, defaults to admin pass)
                </label>
                <input
                  type="password"
                  placeholder="Leave empty for standard pass or enter custom"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-white/30 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-white/30 text-sm"
                  >
                    <option value="staff">Staff Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner / Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">
                    Account Status
                  </label>
                  <select
                    value={statusState}
                    onChange={(e) => setStatusState(e.target.value as any)}
                    className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:border-white/30 text-sm"
                  >
                    <option value="active">Active (Enabled)</option>
                    <option value="disabled">Disabled (Revoked)</option>
                  </select>
                </div>
              </div>

              {role === 'staff' && (
                <div className="pt-2 border-t border-white/10">
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                    Granular Staff Permissions Matrix
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="flex items-center gap-2.5 p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs cursor-pointer hover:border-white/20">
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.add_song || permissions.addSongs)}
                        onChange={() => handleTogglePermission('add_song', 'addSongs')}
                        className="rounded border-white/20 text-white focus:ring-0"
                      />
                      <span>Add Song</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs cursor-pointer hover:border-white/20">
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.edit_song || permissions.editSongs)}
                        onChange={() => handleTogglePermission('edit_song', 'editSongs')}
                        className="rounded border-white/20 text-white focus:ring-0"
                      />
                      <span>Edit Song</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs cursor-pointer hover:border-white/20">
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.delete_song || permissions.deleteSongs)}
                        onChange={() => handleTogglePermission('delete_song', 'deleteSongs')}
                        className="rounded border-white/20 text-white focus:ring-0"
                      />
                      <span>Delete Song</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs cursor-pointer hover:border-white/20">
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.create_playlist || permissions.createPlaylists)}
                        onChange={() => handleTogglePermission('create_playlist', 'createPlaylists')}
                        className="rounded border-white/20 text-white focus:ring-0"
                      />
                      <span>Create Playlist</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs cursor-pointer hover:border-white/20">
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.edit_playlist || permissions.editPlaylists)}
                        onChange={() => handleTogglePermission('edit_playlist', 'editPlaylists')}
                        className="rounded border-white/20 text-white focus:ring-0"
                      />
                      <span>Edit Playlist</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs cursor-pointer hover:border-white/20">
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.add_playlist_song || permissions.addPlaylistSong)}
                        onChange={() => handleTogglePermission('add_playlist_song', 'addPlaylistSong')}
                        className="rounded border-white/20 text-white focus:ring-0"
                      />
                      <span>Add Playlist Song</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs cursor-pointer hover:border-white/20">
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.import_youtube_playlist || permissions.importYouTubePlaylists)}
                        onChange={() => handleTogglePermission('import_youtube_playlist', 'importYouTubePlaylists')}
                        className="rounded border-white/20 text-white focus:ring-0"
                      />
                      <span>Import YouTube Playlist</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs cursor-pointer hover:border-white/20">
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.manage_featured || permissions.manageFeatured)}
                        onChange={() => handleTogglePermission('manage_featured', 'manageFeatured')}
                        className="rounded border-white/20 text-white focus:ring-0"
                      />
                      <span>Manage Featured</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs cursor-pointer hover:border-white/20">
                      <input
                        type="checkbox"
                        checked={Boolean(permissions.manage_cta || permissions.manageCta)}
                        onChange={() => handleTogglePermission('manage_cta', 'manageCta')}
                        className="rounded border-white/20 text-white focus:ring-0"
                      />
                      <span>Manage CTA</span>
                    </label>
                  </div>
                </div>
              )}

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 p-3 rounded-xl border border-white/10 text-white/60 hover:text-white font-bold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-1/2 p-3 bg-white text-black rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingStaff ? 'Update Staff' : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
