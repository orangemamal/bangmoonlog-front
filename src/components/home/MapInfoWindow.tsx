import React from 'react';
import { Star, MapPin } from 'lucide-react';
import { LocationStats } from '../../types/review';

interface MapInfoWindowProps {
  stats: LocationStats;
  isResidential: boolean;
  onRead: (address: string) => void;
  onWrite: (address: string, lat: number, lng: number) => void;
  onToggleBookmark: (address: string, lat: number, lng: number) => void;
  onReport: (address: string) => void;
}

export const MapInfoWindow: React.FC<MapInfoWindowProps> = ({
  stats,
  isResidential,
  onRead,
  onWrite,
  onToggleBookmark,
  onReport
}) => {
  const { address, lat, lng, count, avgRating, isBookmarked, hasWritten } = stats;

  return (
    <div className="iw-container marker">
      <div className="iw-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="iw-title" style={{ marginBottom: 0 }}>이 공간의 방문록</div>
          {isResidential && (
            <button 
              className={`iw-bookmark-icon-btn ${isBookmarked ? 'active' : ''}`} 
              onClick={() => onToggleBookmark(address, lat, lng)}
            >
              <Star 
                size={24} 
                fill={isBookmarked ? '#8B5CF6' : 'none'} 
                stroke={isBookmarked ? '#8B5CF6' : '#A8AFB5'} 
              />
            </button>
          )}
        </div>
        
        <div className="iw-address">
          <span>📍</span>
          <span>{address}</span>
        </div>
        
        {count > 0 ? (
          <div className="iw-stats">
            <div className="iw-stat-item">
              <div className="label">리뷰 평점</div>
              <div className="value-wrap">
                <span className="star">★</span>
                <span className="value">{avgRating.toFixed(2)}</span>
              </div>
            </div>
            <div className="iw-divider"></div>
            <div className="iw-stat-item">
              <div className="label">총 방문록</div>
              <div className="value-wrap">
                <span className="value value--blue">{count}건</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', background: '#F9FAFB', borderRadius: '12px', marginBottom: '16px', fontSize: '13px', color: '#8B95A1' }}>
            아직 작성된 방문록이 없어요. 👟
          </div>
        )}
        
        {isResidential && count > 0 && (
          <div style={{ marginBottom: '12px', fontSize: '11px', color: '#3182F6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>🏢</span> 상세 층/호수별 리뷰 정보 포함
          </div>
        )}

        <div className="iw-button-group">
          {count > 0 && (
            <button className="iw-button iw-button--read" onClick={() => onRead(address)}>
              방문록 보기
            </button>
          )}
          {isResidential && (
            <button 
              className="iw-button iw-button--write" 
              disabled={hasWritten}
              style={{ 
                width: count === 0 ? '100%' : 'auto',
                ...(hasWritten ? { background: '#E5E8EB', color: '#A8AFB5', cursor: 'not-allowed', border: 'none' } : {})
              }} 
              onClick={() => onWrite(address, lat, lng)}
            >
              {hasWritten ? "작성 완료" : "방문록 쓰기"}
            </button>
          )}
        </div>
        
        {!isResidential && (
          <div style={{ marginTop: '12px', padding: '10px', background: '#FFF0F0', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '14px' }}>🏠</span>
              <p style={{ margin: 0, fontSize: '11px', color: '#F04452', fontWeight: 600, lineHeight: 1.4 }}>
                거주용 건물이 아니므로<br/>방문록 작성이 제한됩니다.
              </p>
            </div>
            <button 
              onClick={() => onReport(address)} 
              style={{ marginTop: '6px', background: 'none', border: 'none', color: '#8B95A1', fontSize: '10px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
            >
              거주용 건물이 맞는데 오류가 나나요?
            </button>
          </div>
        )}
        <div className="iw-arrow"></div>
      </div>
    </div>
  );
};
