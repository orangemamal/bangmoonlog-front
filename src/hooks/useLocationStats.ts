import { useMemo } from 'react';
import { Review, LocationStatsMap } from '../types/review';
import { aggregateLocationStats } from '../utils/locationUtils';

/**
 * 전역 리뷰 상태와 찜 상태를 구독하여 위치별 통계를 제공하는 훅
 */
export const useLocationStats = (
  reviews: Review[],
  favoritedAddresses: Set<string>,
  userId?: string
) => {
  const statsMap = useMemo(() => {
    return aggregateLocationStats(reviews, favoritedAddresses, userId);
  }, [reviews, favoritedAddresses, userId]);

  const getLocationStats = (address: string) => {
    // 주소 정규화는 내부 유틸리티에서 처리하므로 여기서는 매칭만 수행
    return statsMap[address] || null;
  };

  return { statsMap, getLocationStats };
};
