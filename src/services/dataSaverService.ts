/**
 * Data Saver Service for SBG MUSIC
 * Manages low-data streaming policies, preloading settings, and audio quality configurations.
 */

export interface DataSaverSettings {
  dataSaver: boolean;
  preloadNextSong: boolean;
  downloadQuality: 'standard' | 'high';
}

const STORAGE_KEY = 'sbg_data_saver_settings_v1';

const DEFAULT_SETTINGS: DataSaverSettings = {
  dataSaver: false,
  preloadNextSong: true,
  downloadQuality: 'high',
};

export function getDataSaverSettings(): DataSaverSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      dataSaver: Boolean(parsed.dataSaver),
      preloadNextSong: parsed.dataSaver ? false : (parsed.preloadNextSong !== false),
      downloadQuality: parsed.downloadQuality === 'standard' ? 'standard' : 'high',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveDataSaverSettings(settings: Partial<DataSaverSettings>): DataSaverSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const current = getDataSaverSettings();
    const updated: DataSaverSettings = {
      ...current,
      ...settings,
    };

    // If Data Saver is turned ON, force disable preloading
    if (settings.dataSaver === true) {
      updated.dataSaver = true;
      updated.preloadNextSong = false;
      if (!settings.downloadQuality) {
        updated.downloadQuality = 'standard';
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('sbg_data_saver_updated', { detail: updated }));
    return updated;
  } catch (err) {
    console.warn('Failed to save Data Saver settings:', err);
    return DEFAULT_SETTINGS;
  }
}

export function isDataSaverEnabled(): boolean {
  return getDataSaverSettings().dataSaver;
}

export function subscribeToDataSaver(callback: (settings: DataSaverSettings) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: any) => {
    callback(e.detail || getDataSaverSettings());
  };

  window.addEventListener('sbg_data_saver_updated', handler);
  callback(getDataSaverSettings());

  return () => {
    window.removeEventListener('sbg_data_saver_updated', handler);
  };
}
