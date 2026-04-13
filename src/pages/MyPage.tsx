import { useState, useEffect } from "react";
import { Award, Heart, ChevronRight, Bookmark, Clock, Edit3, Settings, HelpCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { db } from "../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getUserTitle } from "../utils/titleSystem";

export function MyPage() {
  const { isLoggedIn, login, logout, user } = useAuth();
  const [stats, setStats] = useState({ likes: 0, reviews: 0 });

  useEffect(() => {
    if (!user?.id) return;

    const fetchStats = async () => {
      try {
        const q = query(collection(db, "reviews"), where("authorId", "==", user.id));
        const snap = await getDocs(q);
        
        let totalLikes = 0;
        const totalReviews = snap.size;

        snap.forEach((doc: any) => {
          totalLikes += (doc.data().likes || 0);
        });

        setStats({ likes: totalLikes, reviews: totalReviews });
      } catch (e) {
        console.error("MyPage stats error:", e);
      }
    };

    fetchStats();
  }, [user?.id]);

  if (!isLoggedIn) {
    return (
      <div className="mypage mypage--guest">
        <div className="mypage__login-prompt">
          <div className="mypage__login-prompt-icon">
            <Award size={40} color="#3182F6" />
          </div>
          <h2>리얼한 거주 후기,<br />지금 바로 확인해보세요!</h2>
          <p>로그인하고 전국 방방곡곡의 솔직 담백한<br />방문록을 구경해보세요.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px', width: '100%', maxWidth: '300px' }}>
            <button className="mypage__login-btn" style={{ fontSize: '14px', height: '48px', margin: 0 }} onClick={() => login({ id: 'test_a', name: '이민수' })}>
              이민수로 로그인
            </button>
            <button className="mypage__login-btn" style={{ fontSize: '14px', height: '48px', margin: 0, backgroundColor: '#FFF0F0', color: '#F04452' }} onClick={() => login({ id: 'test_b', name: '김지영' })}>
              김지영로 로그인
            </button>
            <button className="mypage__login-btn" style={{ fontSize: '14px', height: '48px', margin: 0, backgroundColor: '#E7F9F1', color: '#00A968' }} onClick={() => login({ id: 'test_c', name: '박태환' })}>
              박태환로 로그인
            </button>
            <button className="mypage__login-btn" style={{ fontSize: '14px', height: '48px', margin: 0, backgroundColor: '#F2F4F6', color: '#4E5968' }} onClick={() => login({ id: 'test_d', name: '최소연' })}>
              최소연로 로그인
            </button>
          </div>
        </div>
      </div>
    );
  }

  const authorTitle = getUserTitle(stats.reviews);

  return (
    <div className="mypage">
      {/* 프로필 */}
      <div className="mypage__profile">
        <div className="mypage__profile-row">
          <div className="mypage__profile-info">
            <div className="mypage__avatar">{user?.name ? user.name.slice(0, 1) : "오"}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {authorTitle && (
                <div style={{ display: 'flex' }}>
                   <span style={{ fontSize: '12px', background: '#E8F3FF', padding: '2px 8px', borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 'bold', color: '#1B64DA' }}>
                    {authorTitle.icon} {authorTitle.title}
                  </span>
                </div>
              )}
              <h1 className="mypage__name" style={{ margin: 0 }}>
                {user?.name || "오종민"} 님
              </h1>
              <p className="mypage__email" style={{ marginTop: '2px' }}>{user?.id ? `${user.id.slice(0, 8)}@toss.im` : "ojongmin@toss.im"}</p>
            </div>
          </div>
          <button className="mypage__logout-btn" onClick={logout}>로그아웃</button>
        </div>

        {/* 스탯 */}
        <div className="mypage__stats">
          <div className="mypage__stat-card">
            <div className="mypage__stat-icon">
              <Award size={20} color="#3182F6" />
            </div>
            <div>
              <p className="mypage__stat-label">발도장 뱃지</p>
              <p className="mypage__stat-value">{stats.reviews}개</p>
            </div>
          </div>
          <div className="mypage__stat-card">
            <div className="mypage__stat-icon" style={{ backgroundColor: "#FFF0F0" }}>
              <Heart size={20} style={{ fill: "#F04452", color: "#F04452" }} />
            </div>
            <div>
              <p className="mypage__stat-label">공감받은 횟수</p>
              <p className="mypage__stat-value">{stats.likes}개</p>
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
