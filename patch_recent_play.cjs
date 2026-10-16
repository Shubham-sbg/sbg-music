const fs = require('fs');
let code = fs.readFileSync('src/context/PlayerContext.tsx', 'utf-8');

const handlePlayingStr = `  const handlePlaying = () => {
    setIsBuffering(false);
    setIsLoading(false);
    setIsPlaying(true);
    watchTimeRef.current.lastActiveTimestamp = Date.now();
  };`;

const newHandlePlayingStr = `  const handlePlaying = () => {
    setIsBuffering(false);
    setIsLoading(false);
    setIsPlaying(true);
    watchTimeRef.current.lastActiveTimestamp = Date.now();
    
    // Add to recently played on actual playing start
    if (currentSong) {
      try {
        const stored = localStorage.getItem('sbg_recently_played');
        let recent = stored ? JSON.parse(stored) : [];
        recent = recent.filter(s => s.id !== currentSong.id);
        recent = [currentSong, ...recent].slice(0, 20);
        localStorage.setItem('sbg_recently_played', JSON.stringify(recent));
        // Dispatch custom event for UI updates
        window.dispatchEvent(new Event('recently_played_updated'));
      } catch (e) {
        // Ignore
      }
    }
  };`;

code = code.replace(handlePlayingStr, newHandlePlayingStr);
fs.writeFileSync('src/context/PlayerContext.tsx', code);
