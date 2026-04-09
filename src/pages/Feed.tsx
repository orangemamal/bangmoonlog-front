import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Heart, Eye, MapPin, MoreVertical, ArrowLeft, ChevronRight, MessageSquare, Star } from "lucide-react";

interface Post {
  id: number;
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

  const mockData: Post[] = useMemo(() => [
    {
      id: 1, type: "hot", tag: "#빌런집주인", tagBg: "#FFF0F0", tagColor: "#E84040",
      date: "2026.03.30", location: "광진구 자양동", author: "자양동요정",
      content: "진짜 역대급 빌런 집주인 만났습니다. 보일러 고장난 거 3주째 안 고쳐주고, 월세만 꼬박꼬박 받아가네요. 겨울인데 너무 추워서 매일 밤 전기장판에만 의지하고 있습니다. 절대 이 건물 오지 마세요.",
      image: "https://images.unsplash.com/photo-1566699270403-3f7e3f340664?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
      likes: 124, views: 3400,
      ratings: { light: 1, noise: 2, water: 4 }
    },
    {
      id: 2, type: "hot", tag: "#인테리어자랑", tagBg: "#E8F3FF", tagColor: "#3182F6",
      date: "2026.03.28", location: "성동구 성수동 45-2", author: "성수러버",
      content: "성수동 옥탑방 리모델링 후기입니다! 처음엔 진짜 폐가 수준이었는데, 바닥 공사하고 벽지 뜯어내고 화이트 톤으로 다 맞추니까 환골탈태했어요. 채광이 너무 좋아서 낮에는 불 안 켜도 환해요. 근처 카페거리도 가깝고 위치가 사기입니다.",
      image: "https://images.unsplash.com/photo-1600592858560-9fef0f602f40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
      likes: 89, views: 1205,
      ratings: { light: 5, noise: 4, water: 5 }
    },
    {
      id: 3, type: "local", tag: "#수압체크필수", tagBg: "#F3F4F6", tagColor: "#6B7684",
      date: "2026.03.29", location: "강남구 역삼동", author: "퇴근하고싶다",
      content: "역삼동 오피스텔인데, 수압이 정말 약해요. 샤워기 물줄기가 너무 가늘어서 머리 감는데 한참 걸립니다. ㅠㅠ 입주하실 분들은 수압 꼭 확인하고 계약하세요.",
      image: "https://images.unsplash.com/photo-1512845296467-183ccf124347?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
      likes: 45, views: 670,
      ratings: { light: 3, noise: 3, water: 1 }
    },
    {
      id: 4, type: "local", tag: "#방음맛집", tagBg: "#E6F8F3", tagColor: "#00A968",
      date: "2026.03.27", location: "마포구 서교동", author: "힙한거시름",
      content: "여기 방음 진짜 잘돼요. 옆집에서 뭘 하는지 하나도 안 들림. 층간소음도 없고 완전 쾌적하게 살고 있습니다. 홍대 근처인데도 조용해서 너무 좋아요!",
      image: "https://images.unsplash.com/photo-1563261515-5bfbfe4b0173?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
      likes: 12, views: 300,
      ratings: { light: 4, noise: 5, water: 4 }
    },
  ], []);

  const filteredData = useMemo(() => {
    if (addressParam) {
      // 주소가 있는 경우 해당 주소와 유사한 위치 데이터만 필터링 (데모용)
      return mockData.filter(p => addressParam.includes(p.location) || p.location.includes(addressParam) || p.id === 2);
    }
    return activeTab === "hot" ? mockData : mockData.filter(p => p.type === "local");
  }, [activeTab, addressParam, mockData]);

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
        {filteredData.length > 0 ? (
          filteredData.map(post => (
            <div key={post.id} className="feed__card" onClick={() => setSelectedPost(post)}>
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
    </div>
  );
}
