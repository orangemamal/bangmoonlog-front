import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RefreshCw, Target, Map as MapIcon, Star } from "lucide-react";
import DaumPostcodeEmbed from "react-daum-postcode";
import { BottomSheet } from "../components/common/BottomSheet";
import { db } from '../services/firebase';
import {
  collection,
  getDocs,
  addDoc,
  query,
  updateDoc,
  doc,
  getDoc,
  Timestamp,
  onSnapshot,
  orderBy,
  where,
  serverTimestamp,
  DocumentData,
  QuerySnapshot,
  QueryDocumentSnapshot,
  writeBatch
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { checkEligibleForNewTitle } from "../utils/titleSystem";
import { useAuth } from "../hooks/useAuth";
import { useRecentLogs } from "../hooks/useRecentLogs";
import { useAccessControl } from "../hooks/useAccessControl";
import { ReviewDetail } from "../components/ReviewDetail";
import { deleteReview } from "../services/reviewService";
import { WelcomeModal } from "../components/home/WelcomeModal";
import { normalizeAddressDetail, normalizeBaseAddress } from "../utils/addressUtils";
import { calculateDistance } from "../utils/geoUtils";
import { Toast } from "../components/common/Toast";
import { analyzeReviewWithAI } from "../utils/gemini";
import { calculateUserStats, getMyBadges } from "../utils/BadgeLogic";

// [New Refactored Components & Hooks]
import { Review, LocationStats } from "../types/review";
import { calculateAverageRating } from "../utils/locationUtils";
import { useLocationStats } from "../hooks/useLocationStats";
import { useBuildingCheck } from "../hooks/useBuildingCheck";
import { HomeSearchBar } from "../components/home/HomeSearchBar";
import { ReviewEditor } from "../components/home/ReviewEditor";
import { AIModerationModal } from "../components/home/AIModerationModal";
import { InfoWindowPortal } from "../components/home/InfoWindowPortal";
import { compressVideo, uploadMediaToStorage, compressAndEncodeImage } from "../utils/mediaUtils";

declare global {
  interface Window {
    naver: any;
    __openWriteSheet: (address: string, lat?: number, lng?: number) => void;
    __openReadList: (address: string) => void;
    __toggleBookmark: (address: string, lat: number, lng: number) => void;
    __reportInaccuracy: (address: string) => void;
    __openInfoWindow: (stats: LocationStats, isRes: boolean, lat: number, lng: number) => void;
  }
}

export function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const { hasWatchedAd, watchAd, isAdShowing } = useAccessControl();

  // Refs for callbacks
  const isLoggedInRef = useRef(isLoggedIn);
  const userRef = useRef(user);
  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
    userRef.current = user;
  }, [isLoggedIn, user]);

  // --- States ---
  const [reviews, setReviews] = useState<Review[]>([]);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedCoord, setSelectedCoord] = useState<{ lat: number, lng: number } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isPostcodeOpen, setPostcodeOpen] = useState(false);
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isReadListOpen, setReadListOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Review Editor States
  const [ratings, setRatings] = useState({ light: 3, noise: 3, water: 3 });
  const [addressDetail, setAddressDetail] = useState("");
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [selectedImages, setSelectedImages] = useState<(File | string)[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationDistance, setVerificationDistance] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [experienceType, setExperienceType] = useState("단순 방문");
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  // AI & Map States
  const [aiStep, setAiStep] = useState<'idle' | 'analyzing' | 'passed' | 'rejected' | 'error'>('idle');
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [isLocationActive, setIsLocationActive] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoritedAddresses, setFavoritedAddresses] = useState<Set<string>>(new Set());
  const [isPanoramaOpen, setIsPanoramaOpen] = useState(false);

  // Map Refs
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const infoWindowInstance = useRef<any>(null);
  const clusterRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const isInitialNavRef = useRef(false);
  const refreshCountRef = useRef(0);

  // --- Custom Hooks ---
  const { statsMap, getLocationStats } = useLocationStats(reviews, favoritedAddresses, user?.id);
  const { checkAddress } = useBuildingCheck();
  const { addRecentLog } = useRecentLogs();

  // --- Subscriptions ---
  useEffect(() => {
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(list);
    });
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setFavoritedAddresses(new Set());
      return;
    }
    const q = query(collection(db, "bookmarks"), where("userId", "==", user.id));
    return onSnapshot(q, (snap) => {
      const set = new Set<string>();
      snap.forEach(d => set.add(normalizeBaseAddress(d.data().address)));
      setFavoritedAddresses(set);
    });
  }, [isLoggedIn, user?.id]);

  useEffect(() => {
    const log = localStorage.getItem('recent_searches_log');
    if (log) setRecentSearches(JSON.parse(log));
  }, []);

  // --- Map Methods ---
  const refreshMarkers = useCallback(async () => {
    if (!mapInstance.current) return;
    const currentCallId = ++refreshCountRef.current;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (clusterRef.current) clusterRef.current.clearMarkers();
    if ((window as any).visitCluster) (window as any).visitCluster.clearMarkers();

    const displayStats = Object.values(statsMap).filter(stats => {
      if (showFavoritesOnly) return stats.isBookmarked;
      return true;
    });

    const bookmarkMarkers: any[] = [];
    const visitMarkers: any[] = [];

    displayStats.forEach(stats => {
      const isFavMode = stats.isBookmarked && showFavoritesOnly;
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(stats.lat, stats.lng),
        map: mapInstance.current,
        icon: {
          content: isFavMode 
            ? `<div class="bookmark-marker-container"><div class="bookmark-marker-pulse"></div><div class="bookmark-marker-star"><svg viewBox="0 0 24 24" fill="#fff" width="16" height="16"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></div></div>`
            : `<div class="visit-marker-bubble"><span class="count">${stats.count > 99 ? '99+' : stats.count}</span></div>`,
          anchor: new window.naver.maps.Point(isFavMode ? 15 : 20, isFavMode ? 15 : 20),
        },
        propertyCount: stats.count
      });

      marker.addListener('click', async () => {
        mapInstance.current.panTo(marker.getPosition(), { duration: 300, easing: "linear" });
        const isRes = await checkAddress(stats.address, window.naver.maps.Service, marker.getPosition());
        window.__openInfoWindow(stats, isRes, stats.lat, stats.lng);
      });

      if (isFavMode) bookmarkMarkers.push(marker);
      else visitMarkers.push(marker);
      markersRef.current.push(marker);
    });

    const clusterOptions = (isBookmark: boolean) => ({
      map: mapInstance.current,
      minClusterSize: 2,
      maxZoom: 18,
      disableClickZoom: true,
      gridSize: 80,
      icons: [{ content: `<div class="cluster-base ${isBookmark ? 'cluster-bookmark' : 'cluster-s'}"><div></div></div>`, size: new window.naver.maps.Size(40, 40), anchor: new window.naver.maps.Point(20, 20) }],
      stylingFunction: (clusterMarker: any, count: number) => {
        const el = clusterMarker.getElement();
        el.onclick = (e: MouseEvent) => {
          e.stopPropagation();
          const currentClusterer = isBookmark ? clusterRef.current : (window as any).visitCluster;
          if (!currentClusterer) return;
          const clusterObj = currentClusterer._clusters.find((c: any) => c._clusterMarker === clusterMarker);
          const center = clusterObj ? clusterObj.getCenter() : clusterMarker.getPosition();
          mapInstance.current.morph(center, Math.max(mapInstance.current.getZoom() + 2, 17));
        };
        const div = el.querySelector('div');
        if (div) {
          const currentClusterer = isBookmark ? clusterRef.current : (window as any).visitCluster;
          const clusterObj = currentClusterer?._clusters.find((c: any) => c._clusterMarker === clusterMarker);
          if (clusterObj) {
            const members = clusterObj.getClusterMember();
            const totalSum = members.reduce((acc: number, m: any) => acc + (m.propertyCount || 0), 0);
            div.innerText = totalSum > 999 ? "999+" : totalSum;
          }
        }
      }
    });

    clusterRef.current = new window.MarkerClustering({ ...clusterOptions(true), markers: bookmarkMarkers });
    if (!showFavoritesOnly) {
      (window as any).visitCluster = new window.MarkerClustering({ ...clusterOptions(false), markers: visitMarkers });
    }
  }, [statsMap, showFavoritesOnly, checkAddress]);

  useEffect(() => {
    refreshMarkers();
  }, [refreshMarkers]);

  // --- Initial Setup ---
  useEffect(() => {
    if (!window.naver?.maps || !mapElement.current || mapInstance.current) return;

    const initialCenter = new window.naver.maps.LatLng(37.5665, 126.9780);
    mapInstance.current = new window.naver.maps.Map(mapElement.current, {
      center: initialCenter, zoom: 14, zoomControl: false, scaleControl: false, logoControl: false, mapDataControl: false,
      disableKineticPan: true, tileTransition: false,
    });

    infoWindowInstance.current = new window.naver.maps.InfoWindow({
      content: "", backgroundColor: "transparent", borderWidth: 0, disableAnchor: true, pixelOffset: new window.naver.maps.Point(0, -24),
    });

    // Handle clicks for new places
    window.naver.maps.Event.addListener(mapInstance.current, "click", async (e: any) => {
      const clickedPos = e.coord.clone ? e.coord.clone() : new window.naver.maps.LatLng(e.coord.y, e.coord.x);
      if (mapInstance.current.getZoom() < 19) {
        mapInstance.current.morph(clickedPos, 19, { duration: 300 });
        return;
      }
      
      // Check address
      window.naver.maps.Service.reverseGeocode({ coords: clickedPos, orders: "roadaddr,addr" }, async (status: any, res: any) => {
        if (status !== window.naver.maps.Service.Status.OK) return;
        const rawAddr = res.v2?.address?.roadAddress || res.v2?.address?.jibunAddress;
        if (!rawAddr) return;
        
        const addr = normalizeBaseAddress(rawAddr);
        const stats = getLocationStats(addr) || { address: addr, lat: clickedPos.lat(), lng: clickedPos.lng(), count: 0, avgRating: 0, isBookmarked: favoritedAddresses.has(addr), hasWritten: false };
        const isRes = await checkAddress(addr, window.naver.maps.Service, clickedPos);
        window.__openInfoWindow(stats, isRes, clickedPos.lat(), clickedPos.lng());
      });
    });

    // 2. 사용자의 GPS 위치 실시간 추적 및 마커 표시
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition((pos) => {
        const { latitude: userLat, longitude: userLng } = pos.coords;
        const userPos = new window.naver.maps.LatLng(userLat, userLng);

        if (!isInitialNavRef.current && !userMarkerRef.current) {
          mapInstance.current.setCenter(userPos);
          mapInstance.current.setZoom(17);
        }

        if (userMarkerRef.current) {
          userMarkerRef.current.setPosition(userPos);
        } else {
          userMarkerRef.current = new window.naver.maps.Marker({
            position: userPos,
            map: mapInstance.current,
            icon: {
              content: `<div class="user-location-marker"><div class="user-location-pulse"></div><div class="user-location-dot"></div></div>`,
              anchor: new window.naver.maps.Point(12, 12),
            },
            clickable: false, zIndex: 100
          });
        }
      }, null, { enableHighAccuracy: true });
    }

    // Expose global methods
    window.__openWriteSheet = (addr, lat, lng) => {
      if (!isLoggedInRef.current) { navigate('/mypage'); return; }
      setSelectedAddress(addr);
      if (lat && lng) setSelectedCoord({ lat, lng });
      setSheetOpen(true);
    };

    window.__openReadList = (addr) => {
      setSelectedAddress(addr);
      setReadListOpen(true);
    };

    window.__toggleBookmark = async (addr, lat, lng) => {
      if (!isLoggedInRef.current) { navigate('/mypage'); return; }
      const normalizedAddr = normalizeBaseAddress(addr);
      const bookmarkId = `bookmark_${userRef.current.id}_${normalizedAddr.replace(/\s+/g, '_')}`;
      const bRef = doc(db, "bookmarks", bookmarkId);
      const bSnap = await getDoc(bRef);
      if (bSnap.exists()) {
        await writeBatch(db).delete(bRef).commit();
      } else {
        await addDoc(collection(db, "bookmarks"), { userId: userRef.current.id, address: normalizedAddr, lat, lng, createdAt: Timestamp.now() });
      }
    };

  }, [getLocationStats, favoritedAddresses, navigate, checkAddress]);

  // --- Handlers ---
  const handleSubmitReview = async () => {
    if (!selectedAddress || !selectedCoord || isSubmitting) return;
    setIsSubmitting(true);
    setAiStep('analyzing');
    
    try {
      const aiResult = await analyzeReviewWithAI(comment);
      if (!aiResult.isPassed) {
        setAiStep('rejected');
        setAiReason(aiResult.reason || "부적절한 내용입니다.");
        setIsSubmitting(false);
        return;
      }

      setAiStep('passed');
      const imageUrls = await Promise.all(selectedImages.map(async file => {
        if (typeof file === 'string') return file;
        return file.type.startsWith('video/') ? await uploadMediaToStorage(await compressVideo(file)) : await compressAndEncodeImage(file);
      }));

      const reviewData = {
        address: normalizeBaseAddress(selectedAddress),
        addressDetail: normalizeAddressDetail(addressDetail),
        content: comment,
        ratings,
        tags: selectedTags,
        images: imageUrls,
        experienceType,
        lat: selectedCoord.lat,
        lng: selectedCoord.lng,
        author: user?.name || "익명",
        authorId: user?.id,
        createdAt: Timestamp.now(),
        likes: 0, views: 0
      };

      await addDoc(collection(db, "reviews"), reviewData);
      setSheetOpen(false); setComment(""); setAddressDetail(""); setSelectedTags([]); setSelectedImages([]);
      setIsSubmitting(false); setAiStep('idle');
    } catch (e) {
      console.error(e);
      setAiStep('error');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-home">
      <HomeSearchBar 
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        isHistoryOpen={isHistoryOpen} setIsHistoryOpen={setIsHistoryOpen}
        recentSearches={recentSearches} setRecentSearches={setRecentSearches}
        onOpenPostcode={() => setPostcodeOpen(true)}
        onSearchEnter={(term) => {
          window.naver.maps.Service.geocode({ query: term }, (status: any, res: any) => {
            if (status === window.naver.maps.Service.Status.OK && res.v2.addresses.length > 0) {
              const item = res.v2.addresses[0];
              const pos = new window.naver.maps.LatLng(item.y, item.x);
              mapInstance.current.setCenter(pos);
              mapInstance.current.setZoom(19);
            }
          });
        }}
      />

      <div className="home-map-container" ref={mapElement}></div>

      {/* Map Controls */}
      <div className="map-controls-right">
        <button className={`control-btn ${isLocationActive ? 'active' : ''}`} onClick={() => setIsLocationActive(!isLocationActive)}>
          <Target size={24} color={isLocationActive ? "#3182F6" : "#4E5968"} />
        </button>
        <button className={`control-btn ${showFavoritesOnly ? 'active' : ''}`} onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}>
          <Star size={24} color={showFavoritesOnly ? "#8B5CF6" : "#4E5968"} fill={showFavoritesOnly ? "#8B5CF6" : "none"} />
        </button>
      </div>

      <InfoWindowPortal 
        map={mapInstance.current}
        infoWindow={infoWindowInstance.current}
        onRead={window.__openReadList}
        onWrite={window.__openWriteSheet}
        onToggleBookmark={window.__toggleBookmark}
        onReport={window.__reportInaccuracy}
      />

      <BottomSheet isOpen={isSheetOpen} onClose={() => !isSubmitting && setSheetOpen(false)} title="방문록 작성">
        <ReviewEditor 
          editingReviewId={editingReviewId} selectedAddress={selectedAddress} isVerified={isVerified} verificationDistance={verificationDistance} isVerifying={isVerifying}
          onVerifyLocation={() => {}} experienceType={experienceType} setExperienceType={setExperienceType}
          selectedImages={selectedImages} setSelectedImages={setSelectedImages} addressDetail={addressDetail} setAddressDetail={setAddressDetail}
          comment={comment} setComment={setComment} ratings={ratings} setRatings={setRatings}
          selectedTags={selectedTags} setSelectedTags={setSelectedTags} customTag={customTag} setCustomTag={setCustomTag}
          onAddCustomTag={() => {}} isSubmitting={isSubmitting} onSubmit={handleSubmitReview} setViewerImage={setViewerImage} tags={[]}
        />
      </BottomSheet>

      {isPostcodeOpen && (
        <div className="postcode-modal-overlay" onClick={() => setPostcodeOpen(false)}>
          <div className="postcode-modal-content" onClick={e => e.stopPropagation()}>
            <div className="postcode-header">
              <h3>주소 검색</h3>
              <button onClick={() => setPostcodeOpen(false)}>닫기</button>
            </div>
            <DaumPostcodeEmbed onComplete={(data: any) => {
              setSearchQuery(data.address);
              setPostcodeOpen(false);
              window.naver.maps.Service.geocode({ query: data.address }, (status: any, res: any) => {
                if (status === window.naver.maps.Service.Status.OK && res.v2.addresses.length > 0) {
                  const item = res.v2.addresses[0];
                  const pos = new window.naver.maps.LatLng(item.y, item.x);
                  mapInstance.current.setCenter(pos);
                  mapInstance.current.setZoom(19);
                }
              });
            }} autoClose={false} defaultQuery={searchQuery} className="postcode-embed" />
          </div>
        </div>
      )}

      <AIModerationModal aiStep={aiStep} aiReason={aiReason} onClose={() => setAiStep('idle')} />
      {showWelcomeModal && <WelcomeModal onClose={() => setShowWelcomeModal(false)} />}
    </div>
  );
}
