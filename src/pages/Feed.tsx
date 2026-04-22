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
  Map as MapIcon,
  X,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  PlayCircle
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
import { motion, AnimatePresence } from "framer-motion";

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
  images?: string[];
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
  const { hasWatchedAd, incrementReadCount, watchAd, isAdShowing } = useAccessControl();
  const { user } = useAuth();

  // [일시적] 잘못된 이미지(blob:) 데이터 자동 정리 로직
  useEffect(() => {
    const cleanup = async () => {
      const isCleaned = localStorage.getItem('data_cleaned_blob_v4');
      if (isCleaned) return;

      try {
        const querySnapshot = await getDocs(collection(db, "reviews"));
        let count = 0;
        for (const d of querySnapshot.docs) {
          const data = d.data();
          const images = data.images || [];
          
          // 더 강력한 체크: blob 주소거나, localhost 주소인 경우 (타 디바이스에서 보이지 않음)
          const isBroken = images.some((url: string) => 
            typeof url === 'string' && (url.startsWith("blob:") || url.includes("localhost:3000"))
          );

          if (isBroken) {
            console.log(`🗑️ Cleaning up truly broken post: ${d.id}`);
            await deleteDoc(doc(db, "reviews", d.id));
            count++;
          }
        }
        localStorage.setItem('data_cleaned_blob_v1', 'true');
        console.log(`✅ Cleanup complete. ${count} posts removed.`);
      } catch (e) {
        console.error("Cleanup error:", e);
      }
    };
    cleanup();
  }, []);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // [추가] 태그 탭 관련 상태
  const [selectedTag, setSelectedTag] = useState<string>("전체");
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const CATEGORY_CHIPS = ["전체", "층간소음", "수압체크", "햇살맛집", "역세권", "관리비저렴", "치안좋음", "채광맛집", "외부소음", "외풍심함", "관리비폭탄", "뷰맛집"];
  
  // 실제 DB 내 데이터를 분석하여 작성 횟수 기준 상위 10개 태그 및 신입 태그 판독
  const { trendingTags, newTags } = useMemo(() => {
    const counts: Record<string, number> = {};
    const tagLatestTime: Record<string, number> = {};
    const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000); // 최근 3시간 내 기준

    posts.forEach(p => {
      p.tags?.forEach(t => {
        const tag = t.startsWith("#") ? t : `#${t}`;
        counts[tag] = (counts[tag] || 0) + 1;
        
        // 게시물 날짜(date)를 타임스탬프로 변환하여 태그별 최신 사용 시각 기록
        const postTime = new Date(p.date).getTime();
        if (!tagLatestTime[tag] || postTime > tagLatestTime[tag]) {
          tagLatestTime[tag] = postTime;
        }
      });
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
    const newlyEmerging = new Set(Object.keys(tagLatestTime).filter(tag => tagLatestTime[tag] > threeHoursAgo));

    return { 
      trendingTags: sorted.length > 0 ? sorted : ["#방문록", "#꿀팁", "#자취방구하기", "#직방", "#다방", "#부동산", "#이사준비", "#인테리어", "#집꾸미기", "#원룸"],
      newTags: newlyEmerging 
    };
  }, [posts]);

  // 실시간 랭킹 롤링 및 펼침 상태 관리
  const [rollingIndex, setRollingIndex] = useState(0);
  const [isRankingExpanded, setIsRankingExpanded] = useState(false);

  useEffect(() => {
    if (isRankingExpanded) return;
    const interval = setInterval(() => {
      setRollingIndex(prev => (prev + 1) % trendingTags.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [trendingTags.length, isRankingExpanded]);

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

  const [isCleansingModalOpen, setIsCleansingModalOpen] = useState(false);

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
          images: data.images || [],
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
      let filtered = list.filter(p => p.image);
      
      if (tagSearchQuery.trim()) {
        filtered = filtered.filter(p => 
          p.tags.some(t => t.toLowerCase().includes(tagSearchQuery.toLowerCase())) ||
          p.location.toLowerCase().includes(tagSearchQuery.toLowerCase())
        );
      } else if (selectedTag !== "전체") {
        filtered = filtered.filter(p => p.tags.some(t => t.includes(selectedTag)));
      }
      return filtered;
    } else {
      if (userLocation) {
        const nearbyList = list.filter(p => {
          if (p.lat && p.lng) {
            const dist = calculateDistance(userLocation.lat, userLocation.lng, p.lat, p.lng);
            return dist <= 200;
          }
          return false;
        });

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
  }, [activeTab, posts, addressParam, userLocation, localSortType, tagSearchQuery, selectedTag]);

  const handlePostClick = async (postId: string, index: number) => {
    // 1. 혜택 권한(리뷰 작성자)이 있거나, 첫 번째 게시물인 경우 바로 열기
    if (user?.canViewAll || index === 0) {
      incrementReadCount();
      setSelectedReviewId(postId);
      setIsDetailOpen(true);
      return;
    }

    // 2. 그 외 조건(두 번째 게시물부터)에서는 "방문록 작성하고 전체보기" 유도
    const commonMsg = "모든 방문록을 보시려면 현재 거주 중인 집이나 전에 살던 집의 방문록을 남겨주세요. 모든 방문록이 즉시 열립니다! 🏠";

    if (!user) {
      showConfirm(
        "방문록 작성하고 전체보기 ✨",
        () => navigate('/mypage'),
        commonMsg,
        "📍",
        "확인",
        "취소"
      );
      return;
    }

    showConfirm(
      "방문록 작성하고 전체보기 ✨",
      () => navigate('/'),
      commonMsg,
      "📍",
      "확인",
      "취소"
    );
  };

  const handleCloseDetail = useCallback(() => setIsDetailOpen(false), []);

  const handleDeletePost = useCallback(async (postId: string) => {
    console.log("🗑️ [Feed Delete] 삭제를 요청했습니다:", postId);
    showConfirm(
      "방문록 삭제",
      async () => {
        try {
          console.log("🗑️ [Feed Delete] 삭제를 확정했습니다:", postId);
          const success = await deleteReview(postId);
          if (success) {
            setIsDetailOpen(false);
            setSelectedReviewId(null);
            setPosts(prev => prev.filter(p => p.id !== postId));
            showAlert("삭제 완료", "방문록이 삭제되었습니다.", "🗑️");
          } else {
            showAlert("삭제 실패", "삭제 중 오류가 발생했습니다.", "⚠️");
          }
        } catch (e) {
          console.error(e);
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
    console.log("✏️ [Feed Edit] 수정을 위해 홈으로 이동합니다:", id);
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
              () => navigate('/mypage'),
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
                  <span className="feed__tab-text">
                    {tab === "hot" ? "인기 방문록" : tab === "local" ? "내 주변 방문록" : "#태그"}
                  </span>
                  {activeTab === tab && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="feed__tab-underline"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* 리뷰 클렌징 시스템 배너 */}
            <div className="feed__cleansing-banner" onClick={() => setIsCleansingModalOpen(true)}>
              <div className="banner-left">
                <div className="ai-icon">
                  <div className="dot"></div>
                </div>
                <span>리뷰 클렌징 시스템 <strong>작동 중</strong>입니다</span>
              </div>
              <ChevronRight size={16} color="#8B95A1" />
            </div>

            {activeTab === 'tag' && (
              <div className="feed__tag-header">
                <div className="feed__tag-search-container">
                  <div className={`feed__tag-search-bar ${isSearchActive ? 'active' : ''}`}>
                    <Search size={18} color={isSearchActive ? "#3182F6" : "#8B95A1"} />
                    <input 
                      type="text" 
                      placeholder="태그나 지역을 검색해보세요" 
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      onFocus={() => setIsSearchActive(true)}
                      onBlur={() => !tagSearchQuery && setIsSearchActive(false)}
                    />
                    {tagSearchQuery && (
                      <button className="clear-btn" onClick={() => setTagSearchQuery("")}>
                        <X size={16} color="#B0B8C1" />
                      </button>
                    )}
                  </div>
                </div>

                {!tagSearchQuery && (
                  <div className={`feed__tag-ranking-container ${isRankingExpanded ? 'expanded' : ''}`}>
                    <div className="feed__tag-ranking" onClick={() => setIsRankingExpanded(!isRankingExpanded)}>
                      <span className="label">실시간 핫태그</span>
                      {!isRankingExpanded ? (
                        <div className="rolling-box">
                          <ul 
                            className="rolling-list" 
                            style={{ 
                              transform: `translateY(-${rollingIndex * 20}px)`,
                              transition: 'transform 0.5s cubic-bezier(0, 0, 0.2, 1)'
                            }}
                          >
                            {trendingTags.map((tag, idx) => (
                              <li key={tag} className="rolling-item">
                                <span className="num">{idx + 1}</span>
                                <span className="tag-name">{tag}</span>
                                {newTags.has(tag) ? <span className="badge new">NEW</span> : <span className="badge steady">-</span>}
                              </li>
                            ))}
                          </ul>
                          <ChevronDown size={14} color="#8B95A1" />
                        </div>
                      ) : (
                        <button className="close-btn"><ChevronUp size={18} color="#191F28" /></button>
                      )}
                    </div>
                    
                    {isRankingExpanded && (
                      <div className="ranking-list">
                        <div className="ranking-date">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}</div>
                        <div className="divider"></div>
                        <div className="list-items">
                          {trendingTags.map((tag, idx) => (
                            <div 
                              key={tag} 
                              className="rank-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTagSearchQuery(tag.replace('#', ''));
                                setIsRankingExpanded(false);
                              }}
                            >
                              <span className="rank-num">{idx + 1}</span>
                              <span className="rank-name">{tag}</span>
                              {newTags.has(tag) && <span className="list-badge">NEW</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
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
                    className={`feed__sort-btn${localSortType === sort.id ? " active" : ""}`}
                    style={{ position: 'relative' }}
                  >
                    <span className="btn-inner">{sort.label}</span>
                    {localSortType === sort.id && (
                      <motion.div
                        layoutId="feedSortPill"
                        className="active-pill"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
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
              filteredData.map((post, index) => (
                <div 
                  key={post.id} 
                  className={`tag-grid-item ${index > 0 && !user?.canViewAll && !hasWatchedAd ? 'blurred' : ''}`} 
                  onClick={() => handlePostClick(post.id, index)}
                >
                  <div className="image-container">
                    {(post.image.includes('.mp4?') || post.image.includes('.webm?') || post.image.includes('.mov?') || post.image.includes('media_')) ? (
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <video src={post.image} muted autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.8 }}>
                          <PlayCircle size={24} color="#fff" fill="rgba(0,0,0,0.2)" />
                        </div>
                      </div>
                    ) : (
                      <img src={post.image} alt="post" />
                    )}
                    {post.images && post.images.length > 1 && (
                      <div className="image-count-badge">
                        +{post.images.length - 1}
                      </div>
                    )}
                  </div>
                  <div className="item-overlay">
                    <div className="info-box">
                      <div className="location-text">
                        <MapPin size={10} color="white" />
                        <span>
                          {(() => {
                            const parts = post.location.split(' ');
                            if (parts.length >= 3) {
                              return `${parts[1]} ${parts[2]}`; // 예: "서울 광진구 자양번영로 6" -> "광진구 자양번영로"
                            } else if (parts.length === 2) {
                              return parts[1];
                            }
                            return post.location; // 예: "프리즈마111"
                          })()}
                        </span>
                      </div>
                      <div className="stat">
                        <Heart size={12} fill="white" color="white" />
                        <span>{post.likes}</span>
                      </div>
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
          <div className="loading-state">
            <div className="spinner"></div>
            <p>방문록을 불러오는 중...</p>
          </div>
        ) : filteredData.length > 0 ? (
          filteredData.map((post, index) => (
            <div 
              key={post.id} 
              className={`feed__card ${index > 0 && !user?.canViewAll && !hasWatchedAd ? 'blurred' : ''}`} 
              onClick={() => handlePostClick(post.id, index)}
            >
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
                    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
                      {(post.image.includes('.mp4?') || post.image.includes('.webm?') || post.image.includes('.mov?') || post.image.includes('media_')) ? (
                        <>
                          <video src={post.image} muted autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.8 }}>
                            <PlayCircle size={32} color="#fff" fill="rgba(0,0,0,0.2)" />
                          </div>
                        </>
                      ) : (
                        <img src={post.image} alt="thumb" />
                      )}
                      {post.images && post.images.length > 1 && (
                        <div className="image-count-badge">
                          +{post.images.length - 1}
                        </div>
                      )}
                    </div>
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
            <div className="ad-icon">🏢</div>
            <div className="ad-timer-container">
              <div className="ad-progress-bar"></div>
            </div>
            <p className="ad-title">깨끗한 방 찾을 땐? 방문Log</p>
            <p className="ad-desc">광고 시청 중... (2초)</p>
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

      {/* 리뷰 클렌징 시스템 안내 모달 */}
      <AnimatePresence>
        {isCleansingModalOpen && (
          <div className="tds-modal-overlay tds-modal-overlay--dark" onClick={() => setIsCleansingModalOpen(false)}>
            <motion.div 
              className="cleansing-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="cleansing-header">
                <div className="ai-bot-icon">
                  <div className="eyes"></div>
                  <div className="blush"></div>
                  <div className="signal"></div>
                </div>
                <h2>리뷰 클렌징 시스템 <strong>작동중입니다</strong></h2>
              </div>
              <div className="cleansing-body">
                <p>방문Log 기준에 따라 높은 수준의 신뢰도가 확인된 리뷰만 노출되도록 <strong>AI 클렌징 시스템</strong>이 작동 중입니다.</p>
                <p>허위 방문인증, 광고성 리뷰 작성, 부적절한 미디어(사진/영상) 첨부 등의 이상 패턴이 탐지되면 해당 리뷰는 별도의 통지 없이 즉시 미노출되며, 서비스 이용에 제한을 받을 수 있습니다.</p>
              </div>
              <div className="cleansing-footer">
                <button onClick={() => setIsCleansingModalOpen(false)}>확인</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
