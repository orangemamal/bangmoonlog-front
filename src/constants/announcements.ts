
export interface Announcement {
  id: string;
  category: "점검" | "업데이트" | "이벤트" | "안내";
  title: string;
  content: string;
  createdAt: string;
  isFixed: boolean;
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "1",
    category: "안내",
    title: "방문Log 서비스가 정식 오픈되었습니다! 🏠",
    content: "세입자들의 더 나은 세상을 위해, 방문Log가 첫 발을 내딛습니다.\\n\\n**[주요 기능 안내]**\\n- 네이버 지도 기반 방문록 확인\\n- 리얼한 거주 후기 작성\\n- 찜하기 알림 서비스\\n\\n많은 응원 부탁드립니다!",
    createdAt: "2024-04-10T10:00:00Z",
    isFixed: true
  },
  {
    id: "2",
    category: "업데이트",
    title: "칭호 시스템 및 알림 기능 고도화 업데이트",
    content: "활동에 따른 칭호 부여와 알림 읽음 처리 기능이 업데이트 되었습니다.\\n\\n지금 바로 내 정보에서 칭호를 확인해보세요!",
    createdAt: new Date().toISOString(),
    isFixed: false
  },
  {
    id: "3",
    category: "이벤트",
    title: "첫 방문록 작성 시 '새내기' 칭호 100% 증정!",
    content: "첫 방문록을 작성하고 귀여운 새내기 칭호를 획득하세요. ✨",
    createdAt: "2024-04-12T15:00:00Z",
    isFixed: false
  }
];
