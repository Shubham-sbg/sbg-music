export type SynthesizerMood = 'synthwave' | 'cyberpunk' | 'ambient' | 'hiphop' | 'acoustic' | 'anthem';

export type SongSourceType =
  | 'catalog'
  | 'youtube'
  | 'sbg'
  | 'upload'
  | 'local'
  | 'stream'
  | 'SBG_CATALOG'
  | 'YOUTUBE'
  | 'OTHER'
  | string;

export interface ExternalLinkItem {
  id?: string;
  title?: string;
  label: string;
  url: string;
  type?: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  description?: string;
  genre?: string;
  releaseDate?: string;
  duration?: number;
  durationSeconds?: number;
  explicitContent?: boolean;
  audioUrl?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  coverUrl?: string;
  customCoverUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  heroImageUrl?: string;
  isFeatured?: boolean;
  isPopular?: boolean;
  featuredBadge?: string;
  featuredDescription?: string;
  externalLinkEnabled?: boolean;
  externalLinkLabel?: string;
  externalLinkUrl?: string;
  externalUrl?: string;
  externalLinks?: ExternalLinkItem[];
  downloadEnabled?: boolean;
  downloadable?: boolean;
  published?: boolean;
  showYoutubeSourceBadge?: boolean;
  source?: SongSourceType;
  sourceType?: SongSourceType;
  sourcePlaylistId?: string;
  plays?: number | any;
  likes?: number;
  lyrics?: string;
  lyricsLrc?: string;
  syncedLyrics?: string;
  createdBy?: string;
  createdById?: string;
  createdAt?: number | any;
  updatedAt?: number | any;
  isLiked?: boolean;
  isDownloaded?: boolean;
  [key: string]: any;
}

export interface Track extends Song {
  duration: number; // in seconds
  bpm?: number;
  mood?: SynthesizerMood;
  artwork?: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentTrack: Track | Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  queue: (Track | Song)[];
  queueIndex: number;
}

export interface Playlist {
  id: string;
  title: string;
  name?: string;
  description?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  songIds?: string[];
  songs?: Song[];
  published?: boolean;
  createdAt?: number | any;
  updatedAt?: number | any;
  isFeatured?: boolean;
  isPublic?: boolean;
  songCount?: number;
  source?: string;
  sourcePlaylistId?: string;
  creatorName?: string;
  creatorVerified?: boolean;
  createdBy?: string;
  category?: string;
  [key: string]: any;
}

export interface UserPlaylistItem {
  id: string;
  songId?: string;
  youtubeVideoId?: string;
  title: string;
  artist: string;
  duration?: number;
  coverUrl?: string;
  thumbnailUrl?: string;
  audioUrl?: string;
  youtubeUrl?: string;
  addedAt: number;
  source?: 'sbg' | 'youtube' | 'catalog' | string;
  [key: string]: any;
}

export interface UserPlaylist {
  id: string;
  uid?: string;
  ownerId: string;
  ownerName: string;
  name: string;
  title?: string;
  description?: string;
  visibility: 'public' | 'private' | string;
  isPublic?: boolean;
  songCount: number;
  coverUrl?: string;
  items: UserPlaylistItem[];
  createdAt: number;
  updatedAt: number;
  [key: string]: any;
}

export interface UserLibraryItem {
  id: string;
  userId: string;
  songId?: string;
  youtubeVideoId?: string;
  title: string;
  artist: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  coverUrl?: string;
  audioUrl?: string;
  youtubeUrl?: string;
  duration?: number;
  source: 'youtube' | 'sbg' | 'catalog' | 'upload' | string;
  addedAt: number;
  [key: string]: any;
}

export interface UserProfile {
  uid: string;
  id?: string;
  displayName?: string;
  username?: string;
  email?: string;
  photoURL?: string;
  role?: 'owner' | 'admin' | 'staff' | 'user' | 'guest' | string;
  status?: 'active' | 'disabled' | string;
  isAdmin?: boolean;
  isStaff?: boolean;
  isPublic?: boolean;
  bio?: string;
  favoriteGenres?: string[];
  createdAt?: number | any;
  updatedAt?: number | any;
  [key: string]: any;
}

export interface StaffPermissions {
  add_song?: boolean;
  addSongs?: boolean;
  edit_song?: boolean;
  editSongs?: boolean;
  delete_song?: boolean;
  deleteSongs?: boolean;
  create_playlist?: boolean;
  createPlaylists?: boolean;
  edit_playlist?: boolean;
  editPlaylists?: boolean;
  add_playlist_song?: boolean;
  addPlaylistSong?: boolean;
  import_youtube_playlist?: boolean;
  importYouTubePlaylists?: boolean;
  manage_featured?: boolean;
  manageFeatured?: boolean;
  manage_cta?: boolean;
  manageCta?: boolean;
  manageStaff?: boolean;
  manage_branding?: boolean;
  manage_ads?: boolean;
  [key: string]: boolean | undefined;
}

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  add_song: true,
  addSongs: true,
  edit_song: true,
  editSongs: true,
  delete_song: false,
  deleteSongs: false,
  create_playlist: true,
  createPlaylists: true,
  edit_playlist: true,
  editPlaylists: true,
  add_playlist_song: true,
  addPlaylistSong: true,
  import_youtube_playlist: true,
  importYouTubePlaylists: true,
  manage_featured: false,
  manageFeatured: false,
  manage_cta: false,
  manageCta: false,
  manageStaff: false,
  manage_branding: false,
  manage_ads: false,
};

export const DEFAULT_OWNER_PERMISSIONS: StaffPermissions = {
  add_song: true,
  addSongs: true,
  edit_song: true,
  editSongs: true,
  delete_song: true,
  deleteSongs: true,
  create_playlist: true,
  createPlaylists: true,
  edit_playlist: true,
  editPlaylists: true,
  add_playlist_song: true,
  addPlaylistSong: true,
  import_youtube_playlist: true,
  importYouTubePlaylists: true,
  manage_featured: true,
  manageFeatured: true,
  manage_cta: true,
  manageCta: true,
  manageStaff: true,
  manage_branding: true,
  manage_ads: true,
};

export interface StaffUser {
  id?: string;
  displayName?: string;
  email?: string;
  password?: string;
  role?: 'owner' | 'admin' | 'staff' | string;
  status?: 'active' | 'disabled' | string;
  permissions?: StaffPermissions;
  createdAt?: number | any;
  updatedAt?: number | any;
  [key: string]: any;
}

export type AdPlacement =
  | 'top_banner'
  | 'home_hero'
  | 'player_bottom'
  | 'song_list'
  | 'sidebar'
  | 'dialog'
  | 'voice_interstitial'
  | 'search_page'
  | 'song_detail_top'
  | string;

export interface AdCampaign {
  id?: string;
  title: string;
  description?: string;
  sponsorMessage?: string;
  imageUrl?: string;
  audioUrl?: string;
  buttonLabel?: string;
  destinationUrl: string;
  placement?: AdPlacement;
  type?: 'banner' | 'voice' | string;
  startDate?: string;
  endDate?: string;
  enabled: boolean;
  impressions?: number;
  clicks?: number;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: any;
}

export interface AdSettings {
  enabled: boolean;
  showAfterSongs?: number;
  adType?: 'banner' | 'voice' | 'hybrid' | string;
  frequencySeconds?: number;
  updatedAt?: number;
  [key: string]: any;
}

export interface AndroidRelease {
  id: string;
  appName: string;
  versionName: string;
  versionCode: number;
  releaseName: string;
  releaseNotes: string;
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  sha256: string;
  minAndroidVersion?: string;
  targetAndroidVersion?: string;
  downloadButtonText?: string;
  installInstructions?: string;
  published: boolean;
  isDefault: boolean;
  downloadCount?: number;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  [key: string]: any;
}

export interface CommunityPlaylist {
  id: string;
  playlistId: string;
  playlistUrl: string;
  title: string;
  description?: string;
  submittedByName?: string;
  submittedByEmail?: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  featured?: boolean;
  displayOrder?: number;
  songCount?: number;
  coverUrl?: string;
  createdAt: number;
  approvedAt?: number;
  [key: string]: any;
}

export type FeaturedContentType = 'song' | 'playlist' | 'youtube_playlist' | 'release' | 'custom' | string;

export interface FeaturedCtaLink {
  id?: string;
  label: string;
  url: string;
  type?: 'youtube' | 'instagram' | 'spotify' | 'external' | 'internal' | string;
  order?: number;
  enabled?: boolean;
  icon?: string;
  description?: string;
  [key: string]: any;
}

export interface FeaturedConfig {
  id?: string;
  enabled?: boolean;
  featuredSongId?: string | null;
  featuredOfflineSongId?: string | null;
  title?: string;
  subtitle?: string;
  description?: string;
  ctaText?: string;
  ctaUrl?: string;
  coverUrl?: string;
  badge?: string;
  externalLinks?: any[];
  updatedBy?: string;
  updatedAt?: number;
  [key: string]: any;
}

export interface UnifiedFeaturedConfig {
  id?: string;
  enabled: boolean;
  type: FeaturedContentType | string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnailUrl?: string;
  coverUrl?: string;
  badge?: string;
  songId?: string | null;
  featuredSongId?: string | null;
  featuredOfflineSongId?: string | null;
  playlistId?: string | null;
  youtubePlaylistId?: string | null;
  youtubeUrl?: string | null;
  channelTitle?: string;
  artistName?: string;
  albumName?: string;
  source?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaDestination?: string;
  ctaType?: string;
  ctaLinks?: FeaturedCtaLink[];
  ctaLinksList?: FeaturedCtaLink[];
  externalLinks?: any[];
  displayOrder?: number;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: any;
  updatedBy?: string;
  updatedAt?: number;
  releaseDate?: string;
  audioUrl?: string;
  plays?: number;
  [key: string]: any;
}

export interface FeaturedRelease {
  id: string;
  songId: string;
  title: string;
  artist: string;
  badge?: string;
  description?: string;
  ctaUrl?: string;
  ctaText?: string;
  externalLinks?: FeaturedCtaLink[];
  coverUrl?: string;
  audioUrl?: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: any;
}

export interface FeaturedReleaseAnalytics {
  id?: string;
  releaseId: string;
  impressions?: number;
  plays?: number;
  songPlays?: number;
  clicks?: number;
  completions?: number;
  totalListenSeconds?: number;
  lastTrackedAt?: number;
  [key: string]: any;
}

export interface FeaturedHistoryItem {
  id?: string;
  config: UnifiedFeaturedConfig;
  archivedAt: number;
  title: string;
  artistName?: string;
  [key: string]: any;
}

export interface DailyAnalytics {
  id?: string;
  date: string;
  totalPlays: number;
  totalListenSeconds: number;
  uniqueVisitorsCount?: number;
  completedCount?: number;
  authenticatedPlays?: number;
  authenticatedListenSeconds?: number;
  authenticatedCompletedCount?: number;
  authenticatedSkippedCount?: number;
  authenticatedUniqueCount?: number;
  anonymousPlays?: number;
  anonymousListenSeconds?: number;
  anonymousCompletedCount?: number;
  anonymousSkippedCount?: number;
  anonymousUniqueCount?: number;
  skippedCount?: number;
  sourceBreakdown?: Record<string, number>;
  [key: string]: any;
}

export interface SongAnalytics {
  id?: string;
  songId: string;
  title: string;
  artist: string;
  totalPlays: number;
  totalListenSeconds: number;
  completedCount?: number;
  skippedCount?: number;
  lastPlayedAt?: number;
  [key: string]: any;
}

export interface PlaylistAnalytics {
  id?: string;
  playlistId: string;
  title: string;
  totalPlays: number;
  totalListenSeconds: number;
  lastPlayedAt?: number;
  [key: string]: any;
}

export interface GlobalAnalytics {
  totalPlays: number;
  totalListenSeconds: number;
  totalSongs?: number;
  totalPlaylists?: number;
  authenticatedPlays?: number;
  activeUsers24h?: number;
  updatedAt?: number;
  [key: string]: any;
}

export interface DeploymentInfo {
  platform: string;
  environment: string;
  nodeVersion: string;
  frontend: string;
  backend: string;
  buildCommand: string;
  startCommand: string;
  firebaseProjectId: string;
  authDomain: string;
  status: string;
  youtubeApiStatus?: string;
  adNetworkStatus?: string;
  uptimeSeconds?: number;
  envConfigured?: string[];
  [key: string]: any;
}

export interface ImportAlert {
  id: string;
  type: string;
  title: string;
  message?: string;
  error?: string;
  status: 'pending' | 'failed' | 'retrying' | 'resolved';
  playlistUrl?: string;
  youtubePlaylistId?: string;
  createdAt: number | any;
  retries?: number;
  [key: string]: any;
}

export interface NavigationVisibilitySettings {
  showHome: boolean;
  showSongs: boolean;
  showAiStudio: boolean;
  showLibrary: boolean;
  showPlaylists: boolean;
  showYouTube: boolean;
  showFavorites: boolean;
  showGetApp: boolean;
  showSearch: boolean;
  showQuickAiButton: boolean;
  showQuickAppButton: boolean;
  showCreatePlaylistButton: boolean;
  showCommunityPlaylistsOnHome: boolean;
  showAiPromoBannerOnHome: boolean;
  showApkDownloadSectionOnHome: boolean;
  [key: string]: any;
}
