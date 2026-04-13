import { 
  Heart, 
  Eye, 
  MapPin, 
  ArrowLeft, 
  MoreHorizontal, 
  Pencil, 
  Trash2,
  CheckCircle2
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { deleteReview } from "../services/reviewService";
import { db } from "../services/firebase";
import { collection, query, orderBy, where, onSnapshot, QuerySnapshot, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { useAccessControl } from "../hooks/useAccessControl";
import { useAuth } from "../hooks/useAuth";
import { ReviewDetail } from "../components/ReviewDetail";

interface Post {
  id: string;
  type: "hot" | "local";
  tags: string[];
  tagBg: string;
  tagColor: string;
  isVerified?: boolean;
  date: string;
  location: string;
  content: string;
  image: string;
  likes: number;
  views: number;
  ratings?: { light: number; noise: number; water: number };
  author: string;
  authorId: string;
}

export function Feed() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const addressParam = searchParams.get("address");
  const [activeTab, setActiveTab] = useState<"hot" | "local">("hot");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { canRead, incrementReadCount, watchAd, isAdShowing } = useAccessControl();
  const { login, user } = useAuth();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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
          content: data.content,
          image: data.images?.[0] || "",
          likes: data.likes || 0,
          views: data.views || 0,
          ratings: data.ratings,
          author: data.author || "익명 방문자",
          authorId: data.authorId || ""
        });
      });
      setPosts(list);
      setIsLoading(false);
    }, (error: Error) => {
      console.error("Feed snapshot error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [addressParam]);

  const filteredData = useMemo(() => {
    let list = [...posts];

    if (addressParam) {
      list = list.filter(p => p.location === decodeURIComponent(addressParam));
    }

    if (activeTab === "hot") {
      return list.sort((a, b) => (b.likes * 1000 + b.views) - (a.likes * 1000 + a.views));
    } else {
      return list;
    }
  }, [activeTab, posts, addressParam]);

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
  const handleEditDetail = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

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
              {(["hot", "local"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`feed__tab${activeTab === tab ? " feed__tab--active" : ""}`}
                >
                  {tab === "hot" ? "실시간 핫게시물" : "내 주변 소식"}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="feed__list">
        {isLoading ? (
          <div className="loading-state">방문록을 불러오는 중...</div>
        ) : filteredData.length > 0 ? (
          filteredData.map(post => (
            <div key={post.id} className="feed__card" onClick={() => handlePostClick(post.id)}>
              <div className="feed__card-header">
                <div className="feed__card-meta" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {post.isVerified && (
                     <div className="card-verify-badge" style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#3182F6', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                       <CheckCircle2 size={12} strokeWidth={3} />
                       <span>인증됨</span>
                     </div>
                  )}
                  {post.tags?.slice(0, 2).map((t, i) => (
                    <span
                      key={i}
                      className="feed__card-tag"
                      style={{ backgroundColor: post.tagBg, color: post.tagColor, padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}
                    >
                      {t}
                    </span>
                  ))}
                  {post.tags && post.tags.length > 2 && (
                    <span
                      className="feed__card-tag"
                      style={{ backgroundColor: post.tagBg, color: post.tagColor, padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}
                    >
                      +{post.tags.length - 2}
                    </span>
                  )}
                </div>
                {activeTab !== 'hot' && user && user.id === post.authorId && (
                  <div className="feed__card-more-container" style={{ position: 'relative' }}>
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
                <MapPin size={14} color="#3182F6" />
                <span>{post.location}</span>
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

              <div className="feed__card-footer">
                <div className="feed__card-stat">
                  <Heart size={16} fill="none" color="#B0B8C1" />
                  <span>{post.likes}</span>
                </div>
                <div className="feed__card-stat">
                  <Eye size={16} color="#B0B8C1" />
                  <span>{post.views}</span>
                </div>
                <span className="feed__card-date" style={{ marginLeft: "auto", fontSize: "12px", color: "#8B95A1" }}>{post.date}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>아직 작성된 방문록이 없습니다.</p>
            <p>첫 번째 방문록을 작성해보세요!</p>
          </div>
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
            <div className="tds-modal-footer" style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button
                className="tds-btn-secondary"
                style={{
                  flex: 1,
                  height: '54px',
                  background: '#F2F4F6',
                  color: '#4E5968',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setModalConfig(prev => ({ ...prev, isOpen: false }));
                  if (modalConfig.onCancel) modalConfig.onCancel();
                }}
              >
                {modalConfig.cancelText || "닫기"}
              </button>
              <button
                className="tds-btn-primary"
                style={{
                  flex: 1,
                  height: '54px',
                  background: '#3182F6',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
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
