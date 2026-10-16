const fs = require('fs');
let code = fs.readFileSync('src/pages/PlaylistDetail.tsx', 'utf-8');

const endOfRowStr = `                  <FavoriteButton songId={song.id} size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            );
          })}
          {songs.length === 0 && (`;

const newEndOfRowStr = `                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToQueue(song);
                    }}
                    title="Add to Queue"
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <ListPlus size={14} />
                  </button>
                  <FavoriteButton songId={song.id} size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            );
          })}
          {songs.length === 0 && (`;

code = code.replace(endOfRowStr, newEndOfRowStr);
fs.writeFileSync('src/pages/PlaylistDetail.tsx', code);
