import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: appletConfig.apiKey || 'AIzaSyAaFTPgM1-nZXLfHgHZMhgeLpSsnP6TUrU',
  authDomain: appletConfig.authDomain || 'adroit-outpost-85jvd.firebaseapp.com',
  projectId: appletConfig.projectId || 'adroit-outpost-85jvd',
  storageBucket: appletConfig.storageBucket || 'adroit-outpost-85jvd.firebasestorage.app',
  messagingSenderId: appletConfig.messagingSenderId || '300239377250',
  appId: appletConfig.appId || '1:300239377250:web:32dbd0b7fa6200949c123b',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const databaseId = appletConfig.firestoreDatabaseId || 'ai-studio-sbgsongs-43d21d91-cea3-4fa8-896e-5645cf7ac1a9';
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  }, databaseId);
} catch (e) {
  try {
    dbInstance = getFirestore(app, databaseId);
  } catch {
    dbInstance = getFirestore(app);
  }
}

export const db = dbInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
