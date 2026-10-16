import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInAnonymously, 
  signOut as fbSignOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, StaffPermissions, DEFAULT_OWNER_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS } from '../types';

export const ADMIN_EMAILS = [
  'sbg.esports07@gmail.com',
  'official7sbgarmy7@gmail.com',
  'official7sbgarmy7@gamil.com'
];

export interface AppUser {
  uid: string;
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL?: string | null;
  role: 'owner' | 'admin' | 'staff' | 'user';
  status?: 'active' | 'disabled';
  permissions?: StaffPermissions;
  [key: string]: any;
}

export interface AuthContextType {
  user: AppUser | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isStaff: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  loginGuest: () => Promise<void>;
  loginWithGoogle: () => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const emailLower = (firebaseUser.email || '').toLowerCase();
        const isMasterAdmin = ADMIN_EMAILS.includes(emailLower);

        let role: 'owner' | 'admin' | 'staff' | 'user' = isMasterAdmin ? 'owner' : 'user';
        let status: 'active' | 'disabled' = 'active';
        let permissions: StaffPermissions = isMasterAdmin ? DEFAULT_OWNER_PERMISSIONS : DEFAULT_STAFF_PERMISSIONS;

        // Check Firestore staff collection if not master admin
        if (!isMasterAdmin && emailLower) {
          try {
            const staffQuery = query(collection(db, 'staff'), where('email', '==', emailLower));
            const snap = await getDocs(staffQuery);
            if (!snap.empty) {
              const staffDoc = snap.docs[0].data();
              role = staffDoc.role || 'staff';
              status = staffDoc.status || 'active';
              permissions = staffDoc.permissions || DEFAULT_STAFF_PERMISSIONS;
            }
          } catch {
            // Silently fall back if network/offline
          }
        }

        const appUser: AppUser = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Music Fan',
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          role,
          status,
          permissions,
        };

        const userProfile: UserProfile = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Music Fan',
          email: firebaseUser.email || 'guest@sbgmusic.app',
          photoURL: firebaseUser.photoURL || undefined,
          role,
          status,
          isAdmin: role === 'owner' || role === 'admin',
          isStaff: role === 'owner' || role === 'admin' || role === 'staff',
          permissions,
        };

        setUser(appUser);
        setProfile(userProfile);
      } else {
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'owner' || user.role === 'admin') return true;
    if (ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return true;
    if (user.permissions && (user.permissions as any)[permission]) return true;
    return false;
  };

  const loginGuest = async () => {
    try {
      await signInAnonymously(auth);
    } catch {
      // Local fallback for guest
      const guestId = 'guest-' + Date.now();
      const guestUser: AppUser = {
        uid: guestId,
        id: guestId,
        displayName: 'Guest Listener',
        email: 'guest@sbgmusic.app',
        role: 'user',
        status: 'active',
        permissions: DEFAULT_STAFF_PERMISSIONS,
      };
      setUser(guestUser);
      setProfile({
        uid: guestId,
        id: guestId,
        displayName: 'Guest Listener',
        email: 'guest@sbgmusic.app',
        role: 'user',
        status: 'active',
        isAdmin: false,
        isStaff: false,
      });
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      return { success: true };
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        return { success: false, cancelled: true };
      }
      return { success: false, error: err?.message || 'Google sign-in failed' };
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch {}
    setUser(null);
    setProfile(null);
  };

  const isAdmin = Boolean(user?.role === 'owner' || user?.role === 'admin' || profile?.isAdmin);
  const isStaff = Boolean(isAdmin || user?.role === 'staff' || profile?.isStaff);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      isAdmin, 
      isStaff, 
      isLoading, 
      hasPermission, 
      loginGuest, 
      loginWithGoogle, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
