import { ArrowLeft, Heart, Eye, MoreVertical } from "lucide-react";

interface Review {
  id: number;
  author: string;
  date: string;
  location: string;
  content: string;
  image: string;
  likes: number;
  views: number;
  tag: string;
  tagBg: string;
  tagColor: string;
  ratings: { light: number; noise: number; water: number };
}

interface ReviewListOverlayProps {
  isOpen: boolean;
  address: string;
  onClose: () => void;
  onSelectReview: (review: Review) => void;
}

export function ReviewListOverlay({ isOpen, address, onClose, onSelectReview }: ReviewListOverlayProps) {
  if (!isOpen) return null;

  // Mock data (실제로는 API 연동)
  const reviews: Review[] = [
    {
      id: 1, author: "자양동요정", date: "2026.03.30", location: address,
      content: "채광이 정말 좋고 집주인분이 친절하세요. 수압도 체크해봤는데 아주 만족스럽습니다.",
      image: "https://images.unsplash.com/photo-1600592858560-9fef0f602f40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
      likes: 12, views: 120, tag: "#채광맛집", tagBg: "#E8F3FF", tagColor: "#3182F6",
      ratings: { light: 5, noise: 4, water: 5 }
    },
    {
      id: 2, author: "이사가고싶다", date: "2026.03.25", location: address,
      content: "방음이 조금 아쉬워요. 옆집 소리가 밤늦게까지 들리는 편입니다. 그 외에는 화장실 깨끗하고 지내기 좋아요.",
      image: "https://images.unsplash.com/photo-1512845296467-183ccf124347?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
      likes: 5, views: 80, tag: "#방음주의", tagBg: "#FFF0F0", tagColor: "#E84040",
      ratings: { light: 3, noise: 2, water: 4 }
    }
  ];

  return (
    <div className="review-list-overlay">
      <div className="overlay-header">
        <button className="back-btn" onClick={onClose}>
          <ArrowLeft size={24} />
        </button>
        <div className="info">
          <h1>이 공간의 방문록</h1>
          <p>{address || "나의 위치 근처"}</p>
        </div>
      </div>

      <div className="overlay-list">
        {reviews.map(review => (
          <div key={review.id} className="review-card" onClick={() => onSelectReview(review)}>
            <div className="card-top">
              <div className="card-tag" style={{ backgroundColor: review.tagBg, color: review.tagColor }}>{review.tag}</div>
              <MoreVertical size={18} color="#ADB5BD" />
            </div>
            <div className="card-body">
              <p className="card-content">{review.content}</p>
              <div className="card-thumb">
                <img src={review.image} alt="thumb" />
              </div>
            </div>
            <div className="card-footer">
              <div className="stats">
                <span className="stat-item"><Heart size={14} /> {review.likes}</span>
                <span className="stat-item"><Eye size={14} /> {review.views}</span>
              </div>
              <span className="date">{review.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
