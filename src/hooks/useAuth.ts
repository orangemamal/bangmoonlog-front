import { useState, useCallback } from 'react';

interface User {
  id: string;
  name: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mock_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback(async (customUser?: User) => {
    // 토스 로그인 모킹 (실제로는 토스 앱으로 이동해야 함)
    return new Promise<void>((resolve) => {
      // 실제 앱 환경이 아니더라도 테스트 가능하도록 지연 시간 조금 (100ms로 단축)
      setTimeout(() => {
        const mockUser = customUser || { id: 'user_' + Math.random().toString(36).substr(2, 9), name: 'jm_tester' };
        setUser(mockUser);
        localStorage.setItem('mock_user', JSON.stringify(mockUser));
        resolve();
      }, 1000);
    });
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('mock_user');
  }, []);

  return {
    isLoggedIn: !!user,
    user,
    login,
    logout
  };
}
