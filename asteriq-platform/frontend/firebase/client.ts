import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * The auth cookie is a UX convenience so middleware can redirect
 * logged-out users. Real security lives in Firestore rules and
 * ID-token verification on the API.
 */
export function setAuthCookie() {
  document.cookie = "nexora-auth=1; path=/; max-age=2592000; samesite=lax";
}

export function clearAuthCookie() {
  document.cookie = "nexora-auth=; path=/; max-age=0";
  document.cookie = "vaani-auth=; path=/; max-age=0";
}
