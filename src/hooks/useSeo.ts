import { useEffect } from 'react';
import { toCanonicalUrl, sanitizeJsonLd } from '../config/site';

export interface SeoProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'music.song' | 'music.playlist' | 'article';
  noIndex?: boolean;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
}

const DEFAULT_TITLE = 'SBG MUSIC — Music Discovery & Streaming';
const DEFAULT_DESCRIPTION = 'Discover, stream, and curate official tracks, viral hits, and community playlists on SBG MUSIC.';
const DEFAULT_OG_IMAGE = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80';

export function useSeo({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogType = 'website',
  noIndex = false,
  jsonLd,
}: SeoProps) {
  const sanitizedLd = jsonLd ? sanitizeJsonLd(jsonLd) : null;
  const jsonLdString = sanitizedLd ? JSON.stringify(sanitizedLd) : '';

  useEffect(() => {
    // 1. Title
    const fullTitle = title 
      ? (title.includes('SBG MUSIC') ? title : `${title} | SBG MUSIC`)
      : DEFAULT_TITLE;
    document.title = fullTitle;

    // Helper for meta tags
    const setMetaTag = (selector: string, attrName: string, attrVal: string, content: string) => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, attrVal);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Meta Description
    const metaDesc = description || DEFAULT_DESCRIPTION;
    setMetaTag('meta[name="description"]', 'name', 'description', metaDesc);

    // 3. Meta Robots
    if (noIndex) {
      setMetaTag('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow');
    } else {
      setMetaTag('meta[name="robots"]', 'name', 'robots', 'index, follow');
    }

    // 4. Open Graph & Canonical URLs (Guaranteed https://sbg-song.vercel.app origin)
    const canonicalTarget = toCanonicalUrl(canonicalUrl);

    setMetaTag('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', metaDesc);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', ogType);
    setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'SBG MUSIC');
    setMetaTag('meta[property="og:image"]', 'property', 'og:image', ogImage || DEFAULT_OG_IMAGE);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalTarget);

    // Twitter Cards
    setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', metaDesc);
    setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage || DEFAULT_OG_IMAGE);

    // 5. Canonical Link
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalTarget);

    // 6. JSON-LD Structured Data
    const JSON_LD_ID = 'sbg-seo-jsonld';
    let scriptTag = document.getElementById(JSON_LD_ID) as HTMLScriptElement;
    if (jsonLdString) {
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = JSON_LD_ID;
        scriptTag.type = 'application/ld+json';
        document.head.appendChild(scriptTag);
      }
      scriptTag.text = jsonLdString;
    } else if (scriptTag) {
      scriptTag.remove();
    }
  }, [title, description, canonicalUrl, ogImage, ogType, noIndex, jsonLdString]);
}
