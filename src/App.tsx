import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { FavoritesProvider } from './context/FavoritesContext';
import { PlayerProvider } from './context/PlayerContext';

import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import AppUpdateModal from './components/AppUpdateModal';

// User facing pages
import Home from './pages/Home';
import Songs from './pages/Songs';
import SongDetail from './pages/SongDetail';
import Playlists from './pages/Playlists';
import PlaylistDetail from './pages/PlaylistDetail';
import Search from './pages/Search';
import Favorites from './pages/Favorites';
import UserLibrary from './pages/UserLibrary';
import MyPlaylists from './pages/MyPlaylists';
import UserPlaylistDetail from './pages/UserPlaylistDetail';
import UserProfileView from './pages/UserProfileView';
import UserProfileEdit from './pages/UserProfileEdit';
import GenerateMusic from './pages/GenerateMusic';
import DownloadApp from './pages/DownloadApp';
import StaffPanel from './pages/StaffPanel';

// Admin control pages
import Admin from './pages/Admin';
import AdminSongs from './pages/AdminSongs';
import AdminPlaylists from './pages/AdminPlaylists';
import AdminFeaturedControl from './pages/AdminFeaturedControl';
import AdminFeaturedReleases from './pages/AdminFeaturedReleases';
import AdminAds from './pages/AdminAds';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminStaff from './pages/AdminStaff';
import AdminAlerts from './pages/AdminAlerts';
import AdminYouTubeImport from './pages/AdminYouTubeImport';
import AdminDiscoveryTags from './pages/AdminDiscoveryTags';
import AdminCommunityPlaylists from './pages/AdminCommunityPlaylists';
import AdminBranding from './pages/AdminBranding';
import AdminSystemDeployment from './pages/AdminSystemDeployment';
import AdminGetAppControl from './pages/AdminGetAppControl';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FavoritesProvider>
          <PlayerProvider>
            <Routes>
              {/* Main User App Shell */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="songs" element={<Songs />} />
                <Route path="song/:id" element={<SongDetail />} />
                <Route path="playlists" element={<Playlists />} />
                <Route path="playlist/:id" element={<PlaylistDetail />} />
                <Route path="search" element={<Search />} />
                <Route path="favorites" element={<Favorites />} />
                <Route path="library" element={<UserLibrary />} />
                <Route path="my-playlists" element={<MyPlaylists />} />
                <Route path="my-playlist/:id" element={<UserPlaylistDetail />} />
                <Route path="profile" element={<UserProfileView />} />
                <Route path="profile/edit" element={<UserProfileEdit />} />
                <Route path="generate" element={<GenerateMusic />} />
                <Route path="download" element={<DownloadApp />} />
              </Route>

              {/* Staff Portal */}
              <Route path="/staff" element={<StaffPanel />} />

              {/* Admin Portal */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Admin />} />
                <Route path="songs" element={<AdminSongs />} />
                <Route path="playlists" element={<AdminPlaylists />} />
                <Route path="featured" element={<AdminFeaturedControl />} />
                <Route path="releases" element={<AdminFeaturedReleases />} />
                <Route path="ads" element={<AdminAds />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="staff" element={<AdminStaff />} />
                <Route path="alerts" element={<AdminAlerts />} />
                <Route path="youtube" element={<AdminYouTubeImport />} />
                <Route path="discovery" element={<AdminDiscoveryTags />} />
                <Route path="community" element={<AdminCommunityPlaylists />} />
                <Route path="branding" element={<AdminBranding />} />
                <Route path="deployment" element={<AdminSystemDeployment />} />
                <Route path="app" element={<AdminGetAppControl />} />
              </Route>

              {/* Legacy / Direct Admin Shortcut Route */}
              <Route path="/sbgadmin" element={<AdminLayout />}>
                <Route index element={<Admin />} />
                <Route path="songs" element={<AdminSongs />} />
                <Route path="playlists" element={<AdminPlaylists />} />
                <Route path="featured" element={<AdminFeaturedControl />} />
                <Route path="releases" element={<AdminFeaturedReleases />} />
                <Route path="ads" element={<AdminAds />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="staff" element={<AdminStaff />} />
                <Route path="alerts" element={<AdminAlerts />} />
                <Route path="youtube" element={<AdminYouTubeImport />} />
                <Route path="discovery" element={<AdminDiscoveryTags />} />
                <Route path="community" element={<AdminCommunityPlaylists />} />
                <Route path="branding" element={<AdminBranding />} />
                <Route path="deployment" element={<AdminSystemDeployment />} />
                <Route path="app" element={<AdminGetAppControl />} />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Persistent In-App Update Checker Modal */}
            <AppUpdateModal />
          </PlayerProvider>
        </FavoritesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
