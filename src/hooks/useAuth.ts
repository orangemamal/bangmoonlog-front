import { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

interface User {
  id: string;
  name: string;
  displayName?: string;
  email?: string | null;
  photoURL?: string;
  isAnonymous?: boolean;
  canViewAll?: boolean;
  canViewAllUntil?: any;
  isAdmin?: boolean;
}

const ADMIN_EMAILS = ["bangmoonlog.cs@gmail.com"];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // [중요] 상태 변경 시 이전 스냅샷 리스너가 있다면 먼저 해제
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (firebaseUser) {
        // [개선] 실시간 리스너 도입하여 권한(canViewAllUntil) 변경 시 즉시 반영
        unsubscribeSnapshot = onSnapshot(doc(db, 'users', firebaseUser.uid), (userSnap) => {
          if (userSnap.exists()) {
            const data = userSnap.data();
            const name = data.displayName || firebaseUser.displayName || "방문객";
            const photoURL = data.photoURL || firebaseUser.photoURL || undefined;
            const email = data.email || firebaseUser.email || null;
            let canViewAll = false;
            let canViewAllUntil = null;

            if (data.canViewAllUntil) {
              const expiry = data.canViewAllUntil.toDate();
              if (expiry > new Date()) {
                canViewAll = true;
                canViewAllUntil = data.canViewAllUntil;
              }
            }

            setUser({
              id: firebaseUser.uid,
              name,
              displayName: name,
              email,
              photoURL,
              isAnonymous: firebaseUser.isAnonymous,
              canViewAll,
              canViewAllUntil,
              isAdmin: ADMIN_EMAILS.includes(email || "")
            });
          } else {
            // 문서가 없는 경우 기본 정보 세팅
            setUser({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || "방문객",
              displayName: firebaseUser.displayName || "방문객",
              email: firebaseUser.email || null,
              photoURL: firebaseUser.photoURL || undefined,
              isAnonymous: firebaseUser.isAnonymous,
              canViewAll: false,
              isAdmin: ADMIN_EMAILS.includes(firebaseUser.email || "")
            });
          }
          setLoading(false);
        }, (err) => {
          console.warn("User snapshot error:", err);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
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
