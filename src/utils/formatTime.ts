/**
 * Utility to format a duration in seconds into mm:ss or hh:mm:ss string.
 */
export function formatTime(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }

  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const remainingSecs = totalSecs % 60;

  const paddedSecs = remainingSecs < 10 ? `0${remainingSecs}` : `${remainingSecs}`;

  if (hours > 0) {
    const paddedMins = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${paddedMins}:${paddedSecs}`;
  }

  return `${minutes}:${paddedSecs}`;
}

export default formatTime;
