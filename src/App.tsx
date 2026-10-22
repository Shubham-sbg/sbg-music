import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { FavoritesProvider } from './context/FavoritesContext';
import { PlayerProvider } from './context/PlayerContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';

// Public Pages
import Home from './pages/Home';
import Songs from './pages/Songs';
import SongDetail from './pages/SongDetail';
import Playlists from './pages/Playlists';
import PlaylistDetail from './pages/PlaylistDetail';
import Favorites from './pages/Favorites';
import Search from './pages/Search';
import UserLibrary from './pages/UserLibrary';
import UserPlaylistDetail from './pages/UserPlaylistDetail';
import UserProfileView from './pages/UserProfileView';
import UserProfileEdit from './pages/UserProfileEdit';
import DownloadApp from './pages/DownloadApp';
import GenerateMusic from './pages/GenerateMusic';

// Staff & Admin Pages
import StaffPanel from './pages/StaffPanel';
import Admin from './pages/Admin';
import AdminSongs from './pages/AdminSongs';
import AdminPlaylists from './pages/AdminPlaylists';
import AdminStaff from './pages/AdminStaff';
import AdminFeaturedControl from './pages/AdminFeaturedControl';
import AdminFeaturedReleases from './pages/AdminFeaturedReleases';
import AdminAds from './pages/AdminAds';
import AdminAlerts from './pages/AdminAlerts';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminBranding from './pages/AdminBranding';
import AdminCommunityPlaylists from './pages/AdminCommunityPlaylists';
import AdminDiscoveryTags from './pages/AdminDiscoveryTags';
import AdminGetAppControl from './pages/AdminGetAppControl';
import AdminSystemDeployment from './pages/AdminSystemDeployment';
import AdminYouTubeImport from './pages/AdminYouTubeImport';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FavoritesProvider>
          <PlayerProvider>
            <Routes>
              {/* Public Listener Portal Routes */}
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/songs" element={<Songs />} />
                <Route path="/song/:id" element={<SongDetail />} />
                <Route path="/songs/:id" element={<SongDetail />} />
                <Route path="/playlists" element={<Playlists />} />
                <Route path="/playlist/:id" element={<PlaylistDetail />} />
                <Route path="/playlists/:id" element={<PlaylistDetail />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/search" element={<Search />} />
                <Route path="/library" element={<UserLibrary />} />
                <Route path="/user-playlist/:id" element={<UserPlaylistDetail />} />
                <Route path="/playlist/user/:id" element={<UserPlaylistDetail />} />
                <Route path="/profile" element={<UserProfileView />} />
                <Route path="/profile/:id" element={<UserProfileView />} />
                <Route path="/profile/edit" element={<UserProfileEdit />} />
                <Route path="/download" element={<DownloadApp />} />
                <Route path="/get-app" element={<DownloadApp />} />
                <Route path="/generate" element={<GenerateMusic />} />
                <Route path="/ai-music" element={<GenerateMusic />} />
              </Route>

              {/* Staff & Admin Dedicated Management Portal */}
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<Admin />} />
                <Route path="/sbgadmin" element={<Admin />} />
                <Route path="/admin/songs" element={<AdminSongs />} />
                <Route path="/admin/playlists" element={<AdminPlaylists />} />
                <Route path="/admin/staff" element={<AdminStaff />} />
                <Route path="/admin/featured" element={<AdminFeaturedControl />} />
                <Route path="/admin/releases" element={<AdminFeaturedReleases />} />
                <Route path="/admin/ads" element={<AdminAds />} />
                <Route path="/admin/alerts" element={<AdminAlerts />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/branding" element={<AdminBranding />} />
                <Route path="/admin/community-playlists" element={<AdminCommunityPlaylists />} />
                <Route path="/admin/tags" element={<AdminDiscoveryTags />} />
                <Route path="/admin/get-app" element={<AdminGetAppControl />} />
                <Route path="/admin/deployment" element={<AdminSystemDeployment />} />
                <Route path="/admin/youtube-import" element={<AdminYouTubeImport />} />
                <Route path="/staff" element={<StaffPanel />} />
              </Route>

              {/* Fallback redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PlayerProvider>
        </FavoritesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
