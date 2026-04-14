import { useState, useEffect } from "react";
import * as Icons from "lucide-react";
import {
  Award, Heart, ChevronRight, X, CheckCircle2, Trash2, MapPin, HelpCircle,
  Clock, Edit3, MoreHorizontal, Pencil
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { db } from "../services/firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc, getDoc } from "firebase/firestore";
import { getUserTitle } from "../utils/titleSystem";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ANNOUNCEMENTS, Announcement } from "../constants/announcements";
import { MY_PAGE_MENU } from "../constants/myPage";
import { ReviewDetail } from "../components/ReviewDetail";

export function MyPage() {
  const { isLoggedIn, login, logout, user } = useAuth();
  const [stats, setStats] = useState({ likes: 0, reviews: 0 });
  const [showTitleInfo, setShowTitleInfo] = useState(false);
  const [isBookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [bookmarkNotifEnabled, setBookmarkNotifEnabled] = useState(() => {
    return localStorage.getItem('bookmark_notif') !== 'false';
  });

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // 1:1 문의 폼 상태
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryType, setInquiryType] = useState("");
  const [inquiryContent, setInquiryContent] = useState("");

  const titleSteps = [
    { count: 0, title: "새내기", icon: "🌱" },
    { count: 1, title: "초보 방문객", icon: "🚶‍♂️" },
    { count: 5, title: "동네 탐험가", icon: "🏃‍♂️" },
    { count: 20, title: "로컬 가이드", icon: "👟" },
    { count: 50, title: "프로 발품러", icon: "🥾" },
    { count: 100, title: "방문록의 신", icon: "👑" },
  ];

  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;

    const qStats = query(collection(db, "reviews"), where("authorId", "==", user.id));
    const unsubStats = onSnapshot(qStats, (snap: any) => {
      let totalLikes = 0;
      snap.forEach((doc: any) => { totalLikes += (doc.data().likes || 0); });
      setStats({ likes: totalLikes, reviews: snap.size });
      setMyReviews(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });

    const qBookmarks = query(collection(db, "bookmarks"), where("userId", "==", user.id));
    const unsubBookmarks = onSnapshot(qBookmarks, (snap: any) => {
      setBookmarks(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });

    // 최근 본 목록 상세 로드
    const loadRecentDetails = async () => {
      const saved = localStorage.getItem("recent_logs");
      if (saved) {
        const ids = JSON.parse(saved) as string[];
        const details = [];
        for (const id of ids) {
          const d = await getDoc(doc(db, "reviews", id));
          if (d.exists()) details.push({ id: d.id, ...d.data() });
        }
        setRecentLogs(details);
      }
    };

    if (activeModal === "recent") loadRecentDetails();

    return () => { unsubStats(); unsubBookmarks(); };
  }, [user?.id, activeModal]);

  // 공유하기 기능
  const handleShare = () => {
    if (window.confirm("방문Log 서비스를 친구들에게 공유할까요?")) {
      // 가상의 Toss 공유 링크 생성 로직
      alert("공유 링크가 복사되었습니다!");
    }
  };

  // 홈 화면 추가
  const handleAddToHome = () => {
    alert("브라우저 메뉴의 '홈 화면에 추가'를 눌러 앱처럼 사용해보세요! ✨");
  };

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
            <button className="mypage__login-btn" style={{ fontSize: '14px', height: '48px', margin: 0 }} onClick={() => login({ id: 'test_a', name: '이민수' })}>이민수</button>
            <button className="mypage__login-btn" style={{ fontSize: '14px', height: '48px', margin: 0, backgroundColor: '#FFF0F0', color: '#F04452' }} onClick={() => login({ id: 'test_b', name: '김지영' })}>김지영</button>
            <button className="mypage__login-btn" style={{ fontSize: '14px', height: '48px', margin: 0, backgroundColor: '#E7F9F1', color: '#00A968' }} onClick={() => login({ id: 'test_c', name: '박태환' })}>박태환</button>
            <button className="mypage__login-btn" style={{ fontSize: '14px', height: '48px', margin: 0, backgroundColor: '#F2F4F6', color: '#4E5968' }} onClick={() => login({ id: 'test_d', name: '최소연' })}>최소연</button>
          </div>
        </div>
      </div>
    );
  }

  const authorTitle = getUserTitle(stats.reviews);

  return (
    <div className="mypage">
      <div className="mypage__profile">
        <div className="mypage__profile-row">
          <div className="mypage__profile-info">
            <div className="mypage__avatar">{user?.name?.slice(0, 1)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {authorTitle && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', background: '#E8F3FF', padding: '2px 8px', borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 'bold', color: '#1B64DA' }}>
                    {authorTitle.icon} {authorTitle.title}
                  </span>
                  <button onClick={() => setShowTitleInfo(true)} style={{ background: 'none', border: 'none', padding: 0, display: 'flex', opacity: 0.5, cursor: 'pointer' }}>
                    <HelpCircle size={14} color="#1B64DA" />
                  </button>
                </div>
              )}
              <h1 className="mypage__name" style={{ margin: 0 }}>{user?.name} 님</h1>
              <p className="mypage__email" style={{ marginTop: '2px' }}>{user?.id}@toss.im</p>
            </div>
          </div>
          <button className="mypage__logout-btn" onClick={logout}>로그아웃</button>
        </div>

        <div className="mypage__stats">
          <div className="mypage__stat-card">
            <div className="mypage__stat-icon"><Award size={20} color="#3182F6" /></div>
            <div>
              <p className="mypage__stat-label">발도장 뱃지</p>
              <p className="mypage__stat-value">{stats.reviews}개</p>
            </div>
          </div>
          <div className="mypage__stat-card">
            <div className="mypage__stat-icon" style={{ backgroundColor: "#FFF0F0" }}><Heart size={20} style={{ fill: "#F04452", color: "#F04452" }} /></div>
            <div>
              <p className="mypage__stat-label">공감받은 횟수</p>
              <p className="mypage__stat-value">{stats.likes}개</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mypage__menu-section">
        {["활동", "정보", "설정", "지원"].map((cat) => (
          <div key={cat}>
            <h3 className="mypage__menu-heading">{cat === "활동" ? "나의 활동" : cat === "정보" ? "앱 설정 및 정보" : cat === "설정" ? "서비스 설정" : "고객 지원"}</h3>
            {MY_PAGE_MENU.filter(m => m.category === cat).map(item => {
              const IconComp = (Icons as any)[item.icon] || HelpCircle;

              if (item.label === "찜한 방문록 알림 설정") {
                return (
                  <div className="mypage__menu-item" key={item.label}>
                    <div className="mypage__menu-item-left">
                      <IconComp size={20} color="#333D4B" />
                      <span className="mypage__menu-item-label">{item.label}</span>
                    </div>
                    <ToggleButton 
                      initialValue={bookmarkNotifEnabled} 
                      onChange={(isOn) => {
                        setBookmarkNotifEnabled(isOn);
                        localStorage.setItem('bookmark_notif', isOn ? 'true' : 'false');
                        alert(isOn ? "찜한 건물의 새로운 방문록 알림을 받습니다 🔔" : "찜한 건물의 새로운 방문록 알림을 해제했습니다 🔕");
                      }} 
                    />
                  </div>
                );
              }

              return (
                <MenuItem
                  key={item.label}
                  icon={<IconComp size={20} color="#333D4B" />}
                  title={item.label}
                  badge={item.label === "찜한 리스트" && bookmarks.length > 0 ? bookmarks.length : undefined}
                  onClick={() => {
                    if (item.label === "1:1 문의하기") {
                      setInquiryEmail(user?.id ? `${user.id}@toss.im` : "");
                      setInquiryType("");
                      setInquiryContent("");
                      setActiveModal("inquiry");
                    }
                    else if (item.label === "제휴 문의") {
                      setActiveModal("partnership");
                    }
                    else if (item.path.startsWith("mailto:")) window.location.href = item.path;
                    else if (item.path === "share") handleShare();
                    else if (item.path === "add-to-home") handleAddToHome();
                    else if (item.label === "찜한 리스트") setBookmarkModalOpen(true);
                    else if (item.label === "내가 쓴 방문록") setActiveModal("reviews");
                    else if (item.label === "최근 본 방문록") setActiveModal("recent");
                    else if (item.label === "공지사항") setActiveModal("announcements");
                    else if (item.label === "자주 묻는 질문") setActiveModal("faq");
                  }}
                  isSpecial={item.label === "제휴 문의"}
                />
              );
            })}
            <div className="mypage__spacer" />
          </div>
        ))}
        {/* [임시] 데이터 마이그레이션 도구 */}
        <div style={{ padding: '0 20px 40px' }}>
          <button
            onClick={async () => {
              if (window.confirm("기존 데이터에 방문 유형(단순 방문)을 일괄 적용할까요?")) {
                const { migrateExperienceType } = await import("../utils/migration");
                const res = await migrateExperienceType();
                if (res.success) {
                  alert(`마이그레이션 완료! ${res.count}개의 문서가 업데이트 되었습니다.`);
                } else {
                  alert("마이그레이션 도중 오류가 발생했습니다.");
                }
              }
            }}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#F2F4F6',
              color: '#8B95A1',
              border: 'none',
              borderRadius: '16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🔄 데이터 정규화 및 동기화 실행
          </button>
          <p style={{ fontSize: '12px', color: '#B0B8C1', textAlign: 'center', marginTop: '8px' }}>
            새로 추가된 '방문 유형' 필드를 기존 데이터에 일괄 반영합니다.
          </p>
        </div>
      </div>

      {/* 공통 슬라이드 업 모달 (내가 쓴 방문록, 최근 본 목록, 공지사항 등) */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'white', zIndex: 2500, overflowY: 'auto' }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F2F4F6', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
              <button onClick={() => setActiveModal(null)} style={{ border: 'none', background: 'none', marginRight: '16px', display: 'flex' }}><ArrowLeft size={24} color="#333D4B" /></button>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                {activeModal === "reviews" ? "내가 쓴 방문록" :
                  activeModal === "recent" ? "최근 본 방문록" :
                    activeModal === "announcements" ? "공지사항" :
                      activeModal === "inquiry" ? "문의하기" :
                        activeModal === "partnership" ? "제휴 문의" : "자주 묻는 질문"}
              </h2>
            </div>

            <div style={{ padding: '20px' }}>
              {activeModal === "announcements" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ANNOUNCEMENTS.sort((a, b) => (b.isFixed ? 1 : 0) - (a.isFixed ? 1 : 0)).map(ann => (
                    <div
                      key={ann.id}
                      onClick={() => setSelectedAnnouncement(ann)}
                      style={{ padding: '16px', borderRadius: '16px', backgroundColor: '#F9FAFB', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: ann.category === "점검" ? "#F04452" : "#3182F6" }}>[{ann.category}]</span>
                        {ann.isFixed && <span style={{ fontSize: '12px', fontWeight: 700, color: '#3182F6' }}>📌 중요</span>}
                        {(new Date().getTime() - new Date(ann.createdAt).getTime() < 86400000) && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F04452' }} />}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#333D4B' }}>{ann.title}</div>
                      <div style={{ fontSize: '12px', color: '#8B95A1', marginTop: '4px' }}>{ann.createdAt.slice(0, 10).replace(/-/g, '.')}</div>
                    </div>
                  ))}
                </div>
              )}
              {activeModal === "partnership" && (
                <div className="mypage__partnership">
                  <div className="mypage__partnership-slogan">
                    세입자의 알권리를 위해 함께 뜁니다.
                  </div>

                  {/* 카드 UI */}
                  <div className="mypage__partnership-card">
                    <div className="card-logo">방문Log <span>Business</span></div>
                    <div className="card-philosophy">
                      "우리는 투명한 부동산 시장을 위해<br />
                      실제 거주 데이터를 연결합니다."
                    </div>
                  </div>

                  {/* 가치 제안 섹션 */}
                  <div className="mypage__partnership-values">
                    <div className="value-item">
                      <div className="value-icon">🎯</div>
                      <div className="value-text">
                        <strong>정확한 타겟팅</strong>
                        예비 세입자 접점 확보
                      </div>
                    </div>
                    <div className="value-item">
                      <div className="value-icon">📢</div>
                      <div className="value-text">
                        <strong>데이터 신뢰도</strong>
                        인증된 사용자의 진짜 보이스
                      </div>
                    </div>
                    <div className="value-item">
                      <div className="value-icon">🤝</div>
                      <div className="value-text">
                        <strong>브랜드 가치</strong>
                        세입자 권리 증진 기여
                      </div>
                    </div>
                  </div>

                  <button
                    className="mypage__partnership-submit glow-btn"
                    onClick={() => {
                      setInquiryEmail(user?.id ? `${user.id}@toss.im` : "");
                      setInquiryType("제휴 문의");
                      setInquiryContent(`안녕하세요, 방문Log 팀!\n함께 세입자의 세상을 바꿀 제안을 드리고 싶습니다.\n\n- 업체/성함: \n- 연락처: \n- 제안 내용(자유롭게): \n\n위 내용을 적어 보내주시면 검토 후 2-3일 내로 회신드리겠습니다.`);
                      setActiveModal("inquiry");
                    }}
                  >
                    방문Log 팀에게 메일 쓰기
                  </button>
                </div>
              )}
              {activeModal === "inquiry" && (
                <div className="mypage__inquiry">
                  <div className="mypage__inquiry-field">
                    <label className="mypage__inquiry-label">답변받으실 이메일</label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      className="mypage__inquiry-input"
                      value={inquiryEmail}
                      onChange={(e) => setInquiryEmail(e.target.value)}
                    />
                  </div>

                  <div className="mypage__inquiry-field">
                    <label className="mypage__inquiry-label">문의 유형</label>
                    <div style={{ position: 'relative' }}>
                      <select
                        className="mypage__inquiry-input mypage__inquiry-select"
                        value={inquiryType}
                        onChange={(e) => setInquiryType(e.target.value)}
                      >
                        <option value="" disabled>카테고리 선택</option>
                        <option value="서비스 이용">서비스 이용 문의</option>
                        <option value="오류 제보">오류/버그 제보</option>
                        <option value="계정/인증">계정 및 인증 관련</option>
                        <option value="불건전 게시물">불건전 게시물 신고</option>
                        <option value="기타">기타 문의</option>
                      </select>
                      <Icons.ChevronDown size={20} color="#8B95A1" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                  </div>

                  <div className="mypage__inquiry-field">
                    <label className="mypage__inquiry-label">문의 내용</label>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        className="mypage__inquiry-textarea"
                        placeholder="내용을 입력하세요."
                        maxLength={1000}
                        value={inquiryContent}
                        onChange={(e) => setInquiryContent(e.target.value)}
                      />
                      <div className="mypage__inquiry-counter">{inquiryContent.length}/1000</div>
                    </div>
                  </div>

                  <button
                    className="mypage__inquiry-submit"
                    disabled={!inquiryEmail || !inquiryType || !inquiryContent}
                    onClick={() => {
                      const subject = encodeURIComponent(`[방문Log 1:1문의] ${inquiryType}`);
                      const body = encodeURIComponent(
                        `답변받으실 이메일: ${inquiryEmail}\n` +
                        `문의 유형: ${inquiryType}\n\n` +
                        `-- 문의 내용 --\n${inquiryContent}`
                      );
                      window.location.href = `mailto:roomlog.cs@gmail.com?subject=${subject}&body=${body}`;
                      alert("작성하신 내용으로 메일 앱을 실행합니다. 메일 앱에서 전송 버튼을 눌러주세요!");
                    }}
                  >
                    문의하기
                  </button>
                </div>
              )}
              {activeModal === "faq" && <div style={{ textAlign: 'center', padding: '40px', color: '#8B95A1' }}>준비 중인 서비스입니다.</div>}
              {activeModal === "recent" && (
                recentLogs.length === 0 ? <p style={{ textAlign: 'center', color: '#8B95A1', padding: '40px' }}>최근 본 방문록이 없습니다.</p> :
                  <div className="mypage__card-list">
                    {recentLogs.map(r => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedReviewId(r.id)}
                        className="mypage__card"
                      >
                        <div className="mypage__card-left">
                          <div className="mypage__card-icon recent">
                            <Clock size={24} color="#3182F6" />
                          </div>
                          <div className="mypage__card-info">
                            <div className="title">{r.location || r.address || "방문록 장소"}</div>
                            <div className="date">{r.date}</div>
                          </div>
                        </div>
                        <div className="mypage__card-right">
                          <ChevronRight size={20} color="#B0B8C1" />
                        </div>
                      </div>
                    ))}
                  </div>
              )}
              {activeModal === "reviews" && (
                myReviews.length === 0 ? <p style={{ textAlign: 'center', color: '#8B95A1', padding: '40px' }}>작성한 방문록이 없습니다.</p> :
                  <div className="mypage__card-list">
                    {myReviews.map(r => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedReviewId(r.id)}
                        className="mypage__card"
                      >
                        <div className="mypage__card-left">
                          <div className="mypage__card-icon review">
                            <Edit3 size={24} color="#3182F6" />
                          </div>
                          <div className="mypage__card-info">
                            <div className="title">{r.location || r.address || "방문록 장소"}</div>
                            <div className="date">{r.date}</div>
                          </div>
                        </div>
                        <div className="mypage__card-right">
                          <div style={{ position: 'relative' }}>
                            <button
                              className="mypage__card-more-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === r.id ? null : r.id);
                              }}
                            >
                              <MoreHorizontal size={20} color="#B0B8C1" />
                            </button>
                            {activeMenuId === r.id && (
                              <div className="mypage__card-menu">
                                <button onClick={(e) => { e.stopPropagation(); navigate(`/?edit=${r.id}`); }}>
                                  <Pencil size={18} /> 수정하기
                                </button>
                                <div className="mypage__card-menu-divider" />
                                <button className="danger" onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  setDeleteTargetId(r.id);
                                }}>
                                  <Trash2 size={18} /> 삭제하기
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 상세 공지 모달 */}
      <AnimatePresence>
        {selectedAnnouncement && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} style={{ position: 'fixed', inset: 0, backgroundColor: 'white', zIndex: 3000, padding: '24px', overflowY: 'auto' }}>
            <button onClick={() => setSelectedAnnouncement(null)} style={{ border: 'none', background: 'none', marginBottom: '24px' }}><ArrowLeft size={24} color="#333D4B" /></button>
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>{selectedAnnouncement.title}</h1>
            <p style={{ color: '#8B95A1', marginBottom: '24px' }}>{selectedAnnouncement.createdAt.slice(0, 10).replace(/-/g, '.')}</p>
            <div style={{ lineHeight: 1.8, fontSize: '16px', color: '#4E5968' }}>
              <ReactMarkdown>{selectedAnnouncement.content}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 기존 찜한 리스트 및 칭호 모달 유지... */}

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
      {/* 찜한 리스트 모달 (전체 화면 슬라이드) */}
      <AnimatePresence>
        {isBookmarkModalOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              backgroundColor: '#F9FAFB', zIndex: 2000, overflowY: 'auto'
            }}
          >
            <div style={{ padding: '20px 24px', backgroundColor: 'white', borderBottom: '1px solid #F2F4F6', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
              <button
                onClick={() => setBookmarkModalOpen(false)}
                style={{ border: 'none', background: 'none', marginRight: '16px', padding: '4px', display: 'flex' }}
              >
                <ArrowLeft size={24} color="#333D4B" />
              </button>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#333D4B', margin: 0 }}>찜한 리스트</h2>
            </div>

            <div style={{ padding: '16px' }}>
              {bookmarks.length === 0 ? (
                <div style={{ padding: '100px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '40px' }}>📍</div>
                  <p style={{ fontSize: '15px', color: '#8B95A1', lineHeight: 1.6 }}>찜한 건물이 아직 없어요.<br />지도를 탐색하며 마음에 드는 곳을 찜해보세요!</p>
                </div>
              ) : (
                bookmarks.map(bm => (
                  <div
                    key={bm.id}
                    onClick={() => {
                      setBookmarkModalOpen(false);
                      navigate(`/?lat=${bm.lat}&lng=${bm.lng}&zoom=19&address=${encodeURIComponent(bm.address)}`);
                    }}
                    style={{
                      backgroundColor: 'white', borderRadius: '20px', padding: '20px',
                      marginBottom: '12px', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', cursor: 'pointer',
                      gap: '12px' // 아이콘-텍스트-삭제버튼 사이의 최소 간격 확보
                    }}
                  >
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: '#E8F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MapPin size={24} color="#3182F6" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#333D4B', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {bm.address.split(' ').slice(-2).join(' ')}
                        </div>
                        <div style={{ fontSize: '13px', color: '#8B95A1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bm.address}</div>
                      </div>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try { await deleteDoc(doc(db, "bookmarks", bm.id)); } catch (err) { console.error(err); }
                      }}
                      style={{ border: 'none', background: 'none', color: '#B0B8C1', padding: '8px', flexShrink: 0 }}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Detail Modal */}
      <AnimatePresence>
        {selectedReviewId && (
          <ReviewDetail
            reviewId={selectedReviewId}
            onClose={() => setSelectedReviewId(null)}
          />
        )}
      </AnimatePresence>

      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {deleteTargetId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteTargetId(null)}
            className="mypage__confirm-overlay"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="mypage__confirm-modal"
            >
              <div className="mypage__confirm-icon">🗑️</div>
              <h3 className="mypage__confirm-title">방문록 삭제</h3>
              <p className="mypage__confirm-desc">정말 이 방문록을 삭제하시겠습니까? (영구 삭제)</p>
              <div className="mypage__confirm-actions">
                <button
                  className="mypage__confirm-cancel"
                  onClick={() => setDeleteTargetId(null)}
                >
                  닫기
                </button>
                <button
                  className="mypage__confirm-ok"
                  onClick={async () => {
                    try {
                      await deleteDoc(doc(db, "reviews", deleteTargetId));
                      setMyReviews(prev => prev.filter(x => x.id !== deleteTargetId));
                      setDeleteTargetId(null);
                    } catch (e) { console.error(e); }
                  }}
                >
                  확인
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function MenuItem({ icon, title, onClick, badge, isSpecial }: { icon: React.ReactNode; title: string; onClick?: () => void; badge?: number, isSpecial?: boolean }) {
  return (
    <button
      className={`mypage__menu-item ${isSpecial ? 'mypage__menu-item--special' : ''}`}
      onClick={onClick}
      style={isSpecial ? {
        background: 'linear-gradient(135deg, #E8F3FF 0%, #F0F7FF 100%)',
        border: '1px solid #D0E5FF',
        marginTop: '8px',
        padding: '24px 20px'
      } : {}}
    >
      <div className="mypage__menu-item-left">
        {icon}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span className="mypage__menu-item-label" style={isSpecial ? { fontWeight: 700, color: '#1B64DA' } : {}}>{title}</span>
          {isSpecial && <span style={{ fontSize: '12px', color: '#4E5968', marginTop: '2px' }}>방문Log와 함께 세입자의 세상을 바꿀 파트너를 찾습니다 🤝</span>}
        </div>
        {badge !== undefined && (
          <span style={{
            marginLeft: '8px', padding: '2px 8px', backgroundColor: '#3182F6',
            color: 'white', borderRadius: '100px', fontSize: '11px', fontWeight: 700
          }}>
            {badge}
          </span>
        )}
      </div>
      <ChevronRight size={20} className="mypage__menu-item-chevron" style={isSpecial ? { color: '#1B64DA' } : {}} />
    </button>
  );
}

const ArrowLeft = ({ size, color }: { size?: number, color?: string }) => (
  <svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

function ToggleButton({ initialValue, onChange }: { initialValue: boolean, onChange?: (isOn: boolean) => void }) {
  const [isOn, setIsOn] = useState(initialValue);
  return (
    <button
      onClick={() => {
        const newState = !isOn;
        setIsOn(newState);
        if (onChange) onChange(newState);
      }}
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
