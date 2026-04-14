import {
  Heart,
  MapPin,
  ArrowLeft,
  Star,
  Send,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Trash2,
  User,
  Home as HomeIcon,
  Search
} from "lucide-react";
import {
  doc,
  getDocs,
  where,
  onSnapshot,
  collection,
  query,
  orderBy,
  QuerySnapshot,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../hooks/useAuth";
import { incrementViews, toggleLike, addComment } from "../services/reviewService";
import { useState, useEffect, useRef, useCallback } from "react";
import { getUserTitle } from "../utils/titleSystem";

interface ReviewDetailProps {
  reviewId: string;
  onClose: () => void;
  onLoginRequired?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

interface Comment {
  id: string;
  userId: string;
  authorName: string;
  content: string;
  createdAt: any;
}

export function ReviewDetail({ reviewId, onClose, onLoginRequired, onEdit, onDelete }: ReviewDetailProps) {
  const { user, isLoggedIn } = useAuth();
  const [review, setReview] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [authorTitle, setAuthorTitle] = useState<{ title: string; icon: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showMenuPopup, setShowMenuPopup] = useState(false);

  useEffect(() => {
    if (!reviewId) return;

    // 1. 조회수 증가
    incrementViews(reviewId);

    // 2. 리뷰 실시간 감시
    const unsubscribeReview = onSnapshot(doc(db, "reviews", reviewId), (docSnap: any) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setReview({
          id: docSnap.id,
          ...data,
          date: data.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR').format(data.createdAt.toDate()) : "2026.04.10"
        });
      } else {
        onClose();
      }
      setIsLoading(false);
    });

    // 3. 댓글 실시간 감시
    const commentsQuery = query(
      collection(db, "reviews", reviewId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsubscribeComments = onSnapshot(commentsQuery, (snap: QuerySnapshot<DocumentData>) => {
      const list: Comment[] = [];
      snap.forEach((docItem: QueryDocumentSnapshot<DocumentData>) => {
        list.push({ id: docItem.id, ...docItem.data() } as Comment);
      });
      setComments(list);
    });

    // 4. 나의 좋아요 여부 감시
    let unsubscribeLike = () => { };
    if (user) {
      unsubscribeLike = onSnapshot(doc(db, "reviews", reviewId, "likes", user.id), (likeDoc: any) => {
        setIsLiked(likeDoc.exists());
      });
    }

    return () => {
      unsubscribeReview();
      unsubscribeComments();
      unsubscribeLike();
    };
  }, [reviewId, user, onClose]);

  useEffect(() => {
    if (review?.authorId) {
      const q = query(collection(db, "reviews"), where("authorId", "==", review.authorId));
      getDocs(q).then((snap: QuerySnapshot<DocumentData>) => {
        setAuthorTitle(getUserTitle(snap.size));
      }).catch(() => { });
    }
  }, [review?.authorId]);

  const handleLike = useCallback(async () => {
    if (!user || !isLoggedIn) {
      if (onLoginRequired) onLoginRequired();
      else alert("로그인이 필요합니다.");
      return;
    }
    if (review) {
      // 1. 낙관적 업데이트 (Optimistic UI Update) - 즉각적인 붉은색 토글 적용
      const previousIsLiked = isLiked;
      const previousLikes = review.likes || 0;

      setIsLiked(!previousIsLiked);
      setReview({
        ...review,
        likes: previousIsLiked ? Math.max(0, previousLikes - 1) : previousLikes + 1
      });

      // 2. 실제 DB 업데이트 (작성자 이름과 리뷰 작성자 ID 추가 전달)
      const success = await toggleLike(
        reviewId,
        user.id,
        review.authorId || "",
        user.name || "익명 사용자"
      );

      // 3. 실패 시 롤백 (원래 상태로 복구)
      if (!success) {
        setIsLiked(previousIsLiked);
        setReview({ ...review, likes: previousLikes });
        alert("공감하기 처리 중 오류가 발생했습니다.");
      }
    }
  }, [user, isLoggedIn, review, reviewId, isLiked, onLoginRequired]);

  const handleAddComment = useCallback(async () => {
    if (!isLoggedIn) {
      if (onLoginRequired) onLoginRequired();
      else alert("로그인이 필요합니다.");
      return;
    }
    if (!newComment.trim()) return;

    const success = await addComment(
      reviewId,
      user!.id,
      user!.name || "익명 사용자",
      newComment,
      review?.authorId
    );

    if (success) {
      setNewComment("");
    }
  }, [isLoggedIn, newComment, reviewId, user, onLoginRequired, review?.authorId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const idx = Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth);
    setCurrentSlideIndex(idx);
  };

  if (isLoading) return <div className="detail-loading">불러오는 중...</div>;
  if (!review) return null;

  return (
    <div className="review-detail-overlay">
      <div className="review-detail-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="back-btn" onClick={onClose}><ArrowLeft size={24} /></button>
        <span className="title" style={{ flex: 1, textAlign: 'center' }}>방문록 상세보기</span>

        {user?.id === review?.authorId ? (
          <div style={{ position: 'relative' }}>
            <button className="back-btn" onClick={() => setShowMenuPopup(prev => !prev)}>
              <MoreHorizontal size={24} />
            </button>
            {showMenuPopup && (
              <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, display: 'flex', flexDirection: 'column', padding: '4px', minWidth: '120px' }}>
                <button
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '14px' }}
                  onClick={() => { setShowMenuPopup(false); onEdit?.(); }}
                >
                  <Pencil size={18} /> 수정하기
                </button>
                <div style={{ height: '1px', background: '#F2F4F6', margin: '0 4px' }} />
                <button
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#E84040' }}
                  onClick={() => { setShowMenuPopup(false); onDelete?.(); }}
                >
                  <Trash2 size={18} /> 삭제하기
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ width: 24 }} />
        )}
      </div>

      <div className="review-detail-body">
        {/* 이미지 슬라이더 */}
        <div className="detail-slider-container">
          <div
            className="detail-slider-track"
            ref={scrollRef}
            onScroll={handleScroll}
          >
            {review.images && review.images.length > 0 ? (
              review.images.map((img: string, i: number) => (
                <div key={i} className="detail-slider-item">
                  <img src={img} alt={`detail-${i}`} />
                </div>
              ))
            ) : (
              <div className="detail-slider-item no-image">
                <div className="icon">🖼️</div>
                <div className="text">이미지 없음</div>
              </div>
            )}
          </div>
          {review.images && review.images.length > 1 && (
            <div className="detail-slider-indicator">
              {currentSlideIndex + 1} / {review.images.length}
            </div>
          )}
          <div className="detail-tags-overlay">
            {review.tags?.map((t: string) => (
              <div key={t} className="tag-chip">{t}</div>
            ))}
          </div>
        </div>

        <div className="detail-info-section">
          <div className="profile-row">
            <div className="avatar"></div>
            <div className="meta">
              <div className="name-row">
                <span className="name">{review.author}</span>
                {(() => {
                  const displayType = review.experienceType || "단순 방문";
                  return (
                    <div className={`experience-badge ${displayType === '거주 경험' ? 'resident' : displayType === '매물 투어' ? 'visit' : ''}`}>
                      <span className="icon">
                        {displayType === '거주 경험' ? <HomeIcon size={12} /> : displayType === '매물 투어' ? <Search size={12} /> : <MapPin size={12} />}
                      </span>
                      <span>{displayType}</span>
                    </div>
                  );
                })()}
                {authorTitle && (
                  <span style={{ fontSize: '12px', background: '#F2F4F6', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {authorTitle.icon} {authorTitle.title}
                  </span>
                )}
                {review.isVerified && (
                  <div className="badge-verified">
                    <CheckCircle2 size={12} />
                    <span>방문 인증 완료</span>
                  </div>
                )}
              </div>
              <div className="date">{review.date}</div>
            </div>
          </div>

          <div className="location-box">
            <MapPin size={14} color="#3182F6" />
            <span className="address">{review.address || review.location}</span>
            {review.isVerified && (
              <span className="distance">· {review.distance}m 거리</span>
            )}
          </div>

          <div className="rating-box">
            <h4 className="title">환경 평가</h4>
            <div className="rating-grid">
              <div className="rating-item">
                <span className="label">☀️ 채광</span>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map(v => (
                    <Star key={v} size={14} fill={v <= review.ratings.light ? "#F5A623" : "none"} color={v <= review.ratings.light ? "#F5A623" : "#D1D6DB"} />
                  ))}
                </div>
              </div>
              <div className="rating-item">
                <span className="label">🔇 소음</span>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map(v => (
                    <Star key={v} size={14} fill={v <= review.ratings.noise ? "#F5A623" : "none"} color={v <= review.ratings.noise ? "#F5A623" : "#D1D6DB"} />
                  ))}
                </div>
              </div>
              <div className="rating-item">
                <span className="label">💧 수압</span>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map(v => (
                    <Star key={v} size={14} fill={v <= review.ratings.water ? "#F5A623" : "none"} color={v <= review.ratings.water ? "#F5A623" : "#D1D6DB"} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="content-box">
            {review.content}
          </div>

          {/* 댓글 섹션 */}
          <div className="comments-section">
            <h4 className="title">댓글 {comments.length}</h4>
            <div className="comments-list">
              {comments.length > 0 ? (
                comments.map((c) => (
                  <div key={c.id} className="comment-item">
                    <div className="comment-avatar"></div>
                    <div className="comment-content-wrap">
                      <div className="comment-meta">
                        <span className="author">{c.authorName}</span>
                        <span className="date">방금 전</span>
                      </div>
                      <p className="content">{c.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-comments">첫 댓글을 남겨보세요! 💬</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 푸터 액션 */}
      <div className="review-detail-footer">
        <button
          className={`action-btn ${isLiked ? 'active' : ''}`}
          onClick={handleLike}
        >
          <Heart size={20} fill={isLiked ? "#F04452" : "none"} color={isLiked ? "#F04452" : "#4E5968"} />
          <span>공감하기 {review.likes || 0}</span>
        </button>
        <div className="comment-input-wrap">
          <input
            type="text"
            placeholder="댓글을 입력하세요..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
          />
          <button className="send-btn" onClick={handleAddComment}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
