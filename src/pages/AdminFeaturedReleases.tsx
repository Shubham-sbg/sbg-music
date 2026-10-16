import React from 'react';
import AdminFeaturedControl from './AdminFeaturedControl';

/**
 * AdminFeaturedReleases (Legacy Alias)
 * Migrated to centralized AdminFeaturedControl (Admin Panel → Featured Control).
 * Preserved for backwards compatibility with any remaining legacy routes or links.
 */
export default function AdminFeaturedReleases() {
  return (
    <div className="space-y-4">
      <div className="bg-purple-500/10 border border-purple-500/20 px-4 py-3 rounded-2xl text-xs text-purple-300 flex items-center justify-between">
        <span>Centralized: You are managing featured content through the unified <strong>Featured Control</strong> console.</span>
      </div>
      <AdminFeaturedControl />
    </div>
  );
}
