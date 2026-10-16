const fs = require('fs');
let code = fs.readFileSync('src/context/PlayerContext.tsx', 'utf-8');

// Update PlayerContextType
const typeDefStr = `  clickAd: (campaignId: string, url: string) => void;`;
const typeReplacement = `  clickAd: (campaignId: string, url: string) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  moveQueueItemUp: (index: number) => void;
  moveQueueItemDown: (index: number) => void;`;

code = code.replace(typeDefStr, typeReplacement);

// Update methods inside PlayerProvider
// find playPrevious
const methodsStr = `  const playPrevious = () => {
    if (progress > 3) {
      seek(0);
      return;
    }
    if (currentIndex > 0) {
      playSong(queue[currentIndex - 1], queue);
    }
  };`;

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
  };`;

code = code.replace(methodsStr, methodsStr + '\n\n' + newMethods);

// Update PlayerContext.Provider value
const providerValueStr = `        clickAd,
      }}
    >`;
const providerValueReplacement = `        clickAd,
        addToQueue,
        removeFromQueue,
        clearQueue,
        moveQueueItemUp,
        moveQueueItemDown,
      }}
    >`;
code = code.replace(providerValueStr, providerValueReplacement);

fs.writeFileSync('src/context/PlayerContext.tsx', code);
