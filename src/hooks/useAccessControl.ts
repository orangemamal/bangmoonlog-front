import { useState, useCallback, useEffect } from 'react';

export function useAccessControl() {
  const [readCount, setReadCount] = useState<number>(() => {
    return Number(sessionStorage.getItem('read_count')) || 0;
  });
  
  const [hasWatchedAd, setHasWatchedAd] = useState<boolean>(() => {
    return sessionStorage.getItem('has_watched_ad') === 'true';
  });

  const [isAdShowing, setIsAdShowing] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('read_count', String(readCount));
  }, [readCount]);

  useEffect(() => {
    sessionStorage.setItem('has_watched_ad', String(hasWatchedAd));
  }, [hasWatchedAd]);

  const canRead = useCallback(() => {
    // 1회까지는 무료, 그 이후엔 광고 시청 필수
    if (readCount < 1) return true;
    return hasWatchedAd;
  }, [readCount, hasWatchedAd]);

  const incrementReadCount = useCallback(() => {
    setReadCount(prev => prev + 1);
  }, []);

  const watchAd = useCallback(() => {
    setIsAdShowing(true);
    // 2초짜리 가상 광고
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setHasWatchedAd(true);
        setIsAdShowing(false);
        resolve();
      }, 2000);
    });
  }, []);

  return {
    canRead: canRead(),
    readCount,
    hasWatchedAd,
    incrementReadCount,
    watchAd,
    isAdShowing
  };
}
