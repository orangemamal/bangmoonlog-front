import { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

interface User {
  id: string;
  name: string;
  displayName?: string;
  email?: string | null;
  photoURL?: string;
  isAnonymous?: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let name = firebaseUser.displayName || "방문객";
        let photoURL = firebaseUser.photoURL || undefined;
        let email = firebaseUser.email || null;

        try {
          const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userSnap.exists()) {
             const data = userSnap.data();
             if (data.displayName) name = data.displayName;
             if (data.photoURL) photoURL = data.photoURL;
             if (data.email) email = data.email;
          }
        } catch (e) {
          console.warn("Failed to fetch user profile", e);
        }

        setUser({
          id: firebaseUser.uid,
          name,
          displayName: name,
          email,
          photoURL,
          isAnonymous: firebaseUser.isAnonymous
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase signOut error:', e);
    }
  }, []);

  const updateProfile = useCallback(async (partial: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };

      if (updated.id) {
         setDoc(doc(db, "users", updated.id), {
           displayName: partial.name !== undefined ? partial.name : updated.name,
           photoURL: partial.photoURL !== undefined ? partial.photoURL : updated.photoURL
         }, { merge: true }).catch(err => console.error("Update profile error", err));
      }
      return updated;
    });
  }, []);

  return {
    isLoggedIn: !!user,
    user,
    loading,
    logout,
    updateProfile,
  };
}
