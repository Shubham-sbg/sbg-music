const fs = require('fs');
let code = fs.readFileSync('src/hooks/useRecentlyPlayed.ts', 'utf-8');

const hookBody = `
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENTLY_PLAYED_KEY);
      if (stored) {
        setRecentSongs(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to parse recently played songs', e);
    }
  }, []);`;

const newHookBody = `
  const loadRecent = useCallback(() => {
    try {
      const stored = localStorage.getItem(RECENTLY_PLAYED_KEY);
      if (stored) {
        setRecentSongs(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to parse recently played songs', e);
    }
  }, []);

  useEffect(() => {
    loadRecent();
    const handleUpdate = () => loadRecent();
    window.addEventListener('recently_played_updated', handleUpdate);
    return () => window.removeEventListener('recently_played_updated', handleUpdate);
  }, [loadRecent]);`;

code = code.replace(hookBody, newHookBody);
fs.writeFileSync('src/hooks/useRecentlyPlayed.ts', code);
