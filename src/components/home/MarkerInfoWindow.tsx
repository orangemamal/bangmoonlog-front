import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BuildingData {
  buildingName: string;
  mainPurpose: string;
  totalFloors: number;
  underFloors: number;
  hasElevator: boolean;
  elevatorCount: number;
  builtYear: string;
  totalArea: number;
  structure: string;
}

interface MarkerInfoWindowProps {
  address: string;
  lat: number;
  lng: number;
  isBookmarked: boolean;
  isResidential: boolean;
  reviewCount: number;
  avgRating: number;
  hasWritten: boolean;
  buildingPurpose?: string | null;
  title?: string;
  onToggleBookmark: (address: string, lat: number, lng: number) => void;
  onOpenReadList: (address: string) => void;
  onOpenWriteSheet: (address: string, lat: number, lng: number) => void;
  onReportInaccuracy?: (address: string) => void;
}

export const MarkerInfoWindow: React.FC<MarkerInfoWindowProps> = ({
  address,
  lat,
  lng,
  isBookmarked,
  isResidential,
  reviewCount,
  avgRating,
  hasWritten,
  buildingPurpose,
  title = "이 공간의 방문록",
  onToggleBookmark,
  onOpenReadList,
  onOpenWriteSheet,
  onReportInaccuracy,
}) => {
  const [showReportTooltip, setShowReportTooltip] = React.useState(false);
  const [buildingInfo, setBuildingInfo] = useState<BuildingData | null>(null);
  const [loadingBuilding, setLoadingBuilding] = useState(false);
  const buttonText = hasWritten ? "작성 완료" : "방문록 쓰기";

  useEffect(() => {
    if (!address) return;
    setLoadingBuilding(true);
    import('../../services/publicDataService').then(s => 
      s.getBuildingInfo(address)
    ).then(data => {
      setBuildingInfo(data);
      setLoadingBuilding(false);
    }).catch(() => setLoadingBuilding(false));
  }, [address]);

  return (
    <div className="iw-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div className="iw-title" style={{ marginBottom: 0 }}>{title}</div>
          {isResidential && (
            <button 
              className={`iw-bookmark-icon-btn ${isBookmarked ? 'active' : ''}`} 
              onClick={() => onToggleBookmark(address, lat, lng)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" 
                fill={isBookmarked ? '#8B5CF6' : 'none'} 
                stroke={isBookmarked ? '#8B5CF6' : '#A8AFB5'} 
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
            </button>
          )}
        </div>
        <div className="iw-address" style={{ marginBottom: '4px' }}>
          <span>📍</span>
          <span>{address}</span>
        </div>
        
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: '#F2F4F6', borderRadius: '6px', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: '#4E5968', fontWeight: 600 }}>공공데이터 기준:</span>
          <span style={{ fontSize: '11px', color: '#3182F6', fontWeight: 700 }}>
            {buildingPurpose || '정보 없음'}
          </span>
        </div>

        {/* 건축물대장 건물 정보 */}
        {loadingBuilding ? (
          <div style={{ padding: '8px', background: '#F2F4F6', borderRadius: '8px', marginBottom: '12px', fontSize: '11px', color: '#8B95A1', textAlign: 'center' }}>
            🏗️ 건물 정보 조회 중...
          </div>
        ) : buildingInfo ? (
          <div style={{ padding: '10px 12px', background: '#F2F4F6', borderRadius: '10px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', background: '#fff', padding: '3px 8px', borderRadius: '6px', color: '#333D4B', fontWeight: 600 }}>
                🏢 {buildingInfo.totalFloors}층{buildingInfo.underFloors > 0 ? ` (B${buildingInfo.underFloors})` : ''}
              </span>
              <span style={{ fontSize: '11px', background: buildingInfo.hasElevator ? '#E8F5E9' : '#FFF3E0', padding: '3px 8px', borderRadius: '6px', color: buildingInfo.hasElevator ? '#2E7D32' : '#E65100', fontWeight: 600 }}>
                {buildingInfo.hasElevator ? `🛗 승강기 ${buildingInfo.elevatorCount}대` : '🚫 승강기 없음'}
              </span>
              {buildingInfo.builtYear && (
                <span style={{ fontSize: '11px', background: '#fff', padding: '3px 8px', borderRadius: '6px', color: '#333D4B', fontWeight: 600 }}>
                  📅 {buildingInfo.builtYear}년
                </span>
              )}
            </div>
            {buildingInfo.buildingName && (
              <div style={{ marginTop: '6px', fontSize: '10px', color: '#8B95A1' }}>
                {buildingInfo.buildingName} · {buildingInfo.structure || buildingInfo.mainPurpose}
              </div>
            )}
          </div>
        ) : null}

        {reviewCount > 0 ? (
          <div className="iw-stats">
            <div className="iw-stat-item">
              <div className="label">리뷰 평점</div>
              <div className="value-wrap">
                <span className="star">★</span>
                <span className="value">{Number(avgRating).toFixed(2)}</span>
              </div>
            </div>
            <div className="iw-divider"></div>
            <div className="iw-stat-item">
              <div className="label">총 방문록</div>
              <div className="value-wrap">
                <span className="value value--blue">{reviewCount}건</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px', background: '#F9FAFB', borderRadius: '12px', marginBottom: '16px', fontSize: '13px', color: '#8B95A1' }}>
            아직 작성된 방문록이 없어요. 👟
          </div>
        )}
        
        {isResidential && reviewCount > 0 && (
          <div style={{ marginBottom: '12px', fontSize: '11px', color: '#3182F6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>🏢</span> 상세 층/호수별 리뷰 정보 포함
          </div>
        )}

        <div className="iw-button-group">
          {reviewCount > 0 && (
            <button className="iw-button iw-button--read" onClick={() => onOpenReadList(address)}>방문록 보기</button>
          )}
          {isResidential && (
            <button 
              className="iw-button iw-button--write" 
              disabled={hasWritten}
              style={{ 
                width: reviewCount === 0 ? '100%' : 'auto',
                ...(hasWritten ? { background: '#E5E8EB', color: '#A8AFB5', cursor: 'not-allowed', border: 'none' } : {})
              }} 
              onClick={() => onOpenWriteSheet(address, lat, lng)}
            >
              {buttonText}
            </button>
          )}
        </div>
        
        {!isResidential && (
          <div style={{ 
            marginTop: '10px', 
            padding: '8px 12px', 
            background: '#FFF0F0', 
            borderRadius: '8px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px' }}>⚠️</span>
              <p style={{ margin: 0, fontSize: '11px', color: '#F04452', fontWeight: 600 }}>
                방문록 작성이 제한된 건물입니다.
              </p>
            </div>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReportTooltip(!showReportTooltip);
                }}
                title="거주용 건물이 맞는데 오류가 나나요?"
                style={{ 
                  background: '#F04452', 
                  color: '#fff', 
                  width: '18px', 
                  height: '18px', 
                  borderRadius: '50%', 
                  border: 'none', 
                  fontSize: '10px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  padding: 0,
                  lineHeight: 1
                }}
              >
                i
              </button>

              <AnimatePresence>
                {showReportTooltip && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    style={{
                      position: 'absolute',
                      bottom: '30px',
                      right: '-4px',
                      width: '180px',
                      backgroundColor: '#333D4B',
                      color: '#fff',
                      padding: '12px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      zIndex: 100,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                      pointerEvents: 'auto'
                    }}
                  >
                    <p style={{ margin: '0 0 10px 0', lineHeight: '1.5', color: '#FFFFFF', fontWeight: 400 }}>
                      거주용 건물이 맞는데 오류가 나나요? 확인 후 제보해 주시면 빠르게 수정하겠습니다.
                    </p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowReportTooltip(false);
                        onReportInaccuracy?.(address);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px',
                        background: '#3182F6',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      문의하기로 이동
                    </button>
                    {/* 화살표 */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-6px',
                      right: '7px',
                      width: 0, height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid #333D4B'
                    }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
        <div className="iw-arrow"></div>
      </div>
  );
};
