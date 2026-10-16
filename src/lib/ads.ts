import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  increment,
  setDoc 
} from 'firebase/firestore';
import { AdCampaign, AdPlacement, AdSettings } from '../types';
import { dedupeRequest, invalidateCache } from './cache';

const IMPRESSION_SESSION_KEY = 'sbg_ad_impressions_session';

export async function fetchAdSettings(): Promise<AdSettings> {
  return dedupeRequest('ad_settings', async () => {
    try {
      const ref = doc(db, 'settings', 'ads');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data() as AdSettings;
      }
    } catch (e) {
      console.warn('Error fetching ad settings:', e);
    }
    return { enabled: true, showAfterSongs: 2, adType: 'banner' };
  }, 120000);
}

export async function saveAdSettings(settings: AdSettings): Promise<void> {
  const ref = doc(db, 'settings', 'ads');
  await setDoc(ref, { ...settings, updatedAt: Date.now() }, { merge: true });
  invalidateCache('ad_settings');
}

/**
 * Validates external ad destination URLs to prevent XSS / malicious schemes.
 * Only http: and https: protocols are permitted.
 */
export function validateAdUrl(url: string): { isValid: boolean; normalizedUrl: string; error?: string } {
  if (!url || !url.trim()) {
    return { isValid: false, normalizedUrl: '', error: 'Destination URL is required.' };
  }

  const trimmed = url.trim();

  // Strict check for dangerous schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('blob:')
  ) {
    return { isValid: false, normalizedUrl: '', error: 'Security error: Unsupported or dangerous URL scheme.' };
  }

  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, normalizedUrl: '', error: 'Only HTTP and HTTPS URLs are allowed.' };
    }
    return { isValid: true, normalizedUrl: parsed.toString() };
  } catch (e) {
    return { isValid: false, normalizedUrl: '', error: 'Invalid URL format. Please enter a valid web link.' };
  }
}

/**
 * Fetches all ad campaigns for Admin management.
 */
export async function fetchAllCampaigns(): Promise<AdCampaign[]> {
  return dedupeRequest('all_ad_campaigns', async () => {
    try {
      const q = query(collection(db, 'ads_campaigns'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AdCampaign));
    } catch (e) {
      console.warn('Error fetching all ad campaigns:', e);
      return [];
    }
  }, 60000);
}

/**
 * Fetches active and enabled campaigns for a given placement or type on the public website.
 */
export async function fetchActiveCampaigns(placement?: AdPlacement, type?: 'banner' | 'voice'): Promise<AdCampaign[]> {
  const cacheKey = `active_ad_campaigns_${placement || 'all'}_${type || 'all'}`;
  return dedupeRequest(cacheKey, async () => {
    try {
      let q = query(
        collection(db, 'ads_campaigns'),
        where('enabled', '==', true)
      );

      const snapshot = await getDocs(q);
      const today = new Date().toISOString().split('T')[0];

      const activeList = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as AdCampaign))
        .filter((ad) => {
          if (placement && ad.placement && ad.placement !== placement) return false;
          if (type && ad.type && ad.type !== type) return false;
          if (ad.startDate && ad.startDate > today) return false;
          if (ad.endDate && ad.endDate < today) return false;
          return true;
        });

      return activeList;
    } catch (e) {
      console.warn(`Error fetching active campaigns:`, e);
      return [];
    }
  }, 120000);
}

/**
 * Creates a new Ad / Featured promotion campaign.
 */
export async function createAdCampaign(campaignData: Omit<AdCampaign, 'id' | 'impressions' | 'clicks' | 'plays' | 'completions' | 'createdAt' | 'updatedAt'>): Promise<string> {
  let normalizedUrl = '';
  if (campaignData.destinationUrl) {
    const urlVal = validateAdUrl(campaignData.destinationUrl);
    if (!urlVal.isValid) {
      throw new Error(urlVal.error || 'Invalid destination URL.');
    }
    normalizedUrl = urlVal.normalizedUrl;
  }

  const payload = {
    ...campaignData,
    destinationUrl: normalizedUrl,
    impressions: 0,
    clicks: 0,
    plays: 0,
    completions: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const docRef = await addDoc(collection(db, 'ads_campaigns'), payload);
  invalidateCache('active_ad_campaigns');
  invalidateCache('all_ad_campaigns');
  return docRef.id;
}

/**
 * Updates an existing ad campaign.
 */
export async function updateAdCampaign(campaignId: string, campaignData: Partial<AdCampaign>): Promise<void> {
  const payload: any = { ...campaignData, updatedAt: Date.now() };

  if (campaignData.destinationUrl) {
    const urlVal = validateAdUrl(campaignData.destinationUrl);
    if (!urlVal.isValid) {
      throw new Error(urlVal.error || 'Invalid destination URL.');
    }
    payload.destinationUrl = urlVal.normalizedUrl;
  }

  const docRef = doc(db, 'ads_campaigns', campaignId);
  await updateDoc(docRef, payload);
  invalidateCache('active_ad_campaigns');
  invalidateCache('all_ad_campaigns');
}

/**
 * Deletes an ad campaign.
 */
export async function deleteAdCampaign(campaignId: string): Promise<void> {
  const docRef = doc(db, 'ads_campaigns', campaignId);
  await deleteDoc(docRef);
  invalidateCache('active_ad_campaigns');
  invalidateCache('all_ad_campaigns');
}

/**
 * Toggles an ad campaign's active status.
 */
export async function toggleAdCampaignStatus(campaignId: string, currentEnabled: boolean): Promise<void> {
  const docRef = doc(db, 'ads_campaigns', campaignId);
  await updateDoc(docRef, { enabled: !currentEnabled, updatedAt: Date.now() });
  invalidateCache('active_ad_campaigns');
  invalidateCache('all_ad_campaigns');
}

/**
 * Records an ad impression once per browser session when the ad becomes visible.
 */
export async function recordAdImpression(campaignId: string): Promise<void> {
  if (!campaignId) return;

  // Session deduplication
  try {
    const raw = sessionStorage.getItem(IMPRESSION_SESSION_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    if (seen.includes(campaignId)) return;

    seen.push(campaignId);
    sessionStorage.setItem(IMPRESSION_SESSION_KEY, JSON.stringify(seen));
  } catch (e) {
    // Ignore storage issues
  }

  try {
    const docRef = doc(db, 'ads_campaigns', campaignId);
    await updateDoc(docRef, {
      impressions: increment(1),
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn(`Failed to record impression for ${campaignId}:`, e);
  }
}

/**
 * Records an ad click when the user clicks the CTA button or banner.
 */
export async function recordAdClick(campaignId: string): Promise<void> {
  if (!campaignId) return;

  try {
    const docRef = doc(db, 'ads_campaigns', campaignId);
    await updateDoc(docRef, {
      clicks: increment(1),
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn(`Failed to record click for ${campaignId}:`, e);
  }
}

export async function recordVoiceAdPlay(campaignId: string): Promise<void> {
  if (!campaignId) return;
  try {
    const docRef = doc(db, 'ads_campaigns', campaignId);
    await updateDoc(docRef, {
      plays: increment(1),
      impressions: increment(1),
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn('Failed to record voice ad play:', e);
  }
}

export async function recordVoiceAdCompletion(campaignId: string): Promise<void> {
  if (!campaignId) return;
  try {
    const docRef = doc(db, 'ads_campaigns', campaignId);
    await updateDoc(docRef, {
      completions: increment(1),
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn('Failed to record voice ad completion:', e);
  }
}
