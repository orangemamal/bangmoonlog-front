import {
  Heart,
  Eye,
  MapPin,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  Home as HomeIcon,
  Search,
  Map as MapIcon
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { deleteReview } from "../services/reviewService";
import { db } from "../services/firebase";
import { collection, query, orderBy, where, onSnapshot, QuerySnapshot, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { useAccessControl } from "../hooks/useAccessControl";
import { useAuth } from "../hooks/useAuth";
import { ReviewDetail } from "../components/ReviewDetail";
import { formatAddressDetail } from "../utils/addressUtils";
import { calculateDistance } from "../utils/geoUtils";
import { RefreshCw } from "lucide-react";

interface Post {
  id: string;
  type: "hot" | "local";
  tags: string[];
  tagBg: string;
  tagColor: string;
  isVerified?: boolean;
  date: string;
  location: string;
  addressDetail?: string;
  content: string;
  image: string;
  likes: number;
  views: number;
  ratings?: { light: number; noise: number; water: number };
  author: string;
  authorId: string;
  experienceType?: string;
  lat?: number;
  lng?: number;
}

export function Feed() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const addressParam = searchParams.get("address");
  const [activeTab, setActiveTab] = useState<"hot" | "local" | "tag">("hot");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { canRead, incrementReadCount, watchAd, isAdShowing } = useAccessControl();
  const { login, user } = useAuth();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // [추가] 태그 탭 관련 상태
  const [selectedTag, setSelectedTag] = useState<string>("전체");
  const CATEGORY_CHIPS = ["전체", "층간소음", "수압체크", "햇살맛집", "역세권", "관리비저렴", "치안좋음", "채광맛집", "외부소음", "외풍심함", "관리비폭탄", "뷰맛집"];

  // [추가] GPS 위치 및 상태 관리
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'success' | 'error' | 'denied'>('loading');

  // [추가] 내 주변 탭 세부 정렬 필터 상태
  const [localSortType, setLocalSortType] = useState<'distance' | 'latest' | 'popular'>('distance');

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    onConfirm?: () => void;
    desc?: string;
    icon?: string;
    cancelText?: string;
    confirmText?: string;
    onCancel?: () => void;
  }>({ isOpen: false, title: "" });

  const showAlert = useCallback((title: string, desc?: string, icon: string = "✅") => {
    setModalConfig({ isOpen: true, title, desc, icon, confirmText: "확인" });
  }, []);

  const showConfirm = useCallback((title: string, onConfirm: () => void, desc?: string, icon?: string, confirmText?: string, cancelText?: string) => {
    setModalConfig({ isOpen: true, title, onConfirm, desc, icon, confirmText, cancelText });
  }, []);

  const fetchUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }

    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('success');
      },
      (err) => {
        if (err.code === 1) setGpsStatus('denied');
        else setGpsStatus('error');
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  useEffect(() => {
    fetchUserLocation();
  }, [fetchUserLocation]);

  useEffect(() => {
    setIsLoading(true);
    let q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));

    if (addressParam) {
      q = query(collection(db, "reviews"), where("address", "==", addressParam), orderBy("createdAt", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      const list: Post[] = [];
      snap.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          type: data.likes > 50 ? "hot" : "local",
          tags: data.tags || [],
          tagBg: data.likes > 50 ? "#FFF0F0" : "#E8F3FF",
          tagColor: data.likes > 50 ? "#E84040" : "#3182F6",
          isVerified: !!data.isVerified,
          date: data.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR').format(data.createdAt.toDate()) : "2026.04.09",
          location: data.address,
          addressDetail: data.addressDetail,
          content: data.content,
          image: data.images?.[0] || "",
          likes: data.likes || 0,
          views: data.views || 0,
          ratings: data.ratings,
          author: data.author || "익명 방문자",
          authorId: data.authorId || "",
          experienceType: data.experienceType || "단순 방문",
          lat: data.lat,
          lng: data.lng
        });
      });
      setPosts(list);
      setIsLoading(false);
    }, (error: Error) => {
      console.error("Feed snapshot error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [addressParam, activeTab]);

  const filteredData = useMemo(() => {
    let list = [...posts];

    if (addressParam) {
      list = list.filter(p => p.location === decodeURIComponent(addressParam));
    }

    if (activeTab === "hot") {
      return list.sort((a, b) => (b.likes * 1000 + b.views) - (a.likes * 1000 + a.views));
    } else if (activeTab === "tag") {
      if (selectedTag === "전체") {
        return list.filter(p => p.image); // 사진이 있는 것만 우선 노출
      }
      return list.filter(p => p.tags.some(t => t.includes(selectedTag)) && p.image);
    } else {
      // [개선] 내 주변 탭일 경우 200m 필터링 적용
      if (userLocation) {
        const nearbyList = list.filter(p => {
          if (p.lat && p.lng) {
            const dist = calculateDistance(userLocation.lat, userLocation.lng, p.lat, p.lng);
            return dist <= 200; // 200m 이내
          }
          return false;
        });

        // 세부 정렬 적용
        if (localSortType === 'distance') {
          return nearbyList.sort((a, b) => {
            const distA = a.lat && a.lng ? calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) : 999999;
            const distB = b.lat && b.lng ? calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng) : 999999;
            return distA - distB;
          });
        } else if (localSortType === 'latest') {
          return nearbyList.sort((a, b) => {
            const timeA = (a as any).createdAt?.toMillis?.() || 0;
            const timeB = (b as any).createdAt?.toMillis?.() || 0;
            return timeB - timeA;
          });
        } else if (localSortType === 'popular') {
          return nearbyList.sort((a, b) => {
            const scoreA = (a.likes || 0) * 10 + (a.views || 0);
            const scoreB = (b.likes || 0) * 10 + (b.views || 0);
            return scoreB - scoreA;
          });
        }
        return nearbyList;
      }
      return list;
    }
  }, [activeTab, posts, addressParam, userLocation, localSortType]);

  const handlePostClick = async (postId: string) => {
    if (!canRead) {
      showConfirm(
        "광고 시청 후 전체 보기",
        async () => {
          await watchAd();
          incrementReadCount();
          setSelectedReviewId(postId);
          setIsDetailOpen(true);
        },
        "더 많은 방문록을 읽으려면 간단한 광고 시청이 필요합니다. 보시겠습니까?",
        "📺",
        "보러가기",
        "다음에"
      );
      return;
    }
    incrementReadCount();
    setSelectedReviewId(postId);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = useCallback(() => setIsDetailOpen(false), []);

  const handleDeletePost = useCallback(async (postId: string) => {
    showConfirm(
      "방문록 삭제",
      async () => {
        const success = await deleteReview(postId);
        if (success) {
          setIsDetailOpen(false);
          setPosts(prev => prev.filter(p => p.id !== postId));
          showAlert("삭제 완료", "방문록이 삭제되었습니다.", "🗑️");
        } else {
          showAlert("삭제 실패", "삭제 중 오류가 발생했습니다.", "⚠️");
        }
      },
      "정말 이 방문록을 삭제하시겠습니까? (영구 삭제)",
      "🗑️"
    );
  }, [showConfirm, showAlert]);

  const handleDeletePostDetail = useCallback((id: string) => {
    handleDeletePost(id);
  }, [handleDeletePost]);

  useEffect(() => {
    setActiveMenuId(null);
  }, [activeTab]);

  const handleEditPost = (id: string) => {
    navigate(`/?edit=${id}`);
  };

  return (
    <div className={`feed ${selectedReviewId ? "feed--detail-active" : ""}`}>
      {isDetailOpen && selectedReviewId && (
        <ReviewDetail
          reviewId={selectedReviewId}
          onClose={handleCloseDetail}
          onEdit={() => handleEditPost(selectedReviewId)}
          onDelete={() => handleDeletePostDetail(selectedReviewId)}
          onLoginRequired={() => {
            showConfirm(
              "로그인 필요",
              () => login(),
              "공감 및 댓글 기능은 로그인 후 이용 가능합니다.",
              "🔒"
            );
          }}
        />
      )}

      <div className="feed__header">
        {addressParam ? (
          <div className="feed__address-header">
            <button className="back-btn" onClick={() => navigate("/")}>
              <ArrowLeft size={24} />
            </button>
            <div className="info">
              <h1>이 공간의 방문록</h1>
              <p>{decodeURIComponent(addressParam)}</p>
            </div>
          </div>
        ) : (
          <>
            <h1>방문록</h1>
            <div className="feed__tabs">
              {(["hot", "local", "tag"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`feed__tab${activeTab === tab ? " feed__tab--active" : ""}`}
                >
                  {tab === "hot" ? "인기 방문록" : tab === "local" ? "내 주변 방문록" : "#태그"}
                </button>
              ))}
            </div>

            {/* [추가] 태그 탭 전용 카테고리 칩 바 */}
            {activeTab === 'tag' && (
              <div className="feed__tag-scroll-bar">
                {CATEGORY_CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => setSelectedTag(chip)}
                    className={`feed__tag-chip${selectedTag === chip ? " feed__tag-chip--active" : ""}`}
                  >
                    {chip === "전체" ? "전체" : `#${chip}`}
                  </button>
                ))}
              </div>
            )}
            
            {/* [추가] 내 주변 탭 전용 소분류 정렬 필터 바 */}
            {activeTab === 'local' && (
              <div className="feed__sort-bar">
                {[
                  { id: 'distance', label: '거리순' },
                  { id: 'latest', label: '최신순' },
                  { id: 'popular', label: '인기순' }
                ].map(sort => (
                  <button
                    key={sort.id}
                    onClick={() => setLocalSortType(sort.id as any)}
                    className={`feed__sort-btn${localSortType === sort.id ? " feed__sort-btn--active" : ""}`}
                  >
                    {sort.label}
                    {localSortType === sort.id && (
                      <div className="feed__sort-indicator" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="feed__list">
        {activeTab === 'tag' ? (
          <div className="feed__tag-grid">
            {isLoading ? (
              <div className="loading-state">태그 피드를 불러오는 중...</div>
            ) : filteredData.length > 0 ? (
              filteredData.map(post => (
                <div key={post.id} className="tag-grid-item" onClick={() => handlePostClick(post.id)}>
                  <img src={post.image} alt="post" />
                  <div className="item-overlay">
                    <div className="stat">
                      <Heart size={14} fill="white" color="white" />
                      <span>{post.likes}</span>
                    </div>
                    {post.isVerified && (
                      <div className="verify-icon">
                        <CheckCircle2 size={12} color="white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state empty-state--grid">
                <p>해당 태그의 사진이 아직 없습니다.</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* [추가] GPS 오류/방역 방어용 UI 카드 섹션 */}
            {activeTab === 'local' && (gpsStatus !== 'success' || (gpsStatus === 'success' && filteredData.length === 0)) && (
              <div className="feed__defense-card-wrapper">
            <div className="feed__defense-card">
              <div className="feed__defense-card-info">
                <h3 className="feed__defense-card-title">
                  {gpsStatus === 'loading' ? '위치를 확인하고 있어요' : 
                   gpsStatus === 'denied' ? '위치 권한이 필요해요' :
                   (gpsStatus === 'success' && filteredData.length === 0) ? '주변 200m에 글이 없어요' : '위치를 불러올 수 없어요'}
                </h3>
                <p className="feed__defense-card-desc">
                  <span className="icon">📍</span>
                  {gpsStatus === 'denied' ? '장소와 멀리 떨어져 있으면 인증 마크를 달 수 없어요.' : 
                   (gpsStatus === 'success' && filteredData.length === 0) ? '반경을 조금 더 넓혀보거나 다른 곳으로 이동해 보세요.' : '정확한 정보를 위해 위치 서비스가 필요해요.'}
                </p>
              </div>
              <button 
                onClick={fetchUserLocation}
                className="feed__defense-card-btn"
              >
                <RefreshCw size={20} color="#4E5968" className={gpsStatus === 'loading' ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="loading-state">방문록을 불러오는 중...</div>
        ) : filteredData.length > 0 ? (
          filteredData.map(post => (
            <div key={post.id} className="feed__card" onClick={() => handlePostClick(post.id)}>
              <div className="feed__card-header">
                <div className="feed__card-meta">
                  {post.experienceType && (
                    <div className={`experience-badge ${post.experienceType === '거주 경험' ? 'resident' : post.experienceType === '매물 투어' ? 'visit' : ''}`}>
                      <span className="icon">
                        {post.experienceType === '거주 경험' ? <HomeIcon size={12} /> : post.experienceType === '매물 투어' ? <Search size={12} /> : <MapPin size={12} />}
                      </span>
                      <span>{post.experienceType}</span>
                    </div>
                  )}
                  {post.isVerified && (
                    <div className="card-verify-badge">
                      <CheckCircle2 size={12} strokeWidth={3} />
                      <span>방문자 인증</span>
                    </div>
                  )}
                </div>
                {activeTab !== 'hot' && user && user.id === post.authorId && (
                  <div className="feed__card-more-container">
                    <button
                      className="feed__card-more-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === post.id ? null : post.id);
                      }}
                    >
                      <MoreHorizontal size={20} color="#B0B8C1" />
                    </button>
                    {activeMenuId === post.id && (
                      <div className="card-dropdown-menu" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { handleEditPost(post.id); setActiveMenuId(null); }}>
                          <Pencil size={14} />
                          <span>수정하기</span>
                        </button>
                        <button className="delete" onClick={() => { handleDeletePost(post.id); setActiveMenuId(null); }}>
                          <Trash2 size={14} />
                          <span>삭제하기</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="feed__card-location">
                <MapIcon size={14} color="#3182F6" />
                <span>{post.location}</span>
                {post.addressDetail && (
                  <span className="address-detail">
                    {formatAddressDetail(post.addressDetail)}
                  </span>
                )}
              </div>

              <div className="feed__card-body">
                <p className="feed__card-content">{post.content}</p>
                <div className="feed__card-thumbnail">
                  {post.image ? (
                    <img src={post.image} alt="thumb" />
                  ) : (
                    <div className="no-image-thumb">이미지 없음</div>
                  )}
                </div>
              </div>
              {post.tags && post.tags.length > 0 && (
                <div className="card-bottom-tags">
                  {post.tags.slice(0, 3).map((t, i) => (
                    <span key={i} className="tag-text">#{t.replace(/^#/, '')}</span>
                  ))}
                  {post.tags.length > 3 && (
                    <span className="tag-more">+{post.tags.length - 3}</span>
                  )}
                </div>
              )}

              <div className="feed__card-footer">
                <div className="feed__card-stat">
                  <Heart size={16} fill="none" color="#B0B8C1" />
                  <span>{post.likes}</span>
                </div>
                <div className="feed__card-stat">
                  <Eye size={16} color="#B0B8C1" />
                  <span>{post.views}</span>
                </div>
                <span className="feed__card-date">{post.date}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>아직 작성된 방문록이 없습니다.</p>
            <p>첫 번째 방문록을 작성해보세요!</p>
          </div>
        )}
      </>
    )}
  </div>

      {isAdShowing && (
        <div className="ad-overlay">
          <div className="ad-content">
            <div className="ad-timer">광고 시청 중... (2초)</div>
            <div className="ad-placeholder">🏢 깨끗한 방 찾을 땐? 방문Log</div>
          </div>
        </div>
      )}

      {modalConfig.isOpen && (
        <div className="tds-modal-overlay">
          <div className="tds-modal-content">
            <div className="toss-face-icon">{modalConfig.icon}</div>
            <h2 className="tds-modal-title">{modalConfig.title}</h2>
            {modalConfig.desc && <p className="tds-modal-desc">{modalConfig.desc}</p>}
            <div className="tds-modal-footer">
              <button
                className="tds-btn-secondary"
                onClick={() => {
                  setModalConfig(prev => ({ ...prev, isOpen: false }));
                  if (modalConfig.onCancel) modalConfig.onCancel();
                }}
              >
                {modalConfig.cancelText || "닫기"}
              </button>
              <button
                className="tds-btn-primary"
                onClick={() => {
                  setModalConfig(prev => ({ ...prev, isOpen: false }));
                  if (modalConfig.onConfirm) modalConfig.onConfirm();
                }}
              >
                {modalConfig.confirmText || "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
