import { useState } from "react";
import { Award, Heart, ChevronRight, Bookmark, Clock, Edit3, Settings, HelpCircle } from "lucide-react";

export function MyPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return (
      <div className="mypage mypage--guest">
        <div className="mypage__login-prompt">
          <div className="mypage__login-prompt-icon">
            <Award size={40} color="#3182F6" />
          </div>
          <h2>리얼한 거주 후기,<br />지금 바로 확인해보세요!</h2>
          <p>로그인하고 전국 방방곡곡의 솔직 담백한<br />방문록을 구경해보세요.</p>
          <button className="mypage__login-btn" onClick={() => setIsLoggedIn(true)}>
            토스로 3초 만에 시작하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mypage">
      {/* 프로필 */}
      <div className="mypage__profile">
        <div className="mypage__profile-row">
          <div className="mypage__profile-info">
            <div className="mypage__avatar">오</div>
            <div>
              <h1 className="mypage__name">오종민 님</h1>
              <p className="mypage__email">ojongmin@toss.im</p>
            </div>
          </div>
          <button className="mypage__edit-btn">프로필 수정</button>
        </div>

        {/* 스탯 */}
        <div className="mypage__stats">
          <div className="mypage__stat-card">
            <div className="mypage__stat-icon">
              <Award size={20} color="#3182F6" />
            </div>
            <div>
              <p className="mypage__stat-label">발도장 뱃지</p>
              <p className="mypage__stat-value">12개</p>
            </div>
          </div>
          <div className="mypage__stat-card">
            <div className="mypage__stat-icon" style={{ backgroundColor: "#FFF0F0" }}>
              <Heart size={20} style={{ fill: "#F04452", color: "#F04452" }} />
            </div>
            <div>
              <p className="mypage__stat-label">도움돼요 누적</p>
              <p className="mypage__stat-value">840개</p>
            </div>
          </div>
        </div>
      </div>

      {/* 활동 메뉴 */}
      <div className="mypage__menu-section">
        <h3 className="mypage__menu-heading">나의 활동</h3>
        <MenuItem icon={<Edit3  size={20} color="#333D4B" />} title="내가 쓴 방문록" />
        <MenuItem icon={<Bookmark size={20} color="#333D4B" />} title="저장한 건물" />
        <MenuItem icon={<Clock  size={20} color="#333D4B" />} title="최근 본 방문록" />

        <div className="mypage__spacer" />
        <h3 className="mypage__menu-heading">설정 및 도움말</h3>
        <MenuItem icon={<Settings    size={20} color="#333D4B" />} title="알림 설정 (관심 지역 설정)" />
        <MenuItem icon={<HelpCircle  size={20} color="#333D4B" />} title="사업자 등록 문의" />
      </div>
    </div>
  );
}

function MenuItem({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <button className="mypage__menu-item">
      <div className="mypage__menu-item-left">
        {icon}
        <span className="mypage__menu-item-label">{title}</span>
      </div>
      <ChevronRight size={20} className="mypage__menu-item-chevron" />
    </button>
  );
}
