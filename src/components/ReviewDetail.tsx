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
  Home as HomeIcon,
  Search,
  Image as ImageIcon,
  ImageIcon
} from "lucide-react";
import {
  doc,
  getDoc,
  getDocs,
  where,
  onSnapshot,
  collection,
  query,
  orderBy,
  QuerySnapshot,
  DocumentData,
  QueryDocumentSnapshot,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../hooks/useAuth";
import { incrementViews, toggleLike, addComment } from "../services/reviewService";
import { useState, useEffect, useRef, useCallback } from "react";
import { getUserTitle } from "../utils/titleSystem";
import { formatAddressDetail } from "../utils/addressUtils";
import { analyzeReviewWithAI } from "../utils/gemini";

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
  const [authorPhotoURL, setAuthorPhotoURL] = useState<string | null>(null);
  const [commentPhotoByUserId, setCommentPhotoByUserId] = useState<Record<string, string | undefined>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showMenuPopup, setShowMenuPopup] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);


  const hasIncremented = useRef<string | null>(null);

  useEffect(() => {
    if (!reviewId) return;

    // 1. 조회수 증가 - 1시간 쿨타임 적용 (데이터 낭비 및 할당량 초과 방지)
    const VIEW_COOLDOWN = 60 * 60 * 1000; // 1시간
    const lastViewed = localStorage.getItem(`viewed_${reviewId}`);
    const now = Date.now();

    if (!lastViewed || (now - parseInt(lastViewed) > VIEW_COOLDOWN)) {
      incrementViews(reviewId).catch(err => {
        // 할당량 초과 시 에러 무시 (사용자 경험 방해 금지)
        console.warn("View increment skipped due to quota or network:", err);
      });
      localStorage.setItem(`viewed_${reviewId}`, now.toString());
    }

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
  }, [reviewId, !!user, onClose]);

  useEffect(() => {
    if (review?.authorId) {
      const q = query(collection(db, "reviews"), where("authorId", "==", review.authorId));
      getDocs(q).then((snap: QuerySnapshot<DocumentData>) => {
        setAuthorTitle(getUserTitle(snap.size));
      }).catch(() => { });
    }
  }, [review?.authorId]);

  // 작성자 프로필 사진: Firestore users 문서(마이페이지 업로드와 동일 소스)
  useEffect(() => {
    if (!review?.authorId) {
      setAuthorPhotoURL(null);
      return;
    }
    const userRef = doc(db, "users", review.authorId);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const url = snap.data().photoURL;
        setAuthorPhotoURL(typeof url === "string" && url ? url : null);
      } else {
        setAuthorPhotoURL(null);
      }
    });
    return () => unsub();
  }, [review?.authorId]);

  // 댓글 작성자 프로필 (users 컬렉션에서 조회)
  useEffect(() => {
    if (comments.length === 0) {
      setCommentPhotoByUserId({});
      return;
    }
    const ids = [...new Set(comments.map((c) => c.userId))];
    let cancelled = false;
    Promise.all(
      ids.map((id) =>
        getDoc(doc(db, "users", id)).then((snap) => ({
          id,
          url: snap.exists() ? (snap.data().photoURL as string | undefined) : undefined,
        }))
      )
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, string | undefined> = {};
      results.forEach(({ id, url }) => {
        next[id] = url;
      });
      setCommentPhotoByUserId(next);
    });
    return () => {
      cancelled = true;
    };
  }, [comments]);

  const handleLike = useCallback(async () => {
    if (!user || !isLoggedIn) {
      if (onLoginRequired) onLoginRequired();
      else alert("로그인이 필요합니다.");
      return;
    }
    if (review) {
      // 1. 낙관적 업데이트 - 상태를 즉시 변경 (단, 서버 데이터가 오면 덮어씌워짐)
      const previousIsLiked = isLiked;
      const previousLikes = review.likes || 0;
      
      setIsLiked(!previousIsLiked);
      setReview(prev => ({
        ...prev,
        likes: previousIsLiked ? Math.max(0, previousLikes - 1) : previousLikes + 1
      }));

      // 2. 실제 DB 업데이트
      try {
        await toggleLike(
          reviewId,
          user.id,
          review.authorId || "",
          user.name || "익명 사용자"
        );
      } catch (err: any) {
        // 실패 시 원래상태로 복구
        setIsLiked(previousIsLiked);
        setReview(prev => ({ ...prev, likes: previousLikes }));
        
        // Quota 에러인지 판별하여 친절한 메시지 제공
        if (err?.code === 'resource-exhausted' || err?.message?.includes('quota') || err?.message?.includes('exhausted')) {
          alert('서버 일일 사용량(무료 할당량)이 초과되어 기능이 일시 제한됩니다. 내일 다시 시도해주세요! 😭');
        } else {
          alert(`공감하기 실패: ${err.message || '알 수 없는 오류'}`);
        }
        console.error("Like toggle error:", err);
      }
    }
  }, [user, isLoggedIn, review, reviewId, isLiked, onLoginRequired]);

  const handleAddComment = useCallback(async () => {
    if (!isLoggedIn) {
      if (onLoginRequired) onLoginRequired();
      else alert("로그인이 필요합니다.");
      return;
    }
    if (!newComment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      // AI 검열 시스템 가동
      const aiResult = await analyzeReviewWithAI(newComment);
      
      if (!aiResult.isPassed) {
        alert(`AI 클렌징 알림: ${aiResult.reason}\n건전한 커뮤니티를 위해 내용을 수정해주세요. 🤖`);
        setIsSubmittingComment(false);
        return;
      }

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
    } catch (err) {
      console.error("Comment submission error:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  }, [isLoggedIn, newComment, reviewId, user, onLoginRequired, review?.authorId, isSubmittingComment]);



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

        {isLoggedIn && (
          <div style={{ position: 'relative' }}>
            <button 
              className="back-btn" 
              onClick={(e) => {
                e.stopPropagation();
                setShowMenuPopup(prev => !prev);
              }} 
              style={{ padding: '8px' }}
            >
              <MoreHorizontal size={24} color="#4E5968" />
            </button>
            {showMenuPopup && (
              <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: '4px', minWidth: '140px' }}>
                {(user?.id === review?.authorId || user?.isAdmin) && (
                  <>
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#333D4B', width: '100%' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log("ReviewDetail: Edit Button Clicked");
                        setShowMenuPopup(false);
                        if (onEdit) onEdit();
                      }}
                    >
                      <Pencil size={18} /> 수정하기
                    </button>
                    <div style={{ height: '1px', background: '#F2F4F6', margin: '0 4px' }} />
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#E84040', width: '100%' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log("ReviewDetail: Delete Button Clicked");
                        setShowMenuPopup(false);
                        if (onDelete) onDelete();
                      }}
                    >
                      <Trash2 size={18} /> 삭제하기
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {!isLoggedIn && <div style={{ width: 44 }} />}
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
              review.images.map((img: string, i: number) => {
                const isVideo = img.includes('.mp4?') || img.includes('.mov?') || img.includes('.webm?');
                return (
                  <div key={i} className="detail-slider-item">
                    {isVideo ? (
                      <video src={img} controls autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <img src={img} alt={`detail-${i}`} />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="detail-slider-item no-image">
                <div className="no-image-placeholder">
                  <div className="placeholder-icon">
                    <ImageIcon size={40} color="#B0B8C1" />
                  </div>
                  <span className="placeholder-text">등록된 사진/영상이 없습니다.</span>
                </div>
              </div>
            )}
          </div>
          {review.images && review.images.length > 1 && (
            <div className="detail-slider-indicator">
              {currentSlideIndex + 1} / {review.images.length}
            </div>
          )}
        </div>

        <div className="detail-info-section">
          {/* Row 1: Visit Purpose & Verification (Full Width Top) */}
          <div className="status-badge-row">
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
            {review.isVerified && (
              <div className="badge-verified">
                <CheckCircle2 size={12} />
                <span>방문자 인증</span>
              </div>
            )}
          </div>

          {/* Row 2: Profile Image & User Info */}
          <div className="profile-row">
            <div className="avatar">
              {authorPhotoURL ? (
                <img src={authorPhotoURL} alt="" className="avatar-img" />
              ) : (
                <span className="avatar-initial">{review.author?.slice(0, 1) ?? "?"}</span>
              )}
            </div>
            <div className="meta">
              <div className="author-info-block">
                <span className="name">{review.author}</span>
                {authorTitle && (
                  <span className="author-title-badge">
                    {authorTitle.icon} {authorTitle.title}
                  </span>
                )}
              </div>
              <div className="date">{review.date}</div>
            </div>
          </div>

          <div className="location-box">
            <MapPin size={14} color="#3182F6" />
            <span className="address">
              {review.address || review.location}
              {review.addressDetail && (
                <span style={{ color: '#3182F6', fontWeight: 600, marginLeft: '4px' }}>
                  {formatAddressDetail(review.addressDetail)}
                </span>
              )}
            </span>
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

          {/* 태그 영역 - 본문과 댓글 사이로 이동 */}
          {review.tags && review.tags.length > 0 && (
            <div className="detail-tags-section">
              {review.tags.map((t: string) => (
                <span key={t} className="tds-tag">#{t.replace(/^#/, '')}</span>
              ))}
            </div>
          )}

          {/* 댓글 섹션 */}
          <div className="comments-section">
            <h4 className="title">댓글 {comments.length}</h4>
            <div className="comments-list">
              {comments.length > 0 ? (
                comments.map((c) => (
                  <div key={c.id} className="comment-item">
                    <div className="comment-avatar">
                      {commentPhotoByUserId[c.userId] ? (
                        <img src={commentPhotoByUserId[c.userId]} alt="" className="comment-avatar-img" />
                      ) : (
                        <span className="comment-avatar-initial">{c.authorName?.slice(0, 1) ?? "?"}</span>
                      )}
                    </div>
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
          <button 
            className="send-btn" 
            onClick={handleAddComment} 
            disabled={isSubmittingComment || !newComment.trim()}
          >
            {isSubmittingComment ? (
              <div className="spinner-small" style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'iw-spin 0.8s linear infinite' }} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
 

    </div>
  );
}
