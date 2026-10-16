import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore';
import { dedupeRequest, invalidateCache } from './cache';

export interface DiscoveryTag {
  id: string;
  name: string;
  searchQuery: string;
  icon?: string;
  image?: string;
  enabled: boolean;
  priority: number;
  startDate?: string;
  endDate?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export const DEFAULT_DISCOVERY_TAGS: Omit<DiscoveryTag, 'id'>[] = [
  { name: 'Arijit Singh', searchQuery: 'Arijit Singh', icon: '🎤', enabled: true, priority: 10 },
  { name: 'Desi Hip-Hop', searchQuery: 'Desi Hip-Hop', icon: '🔥', enabled: true, priority: 20 },
  { name: 'Chill Lofi', searchQuery: 'Chill Lofi Beats', icon: '🎧', enabled: true, priority: 30 },
  { name: 'Alan Walker', searchQuery: 'Alan Walker', icon: '⚡', enabled: true, priority: 40 },
  { name: 'Bhakti Songs', searchQuery: 'Bhakti Songs', icon: '🙏', enabled: true, priority: 50 },
  { name: 'Punjabi Pop', searchQuery: 'Punjabi Pop Hits', icon: '🎵', enabled: true, priority: 60 },
  { name: 'Bollywood Romance', searchQuery: 'Bollywood Romance', icon: '❤️', enabled: true, priority: 70 },
  { name: 'EDM Workout', searchQuery: 'EDM Workout Music', icon: '💪', enabled: true, priority: 80 },
];

const DISCOVERY_CACHE_KEY = 'sbg_discovery_tags_active';
const DISCOVERY_CACHE_TTL = 3 * 60 * 1000;

export async function getActiveDiscoveryTags(forceRefresh = false): Promise<DiscoveryTag[]> {
  if (forceRefresh) {
    invalidateCache(DISCOVERY_CACHE_KEY);
  }

  return dedupeRequest(
    DISCOVERY_CACHE_KEY,
    async () => {
      try {
        const colRef = collection(db, 'discoveryTags');
        const q = query(colRef, where('enabled', '==', true), orderBy('priority', 'asc'));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiscoveryTag));
          return list;
        }
      } catch (err) {
        console.warn('[DiscoveryTags] Error fetching active tags:', err);
      }
      // Fallback to default curated tags
      return DEFAULT_DISCOVERY_TAGS.map((t, idx) => ({ id: `default_${idx}`, ...t }));
    },
    DISCOVERY_CACHE_TTL
  );
}

export async function getAllDiscoveryTagsAdmin(): Promise<DiscoveryTag[]> {
  try {
    const colRef = collection(db, 'discoveryTags');
    const q = query(colRef, orderBy('priority', 'asc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiscoveryTag));
    }
  } catch (err) {
    console.warn('[DiscoveryTags] Admin get all tags error:', err);
  }
  return DEFAULT_DISCOVERY_TAGS.map((t, idx) => ({ id: `default_${idx}`, ...t }));
}

export async function saveDiscoveryTag(tag: Partial<DiscoveryTag>): Promise<string> {
  const id = tag.id || `tag_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();
  
  const payload: DiscoveryTag = {
    id,
    name: tag.name?.trim() || 'New Tag',
    searchQuery: tag.searchQuery?.trim() || tag.name?.trim() || '',
    icon: tag.icon || '',
    image: tag.image || '',
    enabled: tag.enabled !== undefined ? tag.enabled : true,
    priority: Number(tag.priority) || 100,
    startDate: tag.startDate || '',
    endDate: tag.endDate || '',
    updatedAt: now,
    createdAt: tag.createdAt || now,
    createdBy: tag.createdBy || auth.currentUser?.email || 'admin',
  };

  await setDoc(doc(db, 'discoveryTags', id), payload, { merge: true });
  invalidateCache(DISCOVERY_CACHE_KEY);
  return id;
}

export async function deleteDiscoveryTag(id: string): Promise<void> {
  await deleteDoc(doc(db, 'discoveryTags', id));
  invalidateCache(DISCOVERY_CACHE_KEY);
}

export async function seedDefaultTagsIfEmpty(): Promise<void> {
  try {
    const colRef = collection(db, 'discoveryTags');
    const snap = await getDocs(colRef);
    if (snap.empty) {
      for (const t of DEFAULT_DISCOVERY_TAGS) {
        await saveDiscoveryTag(t);
      }
      invalidateCache(DISCOVERY_CACHE_KEY);
    }
  } catch (err) {
    console.warn('[DiscoveryTags] Seeding check skipped:', err);
  }
}
