import { useState } from "react";
import { Heart, Eye, MapPin, MoreVertical } from "lucide-react";

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
}

export function Feed() {
  const [activeTab, setActiveTab] = useState<"hot" | "local">("hot");

  const mockData: Post[] = [
    {
      id: 1, type: "hot", tag: "#빌런집주인", tagBg: "#FFF0F0", tagColor: "#E84040",
      date: "2026.03.30", location: "광진구 자양동",
      content: "진짜 역대급 빌런 집주인 만났습니다. 보일러 고장난 거 3주째 안 고쳐주고, 월세만 꼬박꼬박 받아가네요. 겨울인데 너무 추워서 매일 밤 전기장판에만 의지하고 있습니다. 절대 이 건물 오지 마세요.",
      image: "https://images.unsplash.com/photo-1566699270403-3f7e3f340664?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
      likes: 124, views: 3400,
    },
    {
      id: 2, type: "hot", tag: "#인테리어자랑", tagBg: "#E8F3FF", tagColor: "#3182F6",
      date: "2026.03.28", location: "성동구 성수동",
      content: "성수동 옥탑방 리모델링 후기입니다! 처음엔 진짜 폐가 수준이었는데, 바닥 공사하고 벽지 뜯어내고 화이트 톤으로 다 맞추니까 환골탈태했어요. 채광이 너무 좋아서 낮에는 불 안 켜도 환해요.",
      image: "https://images.unsplash.com/photo-1600592858560-9fef0f602f40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
      likes: 89, views: 1205,
    },
    {
      id: 3, type: "local", tag: "#수압체크필수", tagBg: "#F3F4F6", tagColor: "#6B7684",
      date: "2026.03.29", location: "강남구 역삼동",
      content: "역삼동 오피스텔인데, 수압이 정말 약해요. 샤워기 물줄기가 너무 가늘어서 머리 감는데 한참 걸립니다. ㅠㅠ 입주하실 분들은 수압 꼭 확인하고 계약하세요.",
      image: "https://images.unsplash.com/photo-1512845296467-183ccf124347?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
      likes: 45, views: 670,
    },
    {
      id: 4, type: "local", tag: "#방음맛집", tagBg: "#E6F8F3", tagColor: "#00A968",
      date: "2026.03.27", location: "마포구 서교동",
      content: "여기 방음 진짜 잘돼요. 옆집에서 뭘 하는지 하나도 안 들림. 층간소음도 없고 완전 쾌적하게 살고 있습니다. 홍대 근처인데도 조용해서 너무 좋아요!",
      image: "https://images.unsplash.com/photo-1563261515-5bfbfe4b0173?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
      likes: 12, views: 300,
    },
  ];

  const filteredData = activeTab === "hot" ? mockData : mockData.filter(p => p.type === "local");

  return (
    <div className="feed">
      {/* 헤더 탭 */}
      <div className="feed__header">
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
      </div>

      {/* 피드 리스트 */}
      <div className="feed__list">
        {filteredData.map(post => (
          <div key={post.id} className="feed__card">
            {/* 카드 헤더 */}
            <div className="feed__card-header">
              <div className="feed__card-meta">
                {/* 태그는 색상이 데이터에서 오므로 인라인 유지 */}
                <span
                  className="feed__card-tag"
                  style={{ backgroundColor: post.tagBg, color: post.tagColor }}
                >
                  {post.tag}
                </span>
                <span className="feed__card-date">{post.date}</span>
              </div>
              <button className="feed__card-more">
                <MoreVertical size={18} />
              </button>
            </div>

            {/* 위치 */}
            <div className="feed__card-location">
              <MapPin size={14} color="#3182F6" />
              <span>{post.location}</span>
            </div>

            {/* 본문 */}
            <div className="feed__card-body">
              <p className="feed__card-content">{post.content}</p>
              <div className="feed__card-thumbnail">
                <img src={post.image} alt="post" />
              </div>
            </div>

            {/* 푸터 */}
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
        ))}
      </div>
    </div>
  );
}
