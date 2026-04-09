import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Heart, Eye, MapPin, MoreVertical, ArrowLeft, ChevronRight, MessageSquare, Star } from "lucide-react";
import { db } from "../services/firebase";
import { collection, query, getDocs, orderBy, where } from "firebase/firestore";
import { useAccessControl } from "../hooks/useAccessControl";

interface Post {
  id: string;
  type: "hot" | "local";
  tag: string;
  tagBg: string;
  tagColor: string;
  date: string;
  location: string;
  content: string;
  image: string;
  likes: number;
  views: number;
  ratings?: { light: number; noise: number; water: number };
  author: string;
}

export function Feed() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const addressParam = searchParams.get("address");
  const [activeTab, setActiveTab] = useState<"hot" | "local">("hot");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { canRead, incrementReadCount, watchAd, isAdShowing } = useAccessControl();

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        let q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
        
        // 주소 파라미터가 있는 경우 필터링
        if (addressParam) {
          q = query(collection(db, "reviews"), where("address", "==", addressParam), orderBy("createdAt", "desc"));
        }

        const snap = await getDocs(q);
        const list: Post[] = [];
        snap.forEach(doc => {
          const data = doc.data();
          list.push({
            id: doc.id,
            type: data.likes > 50 ? "hot" : "local",
            tag: data.tags?.[0] || "#채광맛집",
            tagBg: data.likes > 50 ? "#FFF0F0" : "#E8F3FF",
            tagColor: data.likes > 50 ? "#E84040" : "#3182F6",
            date: data.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR').format(data.createdAt.toDate()) : "2026.04.09",
            location: data.address,
            content: data.content,
            image: data.images?.[0] || "https://images.unsplash.com/photo-1600592858560-9fef0f602f40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
            likes: data.likes || 0,
            views: data.views || 0,
            ratings: data.ratings,
            author: data.author || "익명 방문자"
          });
        });
        setPosts(list);
      } catch (e) {
        console.error("Feed fetch error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, [addressParam]);

  const filteredData = useMemo(() => {
    if (addressParam) return posts;
    return activeTab === "hot" ? posts.filter(p => p.type === "hot" || p.likes > 20) : posts;
  }, [activeTab, posts, addressParam]);

  return (
    <div className={`feed ${selectedPost ? "feed--detail-active" : ""}`}>
      {/* 상세 보기 오버레이 */}
      {selectedPost && (
        <div className="feed-detail">
          <div className="feed-detail__header">
            <button className="back-btn" onClick={() => setSelectedPost(null)}>
              <ArrowLeft size={24} />
            </button>
            <span className="title">상세 보기</span>
            <button className="more-btn"><MoreVertical size={20} /></button>
          </div>
          
          <div className="feed-detail__body">
            <div className="feed-detail__image">
              <img src={selectedPost.image} alt="detail" />
              <div className="tag-overlay" style={{ background: selectedPost.tagBg, color: selectedPost.tagColor }}>
                {selectedPost.tag}
              </div>
            </div>

            <div className="feed-detail__info">
              <div className="author-row">
                <div className="avatar"></div>
                <div>
                  <div className="name">{selectedPost.author}</div>
                  <div className="date">{selectedPost.date}</div>
                </div>
              </div>

              <div className="location-box">
                <MapPin size={16} color="#3182F6" />
                <span>{selectedPost.location}</span>
                <ChevronRight size={16} color="#B0B8C1" style={{ marginLeft: "auto" }} />
              </div>

              {selectedPost.ratings && (
                <div className="rating-box">
                  <h4 className="rating-title">집안 환경 평가</h4>
                  <div className="rating-grid">
                    <div className="rating-item">
                      <span className="label">☀️ 채광</span>
                      <div className="stars">
                        {[1, 2, 3, 4, 5].map(v => (
                          <Star key={v} size={14} fill={v <= selectedPost.ratings!.light ? "#F5A623" : "none"} color={v <= selectedPost.ratings!.light ? "#F5A623" : "#D1D6DB"} />
                        ))}
                      </div>
                    </div>
                    <div className="rating-item">
                      <span className="label">🔇 소음</span>
                      <div className="stars">
                        {[1, 2, 3, 4, 5].map(v => (
                          <Star key={v} size={14} fill={v <= selectedPost.ratings!.noise ? "#F5A623" : "none"} color={v <= selectedPost.ratings!.noise ? "#F5A623" : "#D1D6DB"} />
                        ))}
                      </div>
                    </div>
                    <div className="rating-item">
                      <span className="label">💧 수압</span>
                      <div className="stars">
                        {[1, 2, 3, 4, 5].map(v => (
                          <Star key={v} size={14} fill={v <= selectedPost.ratings!.water ? "#F5A623" : "none"} color={v <= selectedPost.ratings!.water ? "#F5A623" : "#D1D6DB"} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="content-box">
                <p>{selectedPost.content}</p>
              </div>
            </div>
          </div>

          <div className="feed-detail__footer">
            <div className="action-btn">
              <Heart size={20} />
              <span>{selectedPost.likes}</span>
            </div>
            <div className="action-btn">
              <MessageSquare size={20} />
              <span>댓글 달기</span>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 탭 또는 주소 헤더 */}
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
            <h1>누적 방문록</h1>
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

      {/* 피드 리스트 */}
      <div className="feed__list">
        {isLoading ? (
          <div className="loading-state">방문록을 불러오는 중...</div>
        ) : filteredData.length > 0 ? (
          filteredData.map(post => (
            <div key={post.id} className="feed__card" onClick={async () => {
              if (!canRead) {
                if (confirm("더 많은 방문록을 읽으려면 간단한 광고 시청이 필요합니다. 보시겠습니까?")) {
                  await watchAd();
                  setSelectedPost(post);
                  incrementReadCount();
                }
              } else {
                setSelectedPost(post);
                incrementReadCount();
              }
            }}>
              <div className="feed__card-header">
                <div className="feed__card-meta">
                  <span
                    className="feed__card-tag"
                    style={{ backgroundColor: post.tagBg, color: post.tagColor }}
                  >
                    {post.tag}
                  </span>
                  <span className="feed__card-date">{post.date}</span>
                </div>
                <button className="feed__card-more" onClick={(e) => { e.stopPropagation(); }}>
                  <MoreVertical size={18} />
                </button>
              </div>

              <div className="feed__card-location">
                <MapPin size={14} color="#3182F6" />
                <span>{post.location}</span>
              </div>

              <div className="feed__card-body">
                <p className="feed__card-content">{post.content}</p>
                <div className="feed__card-thumbnail">
                  <img src={post.image} alt="post" />
                </div>
              </div>

              <div className="feed__card-footer">
                <div className="feed__card-stat">
                  <Heart
                    size={16}
                    style={post.likes > 100 ? { fill: "#F04452", color: "#F04452" } : {}}
                  />
                  <span>공감 {post.likes}</span>
                </div>
                <div className="feed__card-stat">
                  <Eye size={16} />
                  <span>조회 {post.views}</span>
                </div>
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
      {/* 광고 오버레이 */}
      {isAdShowing && (
        <div className="ad-overlay">
          <div className="ad-content">
            <div className="ad-timer">광고 시청 중... (2초)</div>
            <div className="ad-placeholder">🏢 깨끗한 방 찾을 땐? 방문LOG</div>
          </div>
        </div>
      )}
    </div>
  );
}
