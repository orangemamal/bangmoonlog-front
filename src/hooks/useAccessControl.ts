import { useState, useCallback, useEffect } from 'react';

export function useAccessControl() {
  const [readCount, setReadCount] = useState<number>(() => {
    return Number(sessionStorage.getItem('read_count')) || 0;
  });
  
  const [hasWatchedAd, setHasWatchedAd] = useState<boolean>(false);

  const [isAdShowing, setIsAdShowing] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('read_count', String(readCount));
  }, [readCount]);



  const canRead = useCallback(() => {
    // 광고 시청 여부가 최종 권한을 결정함
    return hasWatchedAd;
  }, [hasWatchedAd]);

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
