export type SynthesizerMood = 'synthwave' | 'cyberpunk' | 'ambient' | 'hiphop' | 'acoustic' | 'anthem';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number; // in seconds
  audioUrl?: string;
  genre: string;
  mood: SynthesizerMood;
  bpm?: number;
  isLiked?: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  queue: Track[];
  queueIndex: number;
}

export type SongSourceType = 'SBG_CATALOG' | 'YOUTUBE' | 'OTHER' | string;

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  genre?: string;
  releaseDate?: string;
  plays?: number;
  likes?: number;
  isFeatured?: boolean;
  isPopular?: boolean;
  coverUrl?: string;
  thumbnailUrl?: string;
  customCoverUrl?: string;
  heroImageUrl?: string;
  audioUrl?: string;
  source?: 'catalog' | 'upload' | 'youtube' | 'sbg' | string;
  sourceType?: SongSourceType;
  lyrics?: string;
  syncedLyrics?: string;
  youtubeVideoId?: string;
  youtubeUrl?: string;
  downloadable?: boolean;
  downloadEnabled?: boolean;
  channelTitle?: string;
  description?: string;
  published?: boolean;
  explicitContent?: boolean;
  isStaffPick?: boolean;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface Playlist {
  id: string;
  title: string;
  name?: string;
  description?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  songCount?: number;
  songs?: Song[];
  isFeatured?: boolean;
  isPublic?: boolean;
  visibility?: 'public' | 'private' | string;
  ownerId?: string;
  ownerName?: string;
  youtubePlaylistId?: string;
  youtubeUrl?: string;
  items?: any[];
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface UserPlaylistItem {
  id: string;
  songId?: string;
  youtubeVideoId?: string;
  youtubeUrl?: string;
  title: string;
  artist: string;
  duration?: number;
  thumbnailUrl?: string;
  coverUrl?: string;
  audioUrl?: string;
  source?: string;
  addedAt?: number | string | any;
  [key: string]: any;
}

export interface UserPlaylist {
  id: string;
  ownerId: string;
  ownerName?: string;
  name: string;
  title?: string;
  description?: string;
  visibility?: 'public' | 'private' | string;
  isPublic?: boolean;
  songCount?: number;
  coverUrl?: string;
  items?: UserPlaylistItem[];
  songs?: Song[];
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface UserLibraryItem {
  id: string;
  userId?: string;
  songId?: string;
  youtubeVideoId?: string;
  youtubeUrl?: string;
  title: string;
  artist: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  coverUrl?: string;
  imageUrl?: string;
  audioUrl?: string;
  duration?: number;
  genre?: string;
  source?: 'youtube' | 'sbg' | 'upload' | string;
  addedAt: number;
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
  publishSongs?: boolean;
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
  import_youtube_playlist: false,
  importYouTubePlaylists: false,
  manage_featured: false,
  manageFeatured: false,
  manage_cta: false,
  manageCta: false,
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
  publishSongs: true,
};

export interface StaffUser {
  id: string;
  displayName: string;
  email: string;
  password?: string;
  role: 'owner' | 'admin' | 'staff' | string;
  status?: 'active' | 'disabled';
  permissions: StaffPermissions;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface UserProfile {
  uid: string;
  id?: string;
  displayName?: string;
  username?: string;
  email?: string;
  photoURL?: string;
  bio?: string;
  isPublic?: boolean;
  role?: 'owner' | 'admin' | 'staff' | 'user' | string;
  isAdmin?: boolean;
  isStaff?: boolean;
  status?: 'active' | 'disabled';
  permissions?: StaffPermissions;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export type AdPlacement = 
  | 'home_hero' 
  | 'between_recent' 
  | 'songs_page' 
  | 'playlist_page' 
  | 'search_page' 
  | 'footer' 
  | 'song_detail_top'
  | string;

export interface AdSettings {
  enabled: boolean;
  showAfterSongs: number;
  adType: 'banner' | 'voice' | 'both' | string;
  [key: string]: any;
}

export interface AdCampaign {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  audioUrl?: string;
  sponsorMessage?: string;
  buttonLabel?: string;
  destinationUrl?: string;
  placement?: AdPlacement;
  adType?: 'banner' | 'voice' | 'sbg_promo' | 'third_party' | string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
  impressions?: number;
  clicks?: number;
  plays?: number;
  completions?: number;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface DailyAnalytics {
  id?: string;
  date?: string;
  plays?: number;
  uniqueListeners?: number;
  uniqueVisitors?: number;
  completions?: number;
  listenDurationMinutes?: number;
  sourceBreakdown?: Record<string, number>;
  [key: string]: any;
}

export interface SongAnalytics {
  id?: string;
  songId?: string;
  title?: string;
  artist?: string;
  plays?: number;
  completions?: number;
  likes?: number;
  listenDurationMinutes?: number;
  lastPlayedAt?: number;
  [key: string]: any;
}

export interface PlaylistAnalytics {
  id?: string;
  playlistId?: string;
  title?: string;
  plays?: number;
  uniqueListeners?: number;
  [key: string]: any;
}

export interface GlobalAnalytics {
  totalPlays?: number;
  totalUniqueVisitors?: number;
  totalListenDurationMinutes?: number;
  totalSongs?: number;
  totalPlaylists?: number;
  todayPlays?: number;
  todayListeners?: number;
  activeListenersNow?: number;
  [key: string]: any;
}

export interface CommunityPlaylist {
  id: string;
  playlistId: string;
  playlistUrl: string;
  playlistName: string;
  title?: string;
  description?: string;
  curatorName?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  featured: boolean;
  displayOrder?: number;
  upvotes?: number;
  createdAt?: any;
  [key: string]: any;
}

export type FeaturedContentType = 
  | 'song' 
  | 'playlist' 
  | 'youtube_playlist' 
  | 'release' 
  | 'custom'
  | 'artist'
  | 'album'
  | string;

export interface FeaturedCtaLink {
  id?: string;
  label?: string;
  url?: string;
  type?: 'primary' | 'secondary' | 'external' | 'social' | string;
  icon?: string;
  displayOrder?: number;
  [key: string]: any;
}

export interface ExternalLinkItem {
  id?: string;
  title?: string;
  label?: string;
  url?: string;
  type?: string;
  icon?: string;
  enabled?: boolean;
  [key: string]: any;
}

export interface FeaturedConfig {
  id?: string;
  enabled?: boolean;
  type?: FeaturedContentType;
  title?: string;
  subtitle?: string;
  description?: string;
  thumbnailUrl?: string;
  coverUrl?: string;
  badge?: string;
  songId?: string | null;
  featuredSongId?: string | null;
  playlistId?: string | null;
  youtubePlaylistId?: string | null;
  youtubeUrl?: string | null;
  channelTitle?: string;
  artistName?: string;
  albumName?: string;
  source?: 'sbg' | 'youtube' | string;
  ctaText?: string;
  ctaDestination?: string;
  externalLinks?: (FeaturedCtaLink | ExternalLinkItem)[];
  displayOrder?: number;
  startDate?: string | null;
  endDate?: string | null;
  showCommunityPlaylistsOnHome?: boolean;
  featuredOfflineSongId?: string | null;
  featuredOfflineBadge?: string;
  featuredOfflineDescription?: string;
  updatedAt?: any;
  updatedBy?: string;
  [key: string]: any;
}

export interface UnifiedFeaturedConfig extends FeaturedConfig {}

export interface FeaturedRelease {
  id: string;
  title: string;
  subtitle?: string;
  artist?: string;
  description?: string;
  badge?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  songId?: string;
  playlistId?: string;
  audioUrl?: string;
  links?: FeaturedCtaLink[];
  externalLinks?: (FeaturedCtaLink | ExternalLinkItem)[];
  [key: string]: any;
}

export interface FeaturedReleaseAnalytics {
  id?: string;
  views?: number;
  plays?: number;
  clicks?: number;
  [key: string]: any;
}

export interface FeaturedHistoryItem {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  featuredAt: number | any;
  archivedAt?: number | any;
  thumbnailUrl?: string;
  stats?: {
    views?: number;
    plays?: number;
    clicks?: number;
  };
  [key: string]: any;
}

export interface AndroidRelease {
  id: string;
  appName: string;
  versionName: string;
  versionCode: number;
  releaseName: string;
  releaseNotes: string;
  storagePath?: string;
  downloadUrl: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  sha256: string;
  downloadCount?: number;
  isActive?: boolean;
  createdAt?: any;
  updatedAt?: any;
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
  [key: string]: any;
}

export interface ImportAlert {
  id: string;
  videoId: string;
  videoTitle?: string;
  playlistId?: string;
  playlistTitle?: string;
  error?: string;
  status: 'failed' | 'retrying' | 'resolved' | string;
  createdAt?: any;
  updatedAt?: any;
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
  updatedAt?: number;
  updatedBy?: string;
  [key: string]: any;
}
