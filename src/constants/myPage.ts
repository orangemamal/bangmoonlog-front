
export interface MyPageMenuItem {
  label: string;
  path: string;
  icon: string; // lucide-react 아이콘 이름 또는 커스텀 식별자
  category: "활동" | "정보" | "설정" | "지원";
}

export const MY_PAGE_MENU: MyPageMenuItem[] = [
  { label: "내가 쓴 방문록", path: "/my/reviews", icon: "Edit3", category: "활동" },
  { label: "찜한 리스트", path: "/my/bookmarks", icon: "Bookmark", category: "활동" },
  { label: "최근 본 방문록", path: "/my/recent", icon: "Clock", category: "활동" },

  { label: "공지사항", path: "/announcements", icon: "Megaphone", category: "정보" },
  { label: "방문Log 공유하기", path: "share", icon: "Share2", category: "정보" },

  { label: "알림 설정", path: "settings-notif", icon: "Settings", category: "설정" },
  { label: "회원 탈퇴", path: "withdraw", icon: "UserMinus", category: "설정" },

  { label: "1:1 문의하기", path: "mailto:bangmoonlog.cs@gmail.com?subject=[1:1문의] 문의드립니다", icon: "MessageSquare", category: "지원" },
  { label: "자주 묻는 질문", path: "/faq", icon: "HelpCircleIcon", category: "지원" },
  { label: "제휴 문의", path: "mailto:bangmoonlog.cs@gmail.com?subject=[제휴문의] 방문Log 파트너십 제안", icon: "Handshake", category: "지원" },
];
