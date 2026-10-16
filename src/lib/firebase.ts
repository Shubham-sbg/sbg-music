import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Standard environment or fallback credentials
const firebaseConfig = {
  apiKey: typeof process !== 'undefined' ? process.env?.FIREBASE_API_KEY || 'AIzaSySBG-Music-App-Default-Key-1' : 'AIzaSySBG-Music-App-Default-Key-1',
  authDomain: 'sbg-music-app.firebaseapp.com',
  projectId: 'sbg-music-app',
  storageBucket: 'sbg-music-app.firebasestorage.app',
  messagingSenderId: '602596322255',
  appId: '1:602596322255:web:43d21d91cea34fa8896e56',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let dbInstance;
try {
  // Initialize with persistent multi-tab offline cache
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (e) {
  // Fallback to default instance if already initialized
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
