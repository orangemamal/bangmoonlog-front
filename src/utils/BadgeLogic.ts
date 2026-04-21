import { BADGES, REGION_BADGE_TEMPLATE, Badge } from "../constants/badges";

export interface UserStats {
  totalCount: number;
  totalPhotos: number;
  longReviewCount: number;
  firstReviewCount: number;
  totalLikes: number;
  perfectScoreCount: number;
  strictScoreCount: number;
  regionCounts: Record<string, number>;
}

/**
 * 유저의 리뷰 목록을 분석하여 통계 데이터를 추출합니다.
 */
export const calculateUserStats = (reviews: any[]): UserStats => {
  const stats: UserStats = {
    totalCount: reviews.length,
    totalPhotos: 0,
    longReviewCount: 0,
    firstReviewCount: 0,
    totalLikes: 0,
    perfectScoreCount: 0,
    strictScoreCount: 0,
    regionCounts: {},
  };

  reviews.forEach((r) => {
    // 1. 사진 수
    stats.totalPhotos += (r.images?.length || 0);

    // 2. 장문의 리뷰 (200자 이상)
    if ((r.content?.length || 0) >= 200) stats.longReviewCount++;

    // 3. 받은 공감 수
    stats.totalLikes += (r.likes || 0);

    // 4. 평점 마스터 로직 (내부/건물/동네 모두 5점 혹은 모두 1점)
    const scores = [r.interiorRating, r.buildingRating, r.neighborhoodRating];
    if (scores.every(s => s === 5)) stats.perfectScoreCount++;
    if (scores.every(s => s === 1)) stats.strictScoreCount++;

    // 5. 지역 정보 추출 (주소에서 '구' 단위 추출)
    // 예: "서울 중구 소공로..." -> "중구"
    const addrParts = (r.location || r.address || "").split(" ");
    const district = addrParts.find((p: string) => p.endsWith("구") || p.endsWith("군") || p.endsWith("시"));
    if (district) {
      stats.regionCounts[district] = (stats.regionCounts[district] || 0) + 1;
    }

    // 6. 스피드 분석가 (첫 번째 작성 여부는 외부에서 주입하거나 랭킹 로직 필요)
    if (r.isFirstReview) stats.firstReviewCount++;
  });

  return stats;
};

/**
 * 통계 데이터를 기반으로 획득한 모든 칭호를 반환합니다.
 */
export const getMyBadges = (stats: UserStats): Badge[] => {
  const earned: Badge[] = [];

  // 1. 기본 및 스페셜 칭호 체크
  BADGES.forEach(badge => {
    if (badge.condition(stats)) {
      earned.push(badge);
    }
  });

  // 2. 지역 점령 칭호 체크 (10회 이상 작성한 지역당 하나씩 생성)
  Object.entries(stats.regionCounts).forEach(([region, count]) => {
    if (count >= 10) {
      earned.push({
        id: `region_${region}`,
        title: `${region} ${REGION_BADGE_TEMPLATE.title}`,
        description: `${region} 내 방문록 ${count}회 작성`,
        icon: REGION_BADGE_TEMPLATE.icon,
        category: "region",
        condition: () => true
      });
    }
  });

  return earned;
};
