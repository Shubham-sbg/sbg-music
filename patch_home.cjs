const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.tsx', 'utf-8');

// Update imports
const importStr = `import { Play, Pause, ExternalLink, Music, ChevronDown, Loader2 } from 'lucide-react';`;
const newImportStr = `import { Play, Pause, ExternalLink, Music, ChevronDown, Loader2, ListPlus } from 'lucide-react';`;
code = code.replace(importStr, newImportStr);

// Add addToQueue to usePlayer
const usePlayerStr = `const { playSong, currentSong, isPlaying, togglePlayPause, isLoading, isBuffering } = usePlayer();`;
const newUsePlayerStr = `const { playSong, currentSong, isPlaying, togglePlayPause, isLoading, isBuffering, addToQueue } = usePlayer();`;
code = code.replace(usePlayerStr, newUsePlayerStr);

// Add to Queue button inside the hover overlay
const buttonStr = `                      <button
                        onClick={() => {
                          if (currentSong?.id === song.id) {
                            togglePlayPause();
                          } else {
                            playSong(song, songs);
                          }
                        }}
                        className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-xl translate-y-3 group-hover:translate-y-0 transition-all hover:scale-105 active:scale-95"
                      >
                        {isCurrentLoading && !isPlaying ? (
                          <Loader2 size={20} className="animate-spin text-black" />
                        ) : isCurrentPlaying ? (
                          <Pause size={20} fill="currentColor" />
                        ) : (
                          <Play size={20} fill="currentColor" className="ml-0.5" />
                        )}
                      </button>
                    </div>`;
                    
const newButtonStr = `                      <button
                        onClick={() => {
                          if (currentSong?.id === song.id) {
                            togglePlayPause();
                          } else {
                            playSong(song, songs);
                          }
                        }}
                        className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-xl translate-y-3 group-hover:translate-y-0 transition-all hover:scale-105 active:scale-95"
                      >
                        {isCurrentLoading && !isPlaying ? (
                          <Loader2 size={20} className="animate-spin text-black" />
                        ) : isCurrentPlaying ? (
                          <Pause size={20} fill="currentColor" />
                        ) : (
                          <Play size={20} fill="currentColor" className="ml-0.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(song);
                        }}
                        title="Add to Queue"
                        className="absolute bottom-2 right-2 p-2 bg-black/60 hover:bg-black text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center translate-y-2 group-hover:translate-y-0 hover:scale-105 active:scale-95"
                      >
                        <ListPlus size={16} />
                      </button>
                    </div>`;

code = code.replace(buttonStr, newButtonStr);

fs.writeFileSync('src/pages/Home.tsx', code);
