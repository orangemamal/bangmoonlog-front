import { useState, useEffect, useCallback } from "react";
import * as Icons from "lucide-react";
import {
  Award, Heart, ChevronRight, X, CheckCircle2, Trash2, MapPin, HelpCircle,
  MoreHorizontal, Pencil, ArrowLeft
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { db } from "../services/firebase";
import {
  collection, query, where, onSnapshot, doc, deleteDoc, getDoc, setDoc
} from "firebase/firestore";
import { signInWithGoogle, signInWithKakao, signInWithNaver } from "../services/authService";
import { getUserTitle } from "../utils/titleSystem";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ANNOUNCEMENTS, Announcement } from "../constants/announcements";
import { MY_PAGE_MENU } from "../constants/myPage";
import { formatAddressDetail } from "../utils/addressUtils";
import { ReviewDetail } from "../components/ReviewDetail";
import { ProfileAvatarUpload } from "../components/mypage/ProfileAvatarUpload";
import logoSvg from "../assets/images/bangmoonlog_logo.svg";

/** Set true when Firebase Storage is ready — shows profile photo + upload UI. */
const ENABLE_PROFILE_PHOTO_UPLOAD = true;

export function MyPage() {
  const { isLoggedIn, logout, user, updateProfile, loading } = useAuth();
  const [stats, setStats] = useState({ likes: 0, reviews: 0 });
  const [showTitleInfo, setShowTitleInfo] = useState(false);
  const [isBookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [notiSettings, setNotiSettings] = useState({
    bookmarks: true,
    reactions: true,
    notices: true
  });
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [bookmarkDeleteTarget, setBookmarkDeleteTarget] = useState<{ id: string, address: string } | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // 1:1 문의 폼 상태
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryType, setInquiryType] = useState("");
  // 사용자 이름 수정 상태
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const titleSteps = [
    { count: 0, title: "새내기", icon: "🌱" },
    { count: 1, title: "초보 방문객", icon: "🚶‍♂️" },
    { count: 5, title: "동네 탐험가", icon: "🏃‍♂️" },
    { count: 20, title: "로컬 가이드", icon: "👟" },
    { count: 50, title: "프로 발품러", icon: "🥾" },
    { count: 100, title: "방문록의 신", icon: "👑" },
  ];

  const navigate = useNavigate();

  const handleLogin = useCallback(async (providerFn: () => Promise<any>) => {
    try {
      const result = await providerFn();
      if (result) {
        navigate("/"); // 로그인 성공 시 홈(지도)으로 리다이렉트
      }
    } catch (error) {
      console.error("Login handle error", error);
    }
  }, [navigate]);

  // 최근 본 목록 상세 로드 함수를 외부로 추출
  const loadRecentDetails = useCallback(async () => {
    const saved = localStorage.getItem("recent_logs");
    if (saved) {
      const ids = JSON.parse(saved) as string[];
      const details = [];
      for (const id of ids) {
        const d = await getDoc(doc(db, "reviews", id));
        if (d.exists()) {
          const data = d.data();
          details.push({
            id: d.id,
            ...data,
            date: data.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR').format(data.createdAt.toDate()) : "2026.04.10"
          });
        }
      }
      setRecentLogs(details);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const qStats = query(collection(db, "reviews"), where("authorId", "==", user.id));
    const unsubStats = onSnapshot(qStats, (snap: any) => {
      let totalLikes = 0;
      const reviewsList = snap.docs.map((d: any) => {
        const data = d.data();
        totalLikes += (data.likes || 0);
        return {
          id: d.id,
          ...data,
          date: data.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR').format(data.createdAt.toDate()) : "2026.04.10"
        };
      }).sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setStats({ likes: totalLikes, reviews: snap.size });
      setMyReviews(reviewsList);
    });

    const qBookmarks = query(collection(db, "bookmarks"), where("userId", "==", user.id));
    const unsubBookmarks = onSnapshot(qBookmarks, (snap: any) => {
      const bList = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
      setBookmarks(bList);
    });

    // 사용자 알림 설정 로드
    const loadUserSettings = async () => {
      const userRef = doc(db, "users", user.id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.settings?.notifications) {
          setNotiSettings(data.settings.notifications);
        }
      } else {
        // 기본값으로 문서 생성
        await setDoc(userRef, {
          id: user.id,
          name: user.name,
          settings: {
            notifications: {
              bookmarks: true,
              reactions: true,
              notices: true
            }
          }
        }, { merge: true });
      }
    };

    loadUserSettings();

    if (activeModal === "recent") loadRecentDetails();

    return () => { unsubStats(); unsubBookmarks(); };
  }, [user?.id, activeModal, loadRecentDetails]);

  // 알림 설정 변경 핸들러
  const handleToggleNotif = async (key: keyof typeof notiSettings) => {
    if (!user?.id) return;

    const newSettings = { ...notiSettings, [key]: !notiSettings[key] };
    setNotiSettings(newSettings);

    try {
      const userRef = doc(db, "users", user.id);
      await setDoc(userRef, {
        settings: {
          notifications: newSettings
        }
      }, { merge: true });
    } catch (e) {
      console.error("Failed to update notification settings:", e);
    }
  };

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

  if (loading) {
    return <div className="mypage mypage--guest" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="initial-loader" style={{ width: '32px', height: '32px', border: '3px solid #E5E8EB', borderTopColor: '#3182F6', borderRadius: '50%', animation: 'init-spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }} />
    </div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="mypage mypage--guest">
        <div className="mypage__login-prompt">
          <img src={logoSvg} alt="방문Log 로고" className="mypage__login-logo" />
          <h2>리얼한 거주 후기,<br />지금 바로 확인해보세요!</h2>

          <div className="mypage__login-buttons">
            <button className="login-btn login-btn--google" onClick={() => handleLogin(signInWithGoogle)}>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
              <span>Google 계정으로 로그인</span>
            </button>

            <button className="login-btn login-btn--kakao" onClick={() => handleLogin(signInWithKakao)}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.558 1.712 4.8 4.346 6.09l-.437 2.45c-.035.196.082.38.267.38.083 0 .166-.03.23-.086l2.91-1.928c.636.084 1.296.128 1.984.128 4.97 0 9-3.186 9-7.115S16.97 3 12 3z" /></svg>
              <span>카카오톡 계정으로 로그인</span>
            </button>

            <button className="login-btn login-btn--naver" onClick={() => handleLogin(signInWithNaver)}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.273 12.845L11.373 6.012H7.031V17.988H11.517V11.155L16.417 17.988H20.759V6.012H16.273V12.845Z" /></svg>
              <span>네이버 계정으로 로그인</span>
            </button>
          </div>
          <p className="login-agreement">
            첫 로그인 시 <span onClick={() => navigate('/terms')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>이용약관</span> 및 <span onClick={() => navigate('/privacy')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>개인정보처리방침</span> 동의로 간주됩니다.
          </p>
        </div>
      </div>
    );
  }

  const authorTitle = getUserTitle(stats.reviews);

  return (
    <div className="mypage">
      <div className="mypage__profile">
        <div className="mypage__profile-row">
          {/* 1구역: 프사 */}
          <div className="mypage__avatar-zone">
            {ENABLE_PROFILE_PHOTO_UPLOAD && user?.id ? (
              <ProfileAvatarUpload
                userId={user.id}
                userName={user.displayName || user.name}
                photoURL={user.photoURL}
                updateProfile={updateProfile}
              />
            ) : (
              <div className="mypage__avatar">
                {user?.displayName?.charAt(0) || '방'}
              </div>
            )}
          </div>

          {/* 2구역: 회원정보 */}
          <div className="mypage__info-zone">
            <div className="mypage__name-line">
              {authorTitle && (
                <span className="mypage__author-title">
                  <span className="icon">{authorTitle.icon}</span>
                  <span className="text">{authorTitle.title}</span>
                </span>
              )}
              <div className="mypage__name-row">
                <span className="mypage__name">{user?.displayName || user?.name || '방문인'} 님</span>
                <button
                  className="mypage__edit-name-btn"
                  onClick={() => {
                    setNewName(user?.displayName || user?.name || "");
                    setIsEditNameModalOpen(true);
                  }}
                >
                  <Pencil size={14} color="#8B95A1" />
                </button>
              </div>
            </div>
            <p className="mypage__email">{user?.email || (user?.isAnonymous ? '게스트 로그인 중' : '이메일 정보 없음')}</p>
          </div>

          {/* 3구역: 로그아웃 */}
          <div className="mypage__logout-zone">
            <button className="mypage__logout-btn" onClick={logout}>
              로그아웃
            </button>
          </div>
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
            <div className="mypage__stat-icon mypage__stat-icon-heart"><Heart size={20} color="#F04452" fill="#F04452" /></div>
            <div>
              <p className="mypage__stat-label">받은 공감</p>
              <p className="mypage__stat-value">{stats.likes}개</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mypage__menu-section">
        {["활동", "정보", "설정", "지원"].map((cat, catIdx, catArr) => (
          <div key={cat}>
            <h3 className="mypage__menu-heading">{cat === "활동" ? "나의 활동" : cat === "정보" ? "앱 설정 및 정보" : cat === "설정" ? "서비스 설정" : "고객 지원"}</h3>
            {MY_PAGE_MENU.filter(m => m.category === cat).map(item => {
              const IconComp = (Icons as any)[item.icon] || HelpCircle;

              const menuItem = item.label === "알림 설정" ? (
                <MenuItem
                  key={item.label}
                  icon={<IconComp size={20} color="#333D4B" />}
                  title={item.label}
                  onClick={() => setIsNotifModalOpen(true)}
                />
              ) : (
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
                    else if (item.label === "최근 본 방문록") {
                      loadRecentDetails();
                      setActiveModal("recent");
                    }
                    else if (item.label === "공지사항") setActiveModal("announcements");
                    else if (item.label === "자주 묻는 질문") setActiveModal("faq");
                  }}
                  isSpecial={item.label === "제휴 문의"}
                />
              );

              return (
                <div key={item.label}>
                  {item.label === "제휴 문의" && <div className="mypage__spacer" />}
                  {menuItem}
                </div>
              );
            })}
            {catIdx < catArr.length - 1 && <div className="mypage__spacer" />}
          </div>
        ))}
      </div>

      {/* 공통 슬라이드 업 모달 (내가 쓴 방문록, 최근 본 목록, 공지사항 등) */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="mypage__full-modal"
          >
            <div className="mypage__modal-header">
              <button onClick={() => setActiveModal(null)} className="back-btn"><ArrowLeft size={24} color="#333D4B" /></button>
              <h2>
                {activeModal === "reviews" ? "내가 쓴 방문록" :
                  activeModal === "recent" ? "최근 본 방문록" :
                    activeModal === "announcements" ? "공지사항" :
                      activeModal === "inquiry" ? "문의하기" :
                        activeModal === "partnership" ? "제휴 문의" : "자주 묻는 질문"}
              </h2>
            </div>

            <div className="mypage__modal-content">
              {activeModal === "announcements" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...ANNOUNCEMENTS].sort((a, b) => {
                    if (a.isFixed && !b.isFixed) return -1;
                    if (!a.isFixed && b.isFixed) return 1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  }).map(ann => (
                    <div
                      key={ann.id}
                      onClick={() => setSelectedAnnouncement(ann)}
                      className="mypage__announcement-item"
                    >
                      <div className="mypage__announcement-item-meta">
                        <span className={`mypage__announcement-item-category ${ann.category === "점검" ? "maintenance" : "notice"}`}>[{ann.category}]</span>
                        {ann.isFixed && <span className="mypage__announcement-item-fixed">📌 중요</span>}
                        {(new Date().getTime() - new Date(ann.createdAt).getTime() < 86400000) && <div className="mypage__announcement-item-new" />}
                      </div>
                      <div className="mypage__announcement-item-title">{ann.title}</div>
                      <div className="mypage__announcement-item-date">{ann.createdAt.slice(0, 10).replace(/-/g, '.')}</div>
                    </div>
                  ))}
                </div>
              )}
              {activeModal === "partnership" && (
                <div className="mypage__partnership">
                  <div className="mypage__partnership-slogan">
                    더 나은 주거 경험을 만드는<br /><strong>가장 확실한 데이터 파트너</strong>
                  </div>

                  {/* 카드 UI */}
                  <div className="mypage__partnership-card">
                    <div className="card-logo">
                      <div className="logo-wrapper">
                        <img src={logoSvg} alt="" className="logo-icon" />
                        <span className="logo-text">방문Log</span>
                      </div>
                      <span className="badge">Business</span>
                    </div>
                    <div className="card-philosophy">
                      "검증된 실거주 데이터로<br />
                      부동산 시장의 새로운 신뢰를 구축합니다."
                    </div>
                  </div>

                  {/* 가치 제안 섹션 */}
                  <div className="mypage__partnership-values">
                    <div className="value-item">
                      <div className="value-icon">🎯</div>
                      <div className="value-text">
                        <strong>압도적인 타겟 도달</strong>
                        이사 및 계약을 준비하는 유저 밀착 타겟팅
                      </div>
                    </div>
                    <div className="value-item">
                      <div className="value-icon">✅</div>
                      <div className="value-text">
                        <strong>검증된 리얼 보이스</strong>
                        100% 방문 인증 기반의 고품질 실거주 데이터
                      </div>
                    </div>
                    <div className="value-item">
                      <div className="value-icon">🚀</div>
                      <div className="value-text">
                        <strong>동반 성장 파트너십</strong>
                        브랜드 이미지 제고와 사회적 가치 창출
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
                    비즈니스 제휴 문의하기
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
                    <div className="mypage__inquiry-input-wrap">
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
                      <Icons.ChevronDown size={20} color="#8B95A1" className="mypage__inquiry-select-icon" />
                    </div>
                  </div>

                  <div className="mypage__inquiry-field">
                    <label className="mypage__inquiry-label">문의 내용</label>
                    <div className="mypage__inquiry-input-wrap">
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
                          <div className="mypage__card-icon recent" style={{ width: '48px', height: '48px', minWidth: '48px', overflow: 'hidden', padding: 0, borderRadius: '12px', backgroundColor: '#F2F4F6' }}>
                            {r.images && r.images.length > 0 ? (
                              <img src={r.images[0]} alt="thumb" style={{ width: '48px', height: '48px', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F6' }}>
                                <Icons.Image size={24} color="#B0B8C1" />
                              </div>
                            )}
                          </div>
                          <div className="mypage__card-info">
                            <div className="title">
                              {r.location || r.address || "방문록 장소"}
                              {r.addressDetail && (
                                <span style={{ color: '#3182F6', fontWeight: 600, marginLeft: '4px' }}>
                                  {formatAddressDetail(r.addressDetail)}
                                </span>
                              )}
                            </div>
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
                          <div className="mypage__card-icon review" style={{ width: '48px', height: '48px', minWidth: '48px', overflow: 'hidden', padding: 0, borderRadius: '12px', backgroundColor: '#F2F4F6' }}>
                            {r.images && r.images.length > 0 ? (
                              <img src={r.images[0]} alt="thumb" style={{ width: '48px', height: '48px', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F6' }}>
                                <Icons.Image size={24} color="#B0B8C1" />
                              </div>
                            )}
                          </div>
                          <div className="mypage__card-info">
                            <div className="title">
                              {r.location || r.address || "방문록 장소"}
                              {r.addressDetail && (
                                <span style={{ color: '#3182F6', fontWeight: 600, marginLeft: '4px' }}>
                                  {formatAddressDetail(r.addressDetail)}
                                </span>
                              )}
                            </div>
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
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="mypage__full-modal" style={{ padding: '24px' }}>
            <button onClick={() => setSelectedAnnouncement(null)} style={{ border: 'none', background: 'none', marginBottom: '24px' }}><ArrowLeft size={24} color="#333D4B" /></button>
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>{selectedAnnouncement.title}</h1>
            <p style={{ color: '#8B95A1', marginBottom: '24px' }}>{selectedAnnouncement.createdAt.slice(0, 10).replace(/-/g, '.')}</p>
            <div className="mypage__announcement-detail-content">
              <ReactMarkdown>
                {selectedAnnouncement.content
                  .replace(/\\n/g, '\n')
                  .replace(/<br\s*\/?>/gi, '\n')}
              </ReactMarkdown>
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
            />
            <motion.div
              className="mypage__title-modal"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="mypage__title-modal-header">
                <h2>칭호 시스템 안내</h2>
                <button onClick={() => setShowTitleInfo(false)} className="mypage__title-modal-close">
                  <X size={20} color="#4E5968" />
                </button>
              </div>

              <div className="mypage__title-modal-desc-box">
                <p>
                  방문Log를 작성할수록 더 높은 등급의 칭호를 획득할 수 있습니다. <br />
                  꾸준한 활동으로 <strong>방문록의 신</strong>에 도전해보세요!
                </p>
              </div>

              <div className="mypage__title-step-list">
                {titleSteps.map((step) => (
                  <div
                    key={step.title}
                    className={`mypage__title-step-item ${stats.reviews >= step.count ? 'active' : ''}`}
                  >
                    <div className="mypage__title-step-item-left">
                      <span className="mypage__title-step-item-icon">{step.icon}</span>
                      <div className="mypage__title-step-item-info">
                        <span className="mypage__title-step-item-name">{step.title}</span>
                        <span className="mypage__title-step-item-requirement">누적 방문록 {step.count}회 이상</span>
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
            className="mypage__full-modal"
            style={{ backgroundColor: '#F9FAFB' }}
          >
            <div className="mypage__bookmark-header">
              <button onClick={() => setBookmarkModalOpen(false)} className="back-btn">
                <ArrowLeft size={24} color="#333D4B" />
              </button>
              <h2>찜한 리스트</h2>
            </div>

            <div style={{ padding: '16px' }}>
              {bookmarks.length === 0 ? (
                <div className="mypage__bookmark-empty">
                  <div className="icon">📍</div>
                  <p>찜한 건물이 아직 없어요.<br />지도를 탐색하며 마음에 드는 곳을 찜해보세요!</p>
                </div>
              ) : (
                bookmarks.map(bm => (
                  <div
                    key={bm.id}
                    onClick={() => {
                      setBookmarkModalOpen(false);
                      navigate(`/?lat=${bm.lat}&lng=${bm.lng}&zoom=19&address=${encodeURIComponent(bm.address)}`);
                    }}
                    className="mypage__bookmark-item"
                  >
                    <div className="mypage__bookmark-item-left">
                      <div className="mypage__bookmark-item-icon">
                        <MapPin size={24} color="#3182F6" />
                      </div>
                      <div className="mypage__bookmark-item-info">
                        <div className="mypage__bookmark-item-name">
                          {bm.address.split(' ').slice(-2).join(' ')}
                        </div>
                        <div className="mypage__bookmark-item-address">{bm.address}</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBookmarkDeleteTarget({ id: bm.id, address: bm.address });
                      }}
                      className="mypage__bookmark-item-delete"
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

      {/* 이름 수정 모달 */}
      <AnimatePresence>
        {isEditNameModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsEditNameModalOpen(false)}
            className="mypage__confirm-overlay"
          >
            <motion.div
              className="mypage__confirm-modal"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              style={{ padding: '32px 24px' }}
            >
              <h3 className="mypage__confirm-title" style={{ marginBottom: '8px' }}>사용자 이름 수정</h3>
              <p className="mypage__confirm-desc" style={{ marginBottom: '24px' }}>새로운 이름을 입력해주세요.</p>

              <input
                type="text"
                className="mypage__inquiry-input"
                style={{ marginBottom: '24px', textAlign: 'center', fontSize: '18px', fontWeight: 600 }}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="이름 입력"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim() && newName !== user?.name) {
                    updateProfile({ name: newName.trim() });
                    setIsEditNameModalOpen(false);
                  }
                }}
              />

              <div className="mypage__confirm-actions">
                <button
                  className="mypage__confirm-cancel"
                  onClick={() => setIsEditNameModalOpen(false)}
                >
                  취소
                </button>
                <button
                  className="mypage__confirm-ok"
                  disabled={!newName.trim() || newName === user?.name}
                  onClick={async () => {
                    if (newName.trim()) {
                      await updateProfile({ name: newName.trim() });
                      setIsEditNameModalOpen(false);
                    }
                  }}
                >
                  저장
                </button>
              </div>
            </motion.div>
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

      {/* 찜한 리스트 삭제 확인 모달 */}
      <AnimatePresence>
        {bookmarkDeleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBookmarkDeleteTarget(null)}
            className="mypage__confirm-overlay"
            style={{ zIndex: 3000 }} // 찜 리스트 모달(2000)보다 위에 표시
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="mypage__confirm-modal"
            >
              <div className="mypage__confirm-icon">🔖</div>
              <h3 className="mypage__confirm-title">찜한 곳 삭제</h3>
              <p className="mypage__confirm-desc" style={{ padding: '0 20px', wordBreak: 'keep-all' }}>
                '{bookmarkDeleteTarget.address.split(' ').slice(-2).join(' ')}'을(를)<br />찜한 리스트에서 삭제하시겠습니까?
              </p>
              <div className="mypage__confirm-actions">
                <button
                  className="mypage__confirm-cancel"
                  onClick={() => setBookmarkDeleteTarget(null)}
                >
                  취소
                </button>
                <button
                  className="mypage__confirm-ok"
                  onClick={async () => {
                    try {
                      await deleteDoc(doc(db, "bookmarks", bookmarkDeleteTarget.id));
                      setBookmarkDeleteTarget(null);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                >
                  확인
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 알림 상세 설정 모달 (TDS 바텀 시트) */}
      <AnimatePresence>
        {isNotifModalOpen && (
          <>
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotifModalOpen(false)}
            />
            <motion.div
              className="mypage__notif-modal"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="mypage__notif-modal-header">
                <h2>알림 설정</h2>
                <button
                  onClick={() => setIsNotifModalOpen(false)}
                  className="mypage__title-modal-close"
                >
                  <X size={20} color="#4E5968" />
                </button>
              </div>

              <div className="mypage__notif-item-list">
                {/* 1. 찜한 매물 알림 */}
                <div className="mypage__notif-item">
                  <div className="mypage__notif-item-info">
                    <span className="mypage__notif-item-title">찜한 매물 새 방문록</span>
                    <span className="mypage__notif-item-desc">관심 있거나 살고 싶은 건물의 소식을 알려줘요</span>
                  </div>
                  <ToggleButton
                    initialValue={notiSettings.bookmarks}
                    onChange={() => handleToggleNotif('bookmarks')}
                  />
                </div>

                {/* 2. 소셜 알림 */}
                <div className="mypage__notif-item">
                  <div className="mypage__notif-item-info">
                    <span className="mypage__notif-item-title">좋아요 및 댓글</span>
                    <span className="mypage__notif-item-desc">내 방문록에 대한 다른 사람들의 반응을 알려줘요</span>
                  </div>
                  <ToggleButton
                    initialValue={notiSettings.reactions}
                    onChange={() => handleToggleNotif('reactions')}
                  />
                </div>

                {/* 3. 서비스 공지 */}
                <div className="mypage__notif-item">
                  <div className="mypage__notif-item-info">
                    <span className="mypage__notif-item-title">서비스 공지 및 혜택</span>
                    <span className="mypage__notif-item-desc">중요한 서비스 공지와 혜택 정보를 놓치지 않게 알려줘요</span>
                  </div>
                  <ToggleButton
                    initialValue={notiSettings.notices}
                    onChange={() => handleToggleNotif('notices')}
                  />
                </div>
              </div>

              <div className="mypage__notif-footer">
                <p>
                  * 알림은 서비스 내부 알림 탭에서 확인하실 수 있습니다.<br />
                  * 야간 시간대(오후 9시 ~ 오전 8시)에는 마케팅 관련 알림이 제한될 수 있습니다.
                </p>
              </div>
            </motion.div>
          </>
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
    >
      <div className="mypage__menu-item-left">
        {icon}
        <div className="mypage__menu-item-info">
          <span className="mypage__menu-item-label">{title}</span>
          {isSpecial && <span className="mypage__menu-item-sublabel">방문Log와 함께 세입자의 세상을 바꿀 파트너를 찾습니다 🤝</span>}
        </div>
        {badge !== undefined && (
          <span className="mypage__menu-item-badge">
            {badge}
          </span>
        )}
      </div>
      <ChevronRight size={20} className="mypage__menu-item-chevron" />
    </button>
  );
}



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
    >
      <motion.div
        className="toggle-btn__thumb"
        animate={{ x: isOn ? 19 : 3 }}
        initial={false}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
