export interface ParsedLyricLine {
  time: number;
  text: string;
}

/**
 * Checks if a string contains LRC line-level timestamp tags like [00:12.34] or [1:23]
 */
export function hasLrcTimestamps(text?: string | null): boolean {
  if (!text || typeof text !== 'string') return false;
  return /\[\d{1,3}:\d{2}(?:[.:]\d+)?\]/.test(text);
}

/**
 * Parses LRC formatted timestamped lyrics text into an array of chronologically sorted lines.
 * Handles standard formats [mm:ss.xx], [m:ss.xx], [mm:ss:xx], multiple timestamps per line,
 * and ignores non-timestamp metadata tags like [ar:Artist], [ti:Title], [length:...].
 */
export function parseLrcLyrics(lrcText?: string | null): ParsedLyricLine[] {
  if (!lrcText || typeof lrcText !== 'string') return [];

  const lines = lrcText.split('\n');
  const result: ParsedLyricLine[] = [];
  const tagRegex = /\[(\d{1,3}):(\d{2}(?:[.:]\d+)?)\]/g;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Ignore metadata headers like [ar:Artist], [ti:Title], [al:Album]
    if (/^\[[a-zA-Z]+:/.test(trimmed)) continue;

    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    tagRegex.lastIndex = 0;

    while ((match = tagRegex.exec(trimmed)) !== null) {
      const mins = parseFloat(match[1]);
      const secs = parseFloat(match[2].replace(':', '.'));
      if (!isNaN(mins) && !isNaN(secs)) {
        timestamps.push(mins * 60 + secs);
      }
    }

    if (timestamps.length > 0) {
      // Remove all [mm:ss.xx] timestamp tags from the string to get display text
      const cleanText = trimmed.replace(tagRegex, '').trim();
      for (const time of timestamps) {
        result.push({ time, text: cleanText });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

/**
 * Finds the currently active lyric line index based on playback progress.
 * Returns -1 if playback is before the first timestamp.
 */
export function findActiveLyricIndex(
  lines: ParsedLyricLine[],
  currentTime: number,
  leadTime = 0.2
): number {
  if (!lines || lines.length === 0 || currentTime < 0) return -1;

  let activeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime + leadTime) {
      activeIdx = i;
    } else {
      break;
    }
  }
  return activeIdx;
}
