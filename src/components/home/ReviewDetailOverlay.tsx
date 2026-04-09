import { ArrowLeft, MapPin, Star, Heart, MessageSquare } from "lucide-react";

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

interface ReviewDetailOverlayProps {
  review: Review | null;
  onClose: () => void;
}

export function ReviewDetailOverlay({ review, onClose }: ReviewDetailOverlayProps) {
  if (!review) return null;

  return (
    <div className="review-detail-overlay">
      <div className="header">
        <button className="back-btn" onClick={onClose}>
          <ArrowLeft size={24} />
        </button>
        <span className="title">방문록 상세보기</span>
      </div>
      <div className="body">
        <div className="img-box">
          <img src={review.image} alt="detail" />
          <div className="tag-float" style={{ backgroundColor: review.tagBg, color: review.tagColor }}>{review.tag}</div>
        </div>
        <div className="info-section">
          <div className="profile-row">
            <div className="avatar"></div>
            <div className="meta">
              <div className="name">{review.author}</div>
              <div className="date">{review.date}</div>
            </div>
          </div>
          
          <div className="location-info">
            <MapPin size={14} />
            <span>{review.location}</span>
          </div>

          <div className="rating-box">
            <h4 className="title">건물 환경 평가</h4>
            <div className="rating-list">
              <RatingRowSmall label="☀️ 채광" count={review.ratings.light} />
              <RatingRowSmall label="🔇 소음" count={review.ratings.noise} />
              <RatingRowSmall label="💧 수압" count={review.ratings.water} />
            </div>
          </div>

          <div className="content-box">
            {review.content}
          </div>
        </div>
      </div>
      <div className="footer-actions">
        <button className="action"><Heart size={20} /> 공감하기</button>
        <button className="action"><MessageSquare size={20} /> 댓글 {review.id * 3}</button>
      </div>
    </div>
  );
}

function RatingRowSmall({ label, count }: { label: string; count: number }) {
  return (
    <div className="rating-row-small">
      <span className="label">{label}</span>
      <div className="stars">
        {[1, 2, 3, 4, 5].map(v => (
          <Star
            key={v}
            size={14}
            fill={v <= count ? "#F5A623" : "none"}
            color={v <= count ? "#F5A623" : "#D1D6DB"}
          />
        ))}
      </div>
    </div>
  );
}
