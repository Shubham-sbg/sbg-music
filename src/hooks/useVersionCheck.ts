import { useState, useEffect, useCallback } from 'react';
import { 
  VersionCheckService, 
  AppVersionInfo, 
  CURRENT_APP_VERSION,
  dismissUpdate, 
  resetDismissal 
} from '../services/versionCheckService';

export function useVersionCheck() {
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(() => VersionCheckService.getCachedUpdate());
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [hasChecked, setHasChecked] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Subscribe to service state changes
  useEffect(() => {
    const unsub = VersionCheckService.subscribe((info) => {
      setUpdateInfo(info);
      if (info && info.isUpdateAvailable) {
        setIsModalOpen(true);
      }
    });

    return () => unsub();
  }, []);

  // Automatic check at application launch (with 2-second polite delay)
  useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(async () => {
      if (!isMounted) return;
      setIsChecking(true);
      try {
        const { updateAvailable, info } = await VersionCheckService.checkForUpdates();
        if (isMounted) {
          setHasChecked(true);
          if (updateAvailable && info) {
            setUpdateInfo(info);
            setIsModalOpen(true);
          }
        }
      } catch (e) {
        console.warn('[useVersionCheck] Auto-check error:', e);
      } finally {
        if (isMounted) setIsChecking(false);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // Manual check triggered by user (e.g. from Profile or Settings)
  const checkNow = useCallback(async (simulateVersion?: string) => {
    setIsChecking(true);
    setStatusMessage(null);
    try {
      const { updateAvailable, info } = await VersionCheckService.checkForUpdates({
        forceCheck: true,
        simulateVersion,
      });
      setHasChecked(true);
      if (updateAvailable && info) {
        resetDismissal(info.versionName);
        setUpdateInfo(info);
        setIsModalOpen(true);
        setStatusMessage(`New update available: v${info.versionName}!`);
        return { isNew: true, version: info.versionName };
      } else {
        setStatusMessage(`SBG MUSIC is up to date (v${CURRENT_APP_VERSION}).`);
        return { isNew: false, version: CURRENT_APP_VERSION };
      }
    } catch {
      setStatusMessage('Unable to check for updates. Please verify your connection.');
      return { isNew: false, error: true };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    if (updateInfo) {
      dismissUpdate(updateInfo.versionName);
    }
    setIsModalOpen(false);
  }, [updateInfo]);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  return {
    currentVersion: CURRENT_APP_VERSION,
    updateInfo,
    isUpdateAvailable: Boolean(updateInfo?.isUpdateAvailable),
    isChecking,
    hasChecked,
    isModalOpen,
    statusMessage,
    openModal: handleOpenModal,
    closeModal: handleDismiss,
    checkNow,
  };
}
