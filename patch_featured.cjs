const fs = require('fs');
let code = fs.readFileSync('src/components/FeaturedReleaseCard.tsx', 'utf-8');

// Update imports
const importStr = `import { Play, Pause, ExternalLink, Sparkles, Loader2 } from 'lucide-react';`;
const newImportStr = `import { Play, Pause, ExternalLink, Sparkles, Loader2, ListPlus } from 'lucide-react';`;
code = code.replace(importStr, newImportStr);

// Update usePlayer
const usePlayerStr = `const { playSong, currentSong, isPlaying, togglePlayPause, playPlaylist, isLoading, isBuffering } = usePlayer();`;
const newUsePlayerStr = `const { playSong, currentSong, isPlaying, togglePlayPause, playPlaylist, isLoading, isBuffering, addToQueue } = usePlayer();`;
code = code.replace(usePlayerStr, newUsePlayerStr);

// Add "Add to Queue" button
const btnStr = `            )}
            <span>{release.primaryCta?.text || 'Listen Now'}</span>
          </button>
          {/* Secondary Official Website Links */}`;
          
const newBtnStr = `            )}
            <span>{release.primaryCta?.text || 'Listen Now'}</span>
          </button>
          {release.primaryCta?.actionType === 'play_song' && targetSong && (
            <button
              onClick={() => addToQueue(targetSong)}
              title="Add to Queue"
              className="p-3.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors flex items-center justify-center border border-white/20 backdrop-blur-md"
            >
              <ListPlus size={16} />
            </button>
          )}
          {/* Secondary Official Website Links */}`;

code = code.replace(btnStr, newBtnStr);
fs.writeFileSync('src/components/FeaturedReleaseCard.tsx', code);
