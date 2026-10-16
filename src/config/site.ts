export const CANONICAL_SITE_URL = 'https://sbg-song.vercel.app';

/**
 * Returns the canonical site URL for production SEO (sitemap, robots, canonical tags, OG tags).
 * Always defaults to https://sbg-song.vercel.app for production SEO assets unless a valid non-development SITE_URL is explicitly set.
 */
export function getSiteUrl(): string {
  const envUrl = process.env.SITE_URL || process.env.APP_URL || process.env.VITE_SITE_URL;
  if (
    envUrl && 
    !envUrl.includes('.run.app') && 
    !envUrl.includes('localhost') && 
    !envUrl.includes('127.0.0.1')
  ) {
    return envUrl.replace(/\/$/, '');
  }
  return CANONICAL_SITE_URL;
}

/**
 * Normalizes any relative or absolute URL/path to use the production canonical origin (https://sbg-song.vercel.app).
 * Prevents Cloud Run, preview, or localhost domain leakage in metadata, canonical links, Open Graph, and sitemaps.
 */
export function toCanonicalUrl(pathOrUrl?: string): string {
  const siteUrl = getSiteUrl();

  if (!pathOrUrl) {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      return `${siteUrl}${path.startsWith('/') ? path : '/' + path}`;
    }
    return siteUrl;
  }

  // Handle absolute HTTP/HTTPS URLs
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    try {
      const parsed = new URL(pathOrUrl);
      if (
        parsed.hostname.includes('.run.app') ||
        parsed.hostname.includes('localhost') ||
        parsed.hostname.includes('127.0.0.1') ||
        parsed.hostname.includes('googleusercontent.com')
      ) {
        return `${siteUrl}${parsed.pathname}${parsed.search}`;
      }
      return pathOrUrl;
    } catch {
      return `${siteUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
    }
  }

  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${siteUrl}${cleanPath}`;
}

/**
 * Recursively replaces any development or preview hostnames in JSON-LD objects/strings with the canonical production URL.
 */
export function sanitizeJsonLd(jsonLd: any): any {
  if (!jsonLd) return jsonLd;
  const siteUrl = getSiteUrl();
  const jsonString = JSON.stringify(jsonLd);

  // Replace any occurrence of development origins with canonical production origin
  const sanitizedString = jsonString.replace(
    /https?:\/\/[a-zA-Z0-9.-]+\.run\.app/g,
    siteUrl
  ).replace(
    /https?:\/\/localhost:\d+/g,
    siteUrl
  ).replace(
    /http:\/\/127\.0\.0\.1:\d+/g,
    siteUrl
  );

  try {
    return JSON.parse(sanitizedString);
  } catch {
    return jsonLd;
  }
}
