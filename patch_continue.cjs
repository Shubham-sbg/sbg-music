const fs = require('fs');
let code = fs.readFileSync('src/context/PlayerContext.tsx', 'utf-8');

// Add save to continue listening on pause and every 5 seconds
const handleTimeUpdateStr = `  const handleTimeUpdate = (e: any) => {
    const target = e?.currentTarget || playerRef.current;
    if (target && typeof target.currentTime === 'number') {
      setProgress(target.currentTime);
    }
  };`;

const newHandleTimeUpdateStr = `  const handleTimeUpdate = (e: any) => {
    const target = e?.currentTarget || playerRef.current;
    if (target && typeof target.currentTime === 'number') {
      const time = target.currentTime;
      setProgress(time);
      
      // Save position occasionally (e.g. roughly every 5 seconds based on timeupdate frequency)
      if (currentSong && time > 5 && (duration - time > 5) && Math.floor(time) % 5 === 0) {
        try {
          localStorage.setItem('sbg_continue_listening', JSON.stringify({
            song: currentSong,
            progress: time,
            duration: duration,
            timestamp: Date.now()
          }));
          window.dispatchEvent(new Event('continue_listening_updated'));
        } catch(err) {}
      }
    }
  };`;

code = code.replace(handleTimeUpdateStr, newHandleTimeUpdateStr);

const handlePauseStr = `  const handlePause = () => {
    setIsBuffering(false);
    flushWatchTime(false);
    watchTimeRef.current.lastActiveTimestamp = null;
  };`;

const newHandlePauseStr = `  const handlePause = () => {
    setIsBuffering(false);
    flushWatchTime(false);
    watchTimeRef.current.lastActiveTimestamp = null;
    
    // Save on pause
    if (currentSong && progress > 5 && (duration - progress > 5)) {
      try {
        localStorage.setItem('sbg_continue_listening', JSON.stringify({
          song: currentSong,
          progress: progress,
          duration: duration,
          timestamp: Date.now()
        }));
        window.dispatchEvent(new Event('continue_listening_updated'));
      } catch(err) {}
    }
  };`;

code = code.replace(handlePauseStr, newHandlePauseStr);

// Clear on ended so it doesn't get stuck at the end
const handleEndedStr = `  const handleEnded = async () => {`;
const newHandleEndedStr = `  const handleEnded = async () => {
    try {
      localStorage.removeItem('sbg_continue_listening');
      window.dispatchEvent(new Event('continue_listening_updated'));
    } catch(err) {}
`;
code = code.replace(handleEndedStr, newHandleEndedStr);

// Let playSong read resume position if explicitly asked? Or if we just seek on ready?
// We need the UI to call playSong(song), then seek(progress). 
// Wait, when we playSong, the player is not ready yet, so seek() will fail or reset.
// We can use a ref in PlayerContext `resumeTimeRef`
const playerContextVarsStr = `  const playerRef = useRef<any>(null);`;
const newPlayerContextVarsStr = `  const playerRef = useRef<any>(null);
  const resumeTimeRef = useRef<number | null>(null);`;
code = code.replace(playerContextVarsStr, newPlayerContextVarsStr);

// In handleReady, check resumeTimeRef
const handleReadyStr = `  const handleReady = () => {
    setIsLoading(false);
    setIsBuffering(false);
  };`;
const newHandleReadyStr = `  const handleReady = () => {
    setIsLoading(false);
    setIsBuffering(false);
    if (resumeTimeRef.current !== null && playerRef.current) {
      const rt = resumeTimeRef.current;
      resumeTimeRef.current = null;
      setTimeout(() => seek(rt), 200); // small delay to ensure player accepts seek
    }
  };`;
code = code.replace(handleReadyStr, newHandleReadyStr);

// Expose a playResume function
const contextTypeStr = `  playSong: (song: Song, newQueue?: Song[], playlistId?: string) => void;`;
const newContextTypeStr = `  playSong: (song: Song, newQueue?: Song[], playlistId?: string, resumeTime?: number) => void;`;
code = code.replace(contextTypeStr, newContextTypeStr);

const playSongStr = `  const playSong = (song: Song, newQueue?: Song[], playlistId?: string) => {`;
const newPlaySongStr = `  const playSong = (song: Song, newQueue?: Song[], playlistId?: string, resumeTime?: number) => {
    if (resumeTime) {
      resumeTimeRef.current = resumeTime;
    }`;
code = code.replace(playSongStr, newPlaySongStr);

fs.writeFileSync('src/context/PlayerContext.tsx', code);
