import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useAnimation, PanInfo } from "framer-motion";
import { MapPin, Heart, Eye, TrendingUp, Compass, ChevronUp, Sparkles, Map as MapIcon } from "lucide-react";
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
  onOpenReview: (review: Review) => void;
  onOpenReadList: (address: string) => void;
}

const NAV_HEIGHT = 66; 
const PEEK_HEIGHT = 76; 

export const DiscoveryBottomSheet: React.FC<DiscoveryBottomSheetProps> = ({
  reviews,
  userLocation,
  onOpenReview,
  onOpenReadList
}) => {
  const controls = useAnimation();
  const [snapState, setSnapState] = useState<'collapsed' | 'mid' | 'full'>('collapsed');
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const scrollRef = useRef<HTMLDivElement>(null);

  const SHEET_FULL_HEIGHT = windowHeight - 80; 
  const SHEET_MID_HEIGHT = windowHeight * 0.45;

  const snapPoints = useMemo(() => ({
    full: 0,
    mid: SHEET_FULL_HEIGHT - SHEET_MID_HEIGHT,
    collapsed: SHEET_FULL_HEIGHT - PEEK_HEIGHT
  }), [SHEET_FULL_HEIGHT, SHEET_MID_HEIGHT]);

  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    controls.set({ y: snapPoints.collapsed });
  }, [snapPoints.collapsed, controls]);

  const nearbyReviews = useMemo(() => {
    if (!userLocation) return reviews.slice(0, 10);
    return reviews
      .map(r => ({
        ...r,
        distance: r.lat && r.lng ? calculateDistance(userLocation.lat, userLocation.lng, r.lat, r.lng) : 999999
      }))
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, 15);
  }, [reviews, userLocation]);

  const popularPlaces = useMemo(() => {
    const groups: Record<string, { address: string, reviews: Review[], totalLikes: number }> = {};
    reviews.forEach(r => {
      const addr = r.address || r.location;
      if (!groups[addr]) groups[addr] = { address: addr, reviews: [], totalLikes: 0 };
      groups[addr].reviews.push(r);
      groups[addr].totalLikes += (r.likes || 0);
    });
    return Object.values(groups).sort((a, b) => b.totalLikes - a.totalLikes).slice(0, 10);
  }, [reviews]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const { offset, velocity } = info;
    const midPoint = (snapPoints.collapsed + snapPoints.mid) / 2;
    const fullPoint = (snapPoints.mid + snapPoints.full) / 2;

    if (velocity.y < -300 || offset.y < -100) {
      if (snapState === 'collapsed') setSheetState('mid');
      else setSheetState('full');
    } else if (velocity.y > 300 || offset.y > 100) {
      if (snapState === 'full') setSheetState('mid');
      else setSheetState('collapsed');
    } else {
      const currentY = controls.get() as any;
      if (typeof currentY === 'number') {
         if (currentY < fullPoint) setSheetState('full');
         else if (currentY < midPoint) setSheetState('mid');
         else setSheetState('collapsed');
      } else {
         controls.start(snapState);
      }
    }
  };

  const setSheetState = (state: 'collapsed' | 'mid' | 'full') => {
    setSnapState(state);
    controls.start(state, { type: "spring", damping: 25, stiffness: 200 });
  };

  return (
    <>
      <AnimatePresence>
        {snapState !== 'collapsed' && (
          <motion.div
            className="discovery-sheet__dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: snapState === 'full' ? 0.4 : 0.1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSheetState('collapsed')}
            style={{ bottom: NAV_HEIGHT, pointerEvents: snapState === 'full' ? 'auto' : 'none' }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {snapState === 'collapsed' && (
          <motion.button
            className="discovery-sheet__cta"
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            onClick={() => setSheetState('mid')}
            style={{ bottom: PEEK_HEIGHT + NAV_HEIGHT + 24 }}
          >
            <Sparkles size={18} fill="#3182F6" />
            <span>주변의 핫한 방문록 탐색</span>
            <ChevronUp size={18} strokeWidth={3} />
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
        style={{ height: SHEET_FULL_HEIGHT, bottom: NAV_HEIGHT }}
      >
        <div className="discovery-sheet__header" onClick={() => snapState === 'collapsed' ? setSheetState('mid') : setSheetState('collapsed')}>
          <div className="discovery-sheet__handle" />
          
          <div className="discovery-sheet__header-content">
            <div className="discovery-sheet__region-info">
              <div className="discovery-sheet__icon-box">
                <MapPin size={24} color="#3182F6" fill="#3182F6" />
              </div>
              <div>
                <h2 className="discovery-sheet__title">
                  {nearbyReviews[0]?.address?.split(' ').slice(0, 2).join(' ') || "주변 탐색 중"}
                </h2>
                {snapState === 'collapsed' && (
                  <p className="discovery-sheet__subtitle">
                    오늘의 추천 장소와 방문록을 확인하세요
                  </p>
                )}
              </div>
            </div>
            <div className="discovery-sheet__trend-badge">전국 트렌드</div>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className={`discovery-sheet__scroll-area ${snapState === 'full' ? 'is-full' : 'is-collapsed'}`}
        >
          <section className="discovery-sheet__section">
            <div className="discovery-sheet__section-title-box">
              <TrendingUp size={22} color="#3182F6" />
              <h3 className="discovery-sheet__section-title">인기 장소 TOP 10</h3>
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

          <section className="discovery-sheet__section">
            <div className="discovery-sheet__section-title-box">
              <Compass size={22} color="#3182F6" />
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
