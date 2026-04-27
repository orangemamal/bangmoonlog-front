import { Review, LocationStats, LocationStatsMap } from "../types/review";
import { normalizeBaseAddress } from "./addressUtils";

/**
 * 리뷰 리스트에서 평균 평점을 계산합니다.
 */
export const calculateAverageRating = (reviewList: Review[]): string => {
  if (!reviewList || reviewList.length === 0) return "0.0";
  const totalAvg = reviewList.reduce((acc, rev) => {
    const revAvg = ((rev.ratings?.light || 0) + (rev.ratings?.noise || 0) + (rev.ratings?.water || 0)) / 3;
    return acc + revAvg;
  }, 0);
  return (totalAvg / reviewList.length).toFixed(2);
};

/**
 * 전체 리뷰와 찜 목록을 결합하여 위치별 통계 맵을 생성합니다.
 */
export const aggregateLocationStats = (
  reviews: Review[],
  favoritedAddresses: Set<string>,
  userId?: string
): LocationStatsMap => {
  const statsMap: LocationStatsMap = {};

  // 1. 리뷰 기반 집계
  reviews.forEach(review => {
    const addr = normalizeBaseAddress(review.address || review.location || "");
    if (!statsMap[addr]) {
      statsMap[addr] = {
        address: addr,
        lat: review.lat,
        lng: review.lng,
        count: 0,
        avgRating: 0,
        isBookmarked: favoritedAddresses.has(addr),
        hasWritten: false
      };
    }

    const stats = statsMap[addr];
    stats.count += 1;
    if (userId && review.authorId === userId) {
      stats.hasWritten = true;
    }
  });

  // 2. 평점 계산
  const groups: Record<string, Review[]> = {};
  reviews.forEach(r => {
    const addr = normalizeBaseAddress(r.address || r.location || "");
    if (!groups[addr]) groups[addr] = [];
    groups[addr].push(r);
  });

  Object.keys(statsMap).forEach(addr => {
    statsMap[addr].avgRating = Number(calculateAverageRating(groups[addr]));
  });

  // 3. 찜 목록 중 리뷰가 없는 장소 추가
  // (필요 시 구현 - 현재는 리뷰가 있는 곳 위주로 마커 표시)

  return statsMap;
};
