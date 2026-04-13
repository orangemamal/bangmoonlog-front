import { useState, useEffect } from "react";
import { 
  Award, Heart, ChevronRight, Bookmark, Clock, Edit3, Settings, 
  HelpCircle, Megaphone, Share2, Smartphone, MessageSquare, HelpCircleIcon,
  X, CheckCircle2
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { db } from "../services/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getUserTitle } from "../utils/titleSystem";
import { motion, AnimatePresence } from "framer-motion";

export function MyPage() {
  const { isLoggedIn, login, logout, user } = useAuth();
  const [stats, setStats] = useState({ likes: 0, reviews: 0 });
  const [showTitleInfo, setShowTitleInfo] = useState(false);

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

  const titleSteps = [
    { count: 1, title: "초보 방문객", icon: "🚶‍♂️" },
    { count: 5, title: "동네 탐험가", icon: "🏃‍♂️" },
    { count: 20, title: "로컬 가이드", icon: "👟" },
    { count: 50, title: "프로 발품러", icon: "🥾" },
    { count: 100, title: "방문록의 신", icon: "👑" },
  ];

  return (
    <div className="mypage">
      {/* 프로필 */}
      <div className="mypage__profile">
        <div className="mypage__profile-row">
          <div className="mypage__profile-info">
            <div className="mypage__avatar">{user?.name ? user.name.slice(0, 1) : "오"}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {authorTitle && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <span style={{ fontSize: '12px', background: '#E8F3FF', padding: '2px 8px', borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 'bold', color: '#1B64DA' }}>
                    {authorTitle.icon} {authorTitle.title}
                  </span>
                  <button 
                    onClick={() => setShowTitleInfo(true)}
                    style={{ background: 'none', border: 'none', padding: 0, display: 'flex', opacity: 0.5, cursor: 'pointer' }}
                  >
                    <HelpCircle size={14} color="#1B64DA" />
                  </button>
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
        <MenuItem icon={<Bookmark size={20} color="#333D4B" />} title="관심 지역 및 건물 관리" />
        <MenuItem icon={<Clock  size={20} color="#333D4B" />} title="최근 본 방문록" />

        <div className="mypage__spacer" />
        <h3 className="mypage__menu-heading">앱 설정 및 정보</h3>
        <MenuItem icon={<Megaphone size={20} color="#333D4B" />} title="공지사항" />
        <MenuItem icon={<Smartphone size={20} color="#333D4B" />} title="홈 화면에 추가" />
        <MenuItem icon={<Share2 size={20} color="#333D4B" />} title="방문Log 공유하기" />

        <div className="mypage__spacer" />
        <h3 className="mypage__menu-heading">서비스 설정</h3>
        <div className="mypage__menu-item">
          <div className="mypage__menu-item-left">
            <Settings size={20} color="#333D4B" />
            <span className="mypage__menu-item-label">서비스 알림 설정</span>
          </div>
          <ToggleButton initialValue={true} />
        </div>
        <MenuItem icon={<MessageSquare size={20} color="#333D4B" />} title="1:1 문의하기" />
        <MenuItem icon={<HelpCircleIcon size={20} color="#333D4B" />} title="자주 묻는 질문" />
        <MenuItem icon={<Award size={20} color="#333D4B" />} title="제휴 문의" />
      </div>

      {/* 칭호 안내 모달 */}
      <AnimatePresence>
        {showTitleInfo && (
          <>
            <motion.div 
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTitleInfo(false)}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, WebkitBackdropFilter: 'blur(4px)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div 
              className="mypage__title-modal"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              style={{ 
                position: 'fixed', bottom: 0, left: 0, right: 0, 
                backgroundColor: 'white', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                padding: '32px 24px 48px', zIndex: 1001, maxHeight: '80vh', overflowY: 'auto'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#333D4B', margin: 0 }}>칭호 시스템 안내</h2>
                <button 
                  onClick={() => setShowTitleInfo(false)}
                  style={{ background: '#F2F4F6', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={20} color="#4E5968" />
                </button>
              </div>
              
              <div style={{ backgroundColor: '#F9FAFB', borderRadius: '16px', padding: '16px', marginBottom: '24px' }}>
                <p style={{ fontSize: '15px', color: '#4E5968', margin: 0, lineHeight: 1.6 }}>
                  방문Log를 작성할수록 더 높은 등급의 칭호를 획득할 수 있습니다. <br />
                  꾸준한 활동으로 <strong>방문록의 신</strong>에 도전해보세요!
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {titleSteps.map((step) => (
                  <div 
                    key={step.title}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px', borderRadius: '16px', border: '1px solid #F2F4F6',
                      backgroundColor: stats.reviews >= step.count ? '#E8F3FF' : 'white'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}>{step.icon}</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333D4B' }}>{step.title}</span>
                        <span style={{ fontSize: '13px', color: '#6B7684' }}>누적 방문록 {step.count}회 이상</span>
                      </div>
                    </div>
                    {stats.reviews >= step.count && (
                      <CheckCircle2 size={24} color="#3182F6" />
                    )}
                  </div>
                ))}
              </div>

              <button 
                className="mypage__login-btn" 
                style={{ marginTop: '32px', boxShadow: 'none' }}
                onClick={() => setShowTitleInfo(false)}
              >
                닫기
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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

function ToggleButton({ initialValue }: { initialValue: boolean }) {
  const [isOn, setIsOn] = useState(initialValue);
  return (
    <button 
      onClick={() => setIsOn(!isOn)}
      className={`toggle-btn ${isOn ? 'on' : 'off'}`}
      style={{
        width: '40px', height: '22px', borderRadius: '11px',
        backgroundColor: isOn ? '#3182F6' : '#E5E8EB',
        position: 'relative', border: 'none', cursor: 'pointer',
        transition: 'background-color 0.2s',
        flexShrink: 0
      }}
    >
      <motion.div 
        animate={{ x: isOn ? 20 : 2 }}
        initial={false}
        style={{
          width: '18px', height: '18px', borderRadius: '50%',
          backgroundColor: 'white', position: 'absolute', top: '2px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
