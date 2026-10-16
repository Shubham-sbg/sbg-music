const fs = require('fs');
let code = fs.readFileSync('src/context/PlayerContext.tsx', 'utf-8');

const anchorStr = `  const togglePlayPause = () => {`;

const newMethods = `  const addToQueue = (song: Song) => {
    setQueue(prev => {
      // Check if song already exists after current index
      const existingIdx = prev.findIndex((s, i) => i > currentIndex && s.id === song.id);
      if (existingIdx !== -1) return prev; // Already in queue ahead
      return [...prev, song];
    });
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => {
      const newQueue = [...prev];
      newQueue.splice(index, 1);
      return newQueue;
    });
    if (currentIndex === index) {
      if (queue.length > 1) {
        if (index < queue.length - 1) playNext();
        else playPrevious();
      } else {
        setCurrentSong(null);
        setCurrentIndex(-1);
        setIsPlaying(false);
      }
    } else if (currentIndex > index) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const clearQueue = () => {
    if (currentSong) {
      setQueue([currentSong]);
      setCurrentIndex(0);
    } else {
      setQueue([]);
      setCurrentIndex(-1);
    }
  };

  const moveQueueItemUp = (index: number) => {
    if (index <= currentIndex + 1 || index >= queue.length) return;
    setQueue(prev => {
      const newQueue = [...prev];
      const temp = newQueue[index];
      newQueue[index] = newQueue[index - 1];
      newQueue[index - 1] = temp;
      return newQueue;
    });
  };

  const moveQueueItemDown = (index: number) => {
    if (index <= currentIndex || index >= queue.length - 1) return;
    setQueue(prev => {
      const newQueue = [...prev];
      const temp = newQueue[index];
      newQueue[index] = newQueue[index + 1];
      newQueue[index + 1] = temp;
      return newQueue;
    });
  };

`;

code = code.replace(anchorStr, newMethods + anchorStr);

fs.writeFileSync('src/context/PlayerContext.tsx', code);
