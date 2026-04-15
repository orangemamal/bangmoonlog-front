import { useState, useCallback, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { signInAnonymously, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

/** Storage 업로드 등은 Firebase Auth 세션이 있어야 Storage 규칙을 통과합니다(mock 로그인과 별도). */
export async function ensureFirebaseAuthForStorage() {
  if (auth.currentUser) return;
  await signInAnonymously(auth);
}

interface User {
  id: string;
  name: string;
  photoURL?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mock_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback(async (customUser?: User) => {
    // 토스 로그인 모킹 (실제로는 토스 앱으로 이동해야 함)
    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        const baseUser = customUser || { id: 'user_' + Math.random().toString(36).substr(2, 9), name: 'jm_tester' };

        // Firestore에서 저장된 photoURL 불러오기
        try {
          const userSnap = await getDoc(doc(db, 'users', baseUser.id));
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.photoURL) baseUser.photoURL = data.photoURL;
          }
        } catch (e) {
          console.warn('Failed to load user profile from Firestore:', e);
        }

        try {
          await ensureFirebaseAuthForStorage();
        } catch (e) {
          console.warn(
            'Firebase 익명 로그인 실패 — Storage 업로드가 막힐 수 있습니다. 콘솔에서 Anonymous 로그인을 켜 주세요.',
            e
          );
        }

        setUser(baseUser);
        localStorage.setItem('mock_user', JSON.stringify(baseUser));
        resolve();
      }, 1000);
    });
  }, []);

  // 새로고침 후에도 mock 세션과 Firebase Auth 동기화
  useEffect(() => {
    if (!user) return;
    ensureFirebaseAuthForStorage().catch((e) => {
      console.warn('Firebase 익명 로그인 실패 (Storage 업로드 불가할 수 있음):', e);
    });
  }, [user?.id]);

  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem('mock_user');
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase signOut:', e);
    }
  }, []);

  const updateProfile = useCallback((partial: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      localStorage.setItem('mock_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return {
    isLoggedIn: !!user,
    user,
    login,
    logout,
    updateProfile,
  };
}
