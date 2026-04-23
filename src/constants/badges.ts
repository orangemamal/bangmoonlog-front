export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: "level" | "region" | "special";
  condition: (stats: any) => boolean;
}

export const BADGES: Badge[] = [
  // 1. 레벨 기반 (기존 유지)
  { id: "lvl_0", title: "새내기", description: "방문록 0회 이상", icon: "🌱", category: "level", condition: (s) => s.totalCount >= 0 },
  { id: "lvl_1", title: "초보 방문객", description: "누적 방문록 1회 이상", icon: "🚶‍♂️", category: "level", condition: (s) => s.totalCount >= 1 },
  { id: "lvl_2", title: "동네 탐험가", description: "누적 방문록 5회 이상", icon: "🏃‍♂️", category: "level", condition: (s) => s.totalCount >= 5 },
  { id: "lvl_3", title: "로컬 가이드", description: "누적 방문록 20회 이상", icon: "👟", category: "level", condition: (s) => s.totalCount >= 20 },
  { id: "lvl_4", title: "프로 발품러", description: "누적 방문록 50회 이상", icon: "🥾", category: "level", condition: (s) => s.totalCount >= 50 },
  { id: "lvl_5", title: "방문록의 신", description: "누적 방문록 100회 이상", icon: "👑", category: "level", condition: (s) => s.totalCount >= 100 },

  // 2. 스페셜 업적
  { 
    id: "spc_photo", 
    title: "임장 사진가", 
    description: "누적 사진 30장 이상 & 평균 3장 이상 첨부", 
    icon: "📸", 
    category: "special", 
    condition: (s) => s.totalPhotos >= 30 && (s.totalPhotos / (s.totalCount || 1)) >= 3 
  },
  { 
    id: "spc_writer", 
    title: "장문의 기록가", 
    description: "200자 이상의 정성스러운 리뷰 5개 이상", 
    icon: "📝", 
    category: "special", 
    condition: (s) => s.longReviewCount >= 5 
  },
  { 
    id: "spc_speed", 
    title: "스피드 분석가", 
    description: "해당 건물의 첫 번째 방문록 작성 10회 이상", 
    icon: "⚡", 
    category: "special", 
    condition: (s) => s.firstReviewCount >= 10 
  },
  { 
    id: "spc_heart", 
    title: "공감 수집가", 
    description: "내 게시물이 받은 총 공감(좋아요)수 50개 돌파", 
    icon: "🤝", 
    category: "special", 
    condition: (s) => s.totalLikes >= 50 
  },
  { 
    id: "spc_angel", 
    title: "천사표 리뷰어", 
    description: "모든 항목(내부/건물/동네) 만점(5점) 리뷰 10개 이상", 
    icon: "😇", 
    category: "special", 
    condition: (s) => s.perfectScoreCount >= 10 
  },
  { 
    id: "spc_critic", 
    title: "엄격한 비평가", 
    description: "모든 항목(내부/건물/동네) 최저점(1점) 리뷰 10개 이상", 
    icon: "🧐", 
    category: "special", 
    condition: (s) => s.strictScoreCount >= 10 
  }
];

// 지역 점령 칭호 템플릿 (로직에서 동적으로 생성)
export const REGION_BADGE_TEMPLATE = {
  title: "보안관",
  description: "해당 지역 내 방문록 10회 작성",
  icon: "🤠",
  category: "region" as const
};
