import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence, useAnimation, PanInfo, useMotionValue } from "framer-motion";
import { MapPin, Heart, Eye, TrendingUp, Compass, ChevronUp, Sparkles, Map as MapIcon, Shield, Accessibility } from "lucide-react";
import { calculateDistance } from "../../utils/geoUtils";

interface Review {
  id: string;
  author: string;
  lat?: number;
  lng?: number;
  location: string;
  address?: string;
  content: string;
  images: string[];
  likes: number;
  views: number;
  ratings: { light: number; noise: number; water: number };
  createdAt?: any;
}

interface DiscoveryBottomSheetProps {
  reviews: Review[];
  userLocation: { lat: number, lng: number } | null;
  mapCenter?: { lat: number, lng: number } | null;
  regionName?: string | null;
  aiInsight?: { score: number, text: string, source?: string } | null;
  isAnalyzing?: boolean;
  aiSafetyInsight?: { score: number, text: string, source?: string } | null;
  isAnalyzingSafety?: boolean;
  aiBarrierFreeInsight?: { score: number, text: string, source?: string } | null;
  isAnalyzingBarrierFree?: boolean;
  onOpenReview: (review: Review) => void;
  onOpenReadList: (address: string) => void;
  onStateChange?: (state: 'collapsed' | 'full') => void;
}

// 상수 정의 - 네비게이션 및 여백 최적화
const NAV_HEIGHT = 88; // 하단 푸터 높이 (더 넉넉하게)
const PEEK_HEIGHT = 88; // 최소화 시 노출될 높이 (네이버 지도 스타일)

export const DiscoveryBottomSheet: React.FC<DiscoveryBottomSheetProps> = ({
  reviews,
  userLocation,
  mapCenter,
  regionName,
  aiInsight,
  isAnalyzing,
  aiSafetyInsight,
  isAnalyzingSafety,
  aiBarrierFreeInsight,
  isAnalyzingBarrierFree,
  onOpenReview,
  onOpenReadList,
  onStateChange
}) => {
  const controls = useAnimation();
  const [snapState, setSnapState] = useState<'collapsed' | 'full'>('collapsed');
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const scrollRef = useRef<HTMLDivElement>(null);

  // y 위치를 추적하기 위한 MotionValue
  const y = useMotionValue(0);

  // 시트의 실제 최대 높이 계산 (상단 여백을 주어 원페이지 느낌 강조)
  const SHEET_FULL_HEIGHT = windowHeight - 90;
  const SHEET_MID_HEIGHT = windowHeight * 0.5; // 50vh 기준

  // 스냅 포인트 좌표 계산 (y축 이동량)
  const snapPoints = useMemo(() => ({
    full: 0,
    collapsed: SHEET_FULL_HEIGHT - PEEK_HEIGHT
  }), [SHEET_FULL_HEIGHT]);

  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 초기 위치 설정
  useEffect(() => {
    y.set(snapPoints.collapsed);
    controls.set({ y: snapPoints.collapsed });
  }, [snapPoints.collapsed, controls, y]);

  // 성능 최적화: 주변 리뷰 계산 (리뷰가 많을 경우 연산 부하 방지)
  const nearbyReviews = useMemo(() => {
    // 탐색 기준 좌표 결정: 지도 중심을 우선하고, 없으면 사용자 위치 사용
    const baseLocation = mapCenter || userLocation;

    if (!baseLocation || !reviews.length) return reviews.slice(0, 10);

    // 거리 계산 및 정렬 (최적화된 방식)
    return [...reviews]
      .map(r => {
        const dist = r.lat && r.lng ? calculateDistance(baseLocation.lat, baseLocation.lng, r.lat, r.lng) : 999999;
        return { ...r, distance: dist };
      })
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, 10); // 상위 10개만 노출하여 렌더링 부하 감소
  }, [reviews, userLocation, mapCenter]);

  // 성능 최적화: 인기 장소 계산
  const popularPlaces = useMemo(() => {
    if (!reviews.length) return [];
    const groups: Record<string, { address: string, reviews: Review[], totalLikes: number }> = {};

    // 단일 루프로 그룹화 및 집계
    for (const r of reviews) {
      const addr = r.address || r.location;
      if (!groups[addr]) groups[addr] = { address: addr, reviews: [], totalLikes: 0 };
      groups[addr].reviews.push(r);
      groups[addr].totalLikes += (r.likes || 0);
    }

    return Object.values(groups)
      .sort((a, b) => b.totalLikes - a.totalLikes)
      .slice(0, 10);
  }, [reviews]);

  // 네이버 지도 스타일의 50vh 스냅 로직
  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const { velocity } = info;
    const currentY = y.get();

    // 1. 속도 기반 스냅 (빠르게 던질 때)
    if (velocity.y < -500) {
      setSheetState('full');
      return;
    }
    if (velocity.y > 500) {
      setSheetState('collapsed');
      return;
    }

    // 2. 위치 기반 스냅 (화면 50% 기준)
    // 시트가 화면의 절반 이상 올라왔는지 체크 (visibleHeight > 50vh)
    const visibleHeight = SHEET_FULL_HEIGHT - currentY;
    const threshold = windowHeight * 0.5;

    if (visibleHeight > threshold) {
      setSheetState('full');
    } else {
      setSheetState('collapsed');
    }
  }, [snapPoints, controls, windowHeight, SHEET_FULL_HEIGHT, y]);

  const setSheetState = (state: 'collapsed' | 'full') => {
    setSnapState(state);
    onStateChange?.(state);
    controls.start({
      y: snapPoints[state],
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 180,
        mass: 0.8
      }
    });
  };

  return (
    <>
      {/* Background Dim - 제거됨 */}

      {/* Floating CTA - 네이버 지도 스타일의 세련된 디자인 */}
      <AnimatePresence>
        {snapState === 'collapsed' && (
          <motion.button
            className="discovery-sheet__cta"
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            onClick={() => setSheetState('full')}
            style={{ bottom: PEEK_HEIGHT + (snapState === 'full' ? 0 : NAV_HEIGHT) + 20 }}
          >
            <Sparkles size={16} fill="#8B5CF6" color="#8B5CF6" className={isAnalyzing ? "animate-spin-slow" : ""} />
            <span>AI 지역 리포트 보기</span>
            <ChevronUp size={16} strokeWidth={3} />
          </motion.button>
        )}
      </AnimatePresence>

      <motion.div
        className="discovery-sheet"
        drag="y"
        dragConstraints={{ top: snapPoints.full, bottom: snapPoints.collapsed }}
        dragElastic={0.05}
        animate={controls}
        onDragEnd={handleDragEnd}
        style={{
          height: SHEET_FULL_HEIGHT,
          bottom: snapState === 'full' ? 0 : NAV_HEIGHT,
          y
        }}
      >
        {/* Drag Handle & Header (Sticky) */}
        <div
          className="discovery-sheet__header"
          onClick={() => snapState === 'collapsed' ? setSheetState('full') : setSheetState('collapsed')}
        >
          <div className="discovery-sheet__handle" />

          <div className="discovery-sheet__header-content">
            <div className="discovery-sheet__region-info">
              <div className="discovery-sheet__icon-box ai-engine-icon">
                <Compass size={24} color="#fff" />
              </div>
              <div>
                <h2 className="discovery-sheet__title">
                  {regionName || "주변 탐색 중"}
                </h2>
                <div className="discovery-sheet__ai-trust-badge">
                  <span className="dot pulse" />
                  AI가 공공데이터 • 방문록 분석 중
                </div>
              </div>
            </div>

            <div className={`discovery-sheet__ai-badge ${isAnalyzing ? 'is-loading' : ''}`}>
              {isAnalyzing ? (
                <><span className="pulse-dot" /> AI LIVE</>
              ) : (
                <><Sparkles size={12} fill="#8B5CF6" /> AI READY</>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div
          ref={scrollRef}
          className={`discovery-sheet__scroll-area ${snapState === 'full' ? 'is-full' : 'is-collapsed'}`}
        >
          {/* [신규] AI 주거 인사이트 컨테이너 (가로 스크롤 카드 시스템) */}
          {snapState === 'full' && (
            <section className="discovery-sheet__section discovery-sheet__ai-insight">
              <div className="ai-insight-scroll-container">
                {/* 1. 출퇴근 리포트 카드 */}
                <div className="ai-insight-card commute-card">
                  <div className="ai-insight-header">
                    <div className="ai-tag">
                      <Sparkles size={14} fill="#8B5CF6" color="#8B5CF6" className={isAnalyzing ? "animate-spin-slow" : ""} />
                      <span>AI 출퇴근 리포트</span>
                    </div>
                    {!isAnalyzing && aiInsight && (
                      <div
                        className="ai-score-badge"
                        style={{
                          color: aiInsight.score >= 80 ? '#3182F6' : '#FF9500',
                          background: aiInsight.score >= 80 ? '#E8F3FF' : '#FFF4E5'
                        }}
                      >
                        쾌적도 {aiInsight.score}점
                      </div>
                    )}
                  </div>

                  <div className="ai-insight-content">
                    <h4 className="ai-insight-title">
                      {isAnalyzing ? "AI 분석 엔진 가동 중..." : "출퇴근 꿀단지 리포트"}
                    </h4>
                    <div className={`ai-insight-text ${isAnalyzing ? 'is-loading' : ''}`}>
                      {isAnalyzing ? (
                        <div className="skeleton-text">
                          <div className="skeleton-line" />
                          <div className="skeleton-line short" />
                        </div>
                      ) : (
                        aiInsight?.text || "주변 교통 정보를 분석하고 있습니다."
                      )}
                    </div>
                  </div>

                  <div className="ai-insight-footer">
                    <div className="ai-data-source">
                      <div className="source-label">데이터 소스</div>
                      <div className="source-value">
                        {isAnalyzing ? "교통 API & 방문록 융합 중..." : (aiInsight?.source || `교통 API + 방문록 분석`)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. 안심 귀가 리포트 카드 (2번 과제) */}
                <div className="ai-insight-card safety-card">
                  <div className="ai-insight-header">
                    <div className="ai-tag">
                      <Shield size={14} fill="#00D084" color="#00D084" className={isAnalyzingSafety ? "animate-pulse" : ""} />
                      <span>AI 안심 귀가 리포트</span>
                    </div>
                    {!isAnalyzingSafety && aiSafetyInsight && (
                      <div
                        className="ai-score-badge"
                        style={{
                          color: aiSafetyInsight.score >= 80 ? '#00D084' : '#FF5722',
                          background: aiSafetyInsight.score >= 80 ? '#E6FBF3' : '#FFF0EB'
                        }}
                      >
                        안심 지수 {aiSafetyInsight.score}점
                      </div>
                    )}
                  </div>

                  <div className="ai-insight-content">
                    <h4 className="ai-insight-title">
                      {isAnalyzingSafety ? "치안 데이터를 분석 중입니다..." : "이 동네, 밤에 안전할까요?"}
                    </h4>
                    <div className={`ai-insight-text ${isAnalyzingSafety ? 'is-loading' : ''}`}>
                      {isAnalyzingSafety ? (
                        <div className="skeleton-text">
                          <div className="skeleton-line" />
                          <div className="skeleton-line short" />
                        </div>
                      ) : (
                        aiSafetyInsight?.text || "주변 안심 정보를 분석하고 있습니다."
                      )}
                    </div>
                  </div>

                  <div className="ai-insight-footer">
                    <div className="ai-data-source">
                      <div className="source-label">데이터 소스</div>
                      <div className="source-value">
                        {isAnalyzingSafety ? "CCTV API & 방문록 융합 중..." : (aiSafetyInsight?.source || `CCTV API + 방문록 분석`)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. 배리어 프리 리포트 카드 (신규 과제) */}
                <div className="ai-insight-card barrier-free-card">
                  <div className="ai-insight-header">
                    <div className="ai-tag">
                      <Accessibility size={14} fill="#3182F6" color="#3182F6" className={isAnalyzingBarrierFree ? "animate-bounce" : ""} />
                      <span>AI 배리어 프리 리포트</span>
                    </div>
                    {!isAnalyzingBarrierFree && aiBarrierFreeInsight && (
                      <div
                        className="ai-score-badge"
                        style={{
                          color: aiBarrierFreeInsight.score >= 80 ? '#3182F6' : '#FF9500',
                          background: aiBarrierFreeInsight.score >= 80 ? '#E8F3FF' : '#FFF4E5'
                        }}
                      >
                        이동 지수 {aiBarrierFreeInsight.score}점
                      </div>
                    )}
                  </div>

                  <div className="ai-insight-content">
                    <h4 className="ai-insight-title">
                      {isAnalyzingBarrierFree ? "보행 환경을 분석 중입니다..." : "휠체어·유모차도 편할까요?"}
                    </h4>
                    <div className={`ai-insight-text ${isAnalyzingBarrierFree ? 'is-loading' : ''}`}>
                      {isAnalyzingBarrierFree ? (
                        <div className="skeleton-text">
                          <div className="skeleton-line" />
                          <div className="skeleton-line short" />
                        </div>
                      ) : (
                        aiBarrierFreeInsight?.text || "주변 보행 환경 정보를 분석하고 있습니다."
                      )}
                    </div>
                  </div>

                  <div className="ai-insight-footer">
                    <div className="ai-data-source">
                      <div className="source-label">데이터 소스</div>
                      <div className="source-value">
                        {isAnalyzingBarrierFree ? "인프라 API & 방문록 융합 중..." : (aiBarrierFreeInsight?.source || `인프라 API + 방문록 분석`)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section: 인기 장소 TOP 10 */}
          <section className="discovery-sheet__section">
            <div className="discovery-sheet__section-title-box">
              <TrendingUp size={20} color="#3182F6" />
              <h3 className="discovery-sheet__section-title">지금 인기 있는 장소</h3>
            </div>

            <div className="discovery-sheet__popular-list">
              {popularPlaces.map((place, idx) => (
                <motion.div
                  key={place.address}
                  className="discovery-sheet__card"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onOpenReadList(place.address)}
                >
                  <div className="discovery-sheet__card-thumb">
                    {place.reviews[0]?.images[0] ? (
                      <img
                        src={place.reviews[0].images[0]}
                        alt={place.address}
                        loading="lazy"
                        onError={(e) => {
                          (e.target as any).style.display = 'none';
                          (e.target as any).parentElement.style.background = 'linear-gradient(135deg, #F2F4F6 0%, #E5E8EB 100%)';
                        }}
                      />
                    ) : (
                      <MapIcon size={32} color="#ADB5BD" />
                    )}
                    <div className="discovery-sheet__card-rank">{idx + 1}</div>
                  </div>
                  <div className="discovery-sheet__card-info">
                    <p className="discovery-sheet__card-address">{place.address}</p>
                    <div className="discovery-sheet__card-stats">
                      <span><Heart size={12} fill="#F04452" color="#F04452" /> {place.totalLikes}</span>
                      <span className="divider">|</span>
                      <span>리뷰 {place.reviews.length}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Section: 실시간 주변 소식 */}
          <section className="discovery-sheet__section">
            <div className="discovery-sheet__section-title-box">
              <Compass size={20} color="#3182F6" />
              <h3 className="discovery-sheet__section-title">실시간 주변 소식</h3>
            </div>

            <div className="discovery-sheet__feed-list">
              {nearbyReviews.map((review) => (
                <motion.div
                  key={review.id}
                  className="discovery-sheet__feed-item"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onOpenReview(review)}
                >
                  <div className="discovery-sheet__feed-item-thumb">
                    {review.images[0] ? (
                      <img
                        src={review.images[0]}
                        alt="review"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as any).style.display = 'none';
                          (e.target as any).parentElement.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#F2F4F6"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ADB5BD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg></div>';
                        }}
                      />
                    ) : (
                      <Sparkles size={24} color="#ADB5BD" />
                    )}
                  </div>
                  <div className="discovery-sheet__feed-item-content">
                    <h4 className="discovery-sheet__feed-item-addr">{review.address || review.location}</h4>
                    <p className="discovery-sheet__feed-item-text">{review.content}</p>
                    <div className="discovery-sheet__feed-item-footer">
                      <div className="stat">
                        <Heart size={14} fill={review.likes > 0 ? "#F04452" : "none"} color={review.likes > 0 ? "#F04452" : "#8B95A1"} /> {review.likes}
                      </div>
                      <div className="stat">
                        <Eye size={14} /> {review.views}
                      </div>
                      <span className="distance">
                        {typeof (review as any).distance === 'number' ? `${((review as any).distance / 1000).toFixed(1)}km` : ''}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      </motion.div>
    </>
  );
};
