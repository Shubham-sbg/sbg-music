import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged, signInAnonymously, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isStaff: boolean;
  isLoading: boolean;
  loginGuest: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setProfile({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Music Fan',
          email: firebaseUser.email || 'guest@sbgmusic.app',
          photoURL: firebaseUser.photoURL || undefined,
          isAdmin: false,
          isStaff: false,
        });
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginGuest = async () => {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      // Local fallback for guest
      setUser({ uid: 'guest-' + Date.now() } as any);
      setProfile({
        uid: 'guest-' + Date.now(),
        displayName: 'Guest Listener',
        email: 'guest@sbgmusic.app',
      });
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {}
    setUser(null);
    setProfile(null);
  };

  const isAdmin = Boolean(profile?.isAdmin || profile?.email?.includes('admin'));
  const isStaff = Boolean(profile?.isStaff || isAdmin);

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, isStaff, isLoading, loginGuest, logout }}>
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
