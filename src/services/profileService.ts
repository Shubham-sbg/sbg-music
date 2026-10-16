import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;
  const cacheKey = `sbg_user_profile_${userId}`;
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw);
  } catch {}

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;
    const data = snap.data() as UserProfile;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {}
    return data;
  } catch (err: any) {
    console.warn('[profileService] Notice fetching user profile (quota/offline):', err?.message || err);
    return null;
  }
}

export async function ensureUserProfile(
  user: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null }
): Promise<UserProfile> {
  const sessionKey = `sbg_profile_ensured_${user.uid}`;
  try {
    if (sessionStorage.getItem(sessionKey)) {
      const cached = sessionStorage.getItem(`sbg_user_profile_${user.uid}`);
      if (cached) return JSON.parse(cached);
    }
  } catch {}

  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const profile: UserProfile = {
        uid: user.uid,
        displayName: data.displayName || user.displayName || 'Music Listener',
        username: data.username || user.email?.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || `user_${user.uid.slice(0, 6)}`,
        email: data.email || user.email || '',
        photoURL: data.photoURL || user.photoURL || '',
        bio: data.bio || 'Listening to music on SBG MUSIC.',
        isPublic: data.isPublic !== false,
        role: data.role || 'user',
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now(),
      };
      try {
        sessionStorage.setItem(sessionKey, '1');
        sessionStorage.setItem(`sbg_user_profile_${user.uid}`, JSON.stringify(profile));
      } catch {}
      return profile;
    }

    const defaultUsername = (user.email?.split('@')[0] || `user_${user.uid.slice(0, 6)}`)
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase()
      .slice(0, 20);

    const initialProfile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || 'Music Listener',
      username: defaultUsername,
      email: user.email || '',
      photoURL: user.photoURL || '',
      bio: 'Music enthusiast on SBG MUSIC.',
      isPublic: true,
      role: 'user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save initial profile
    await setDoc(userRef, initialProfile, { merge: true });
    try {
      sessionStorage.setItem(sessionKey, '1');
      sessionStorage.setItem(`sbg_user_profile_${user.uid}`, JSON.stringify(initialProfile));
    } catch {}
    return initialProfile;
  } catch (err: any) {
    console.warn('[profileService] Notice ensuring user profile (quota/offline):', err?.message || err);
    return {
      uid: user.uid,
      displayName: user.displayName || 'Music Listener',
      username: `user_${user.uid.slice(0, 6)}`,
      email: user.email || '',
      photoURL: user.photoURL || '',
      bio: '',
      isPublic: true,
      role: 'user',
      createdAt: Date.now(),
    };
  }
}

export async function updateUserProfile(
  userId: string,
  updates: {
    displayName?: string;
    username?: string;
    bio?: string;
    photoURL?: string;
    isPublic?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: 'User ID missing' };

  try {
    const userRef = doc(db, 'users', userId);
    
    // Clean and validate username
    let cleanUsername: string | undefined = undefined;
    if (updates.username) {
      cleanUsername = updates.username
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 25);
      
      if (cleanUsername.length < 2) {
        return { success: false, error: 'Username must be at least 2 characters.' };
      }
    }

    const payload: Partial<UserProfile> & { updatedAt: number } = {
      updatedAt: Date.now(),
      ...(updates.displayName ? { displayName: updates.displayName.trim().slice(0, 50) } : {}),
      ...(cleanUsername ? { username: cleanUsername } : {}),
      ...(updates.bio !== undefined ? { bio: updates.bio.trim().slice(0, 250) } : {}),
      ...(updates.photoURL !== undefined ? { photoURL: updates.photoURL } : {}),
      ...(updates.isPublic !== undefined ? { isPublic: updates.isPublic } : {}),
    };

    await updateDoc(userRef, payload);
    return { success: true };
  } catch (err: any) {
    console.error('[profileService] Error updating user profile:', err);
    return { success: false, error: err?.message || 'Failed to update profile' };
  }
}
