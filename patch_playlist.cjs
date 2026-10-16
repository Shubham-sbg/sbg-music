const fs = require('fs');
let code = fs.readFileSync('src/pages/PlaylistDetail.tsx', 'utf-8');

// Update imports
const importStr = `import { Play, Pause, ArrowLeft, ListMusic, Volume2, Loader2 } from 'lucide-react';`;
const newImportStr = `import { Play, Pause, ArrowLeft, ListMusic, Volume2, Loader2, ListPlus } from 'lucide-react';`;
code = code.replace(importStr, newImportStr);

// Update usePlayer
const usePlayerStr = `const { playPlaylist, currentSong, isPlaying, togglePlayPause, isLoading, isBuffering } = usePlayer();`;
const newUsePlayerStr = `const { playPlaylist, currentSong, isPlaying, togglePlayPause, isLoading, isBuffering, addToQueue } = usePlayer();`;
code = code.replace(usePlayerStr, newUsePlayerStr);

// Find the end of the song row
const endOfRowStr = `                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FavoriteButton songId={song.id} size={16} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}`;

const newEndOfRowStr = `                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(song);
                        }}
                        title="Add to Queue"
                        className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <ListPlus size={16} />
                      </button>
                      <FavoriteButton songId={song.id} size={16} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}`;

code = code.replace(endOfRowStr, newEndOfRowStr);

fs.writeFileSync('src/pages/PlaylistDetail.tsx', code);
