import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

function getFallbackUserId() {
  let uid = localStorage.getItem('sbg_visitor_id');
  if (!uid) {
    uid = 'anon_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('sbg_visitor_id', uid);
  }
  return uid;
}

export function useFavorites() {
  const [userId, setUserId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Try to sign in anonymously if not already signed in
    const initAuth = async () => {
      try {
        if (auth.currentUser) {
          setUserId(auth.currentUser.uid);
        } else {
          const cred = await signInAnonymously(auth);
          setUserId(cred.user.uid);
        }
      } catch (err) {
        console.warn('Anonymous sign-in failed, using fallback ID', err);
        setUserId(getFallbackUserId());
      }
    };
    initAuth();
    
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) setUserId(user.uid);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const favRef = collection(db, 'users', userId, 'favorites');
    const unsubscribe = onSnapshot(favRef, (snap) => {
      const favSet = new Set<string>();
      snap.forEach((doc) => favSet.add(doc.id));
      setFavorites(favSet);
    }, (err) => {
      console.warn("Failed to subscribe to favorites", err);
    });

    return () => unsubscribe();
  }, [userId]);

  const toggleFavorite = async (songId: string) => {
    if (!userId) return;
    
    const docRef = doc(db, 'users', userId, 'favorites', songId);
    
    try {
      if (favorites.has(songId)) {
        await deleteDoc(docRef);
        // Optimistic update
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(songId);
          return newSet;
        });
      } else {
        await setDoc(docRef, { addedAt: Date.now(), songId });
        // Optimistic update
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.add(songId);
          return newSet;
        });
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  return { favorites, toggleFavorite };
}
