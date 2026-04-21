import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Camera, Star, CheckCircle2, Heart, Eye, ArrowLeft, Search, X, XCircle, Plus, RefreshCw, MoreHorizontal, Pencil, Trash2, MapPin, Map as MapIcon, Home as HomeIcon, ClipboardCheck, Image as ImageIcon, MessageSquare, Tag, Crosshair } from "lucide-react";
import DaumPostcodeEmbed from "react-daum-postcode";
import { BottomSheet } from "../components/common/BottomSheet";
import { db, storage } from '../services/firebase';
import {
  collection,
  getDocs,
  addDoc,
  query,
  updateDoc,
  setDoc,
  writeBatch,
  Timestamp,
  onSnapshot,
  where,
  DocumentData,
  QuerySnapshot,
  QueryDocumentSnapshot,
  doc,
  getDoc,
  serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { checkEligibleForNewTitle } from "../utils/titleSystem";
import { useAuth } from "../hooks/useAuth";
import { handleNaverCallback } from "../services/authService";
import { useRecentLogs } from "../hooks/useRecentLogs";
import { useAccessControl } from "../hooks/useAccessControl";
import { ReviewDetail } from "../components/ReviewDetail";
import { deleteReview } from "../services/reviewService";
import { WelcomeModal } from "../components/home/WelcomeModal";
import { normalizeAddressDetail, formatAddressDetail, normalizeBaseAddress } from "../utils/addressUtils";
import { calculateDistance } from "../utils/geoUtils";
import { Toast } from "../components/common/Toast";
import LogoImg from "../assets/images/favicon.svg";

interface Review {
  id: string;
  author: string;
  authorId?: string;
  lat?: number;
  lng?: number;
  date: string;
  location: string;
  addressDetail?: string;
  content: string;
  images: string[];
  likes: number;
  views: number;
  tags: string[];
  ratings: { light: number; noise: number; water: number };
  createdAt?: Timestamp;
  isVerified?: boolean;
  distance?: number;
  experienceType?: string;
  address?: string;
}


// 주소 정규화 유틸리티는 ../utils/addressUtils의 normalizeBaseAddress를 사용합니다.

// [유틸리티] 거주용 건물 여부 판단 (비거주 시설 필터링)
// [유틸리티] 거주용 건물 여부 판단 (비거주 시설 필터링 고도화)
const checkIsResidential = (addr: string) => {
  if (!addr) return false;

  // 1. 명백한 주거용 키워드 (화이트리스트 - 오탐 방지)
  const whiteList = [
    "아파트", "빌라", "맨션", "주택", "오피스텔", "다세대", "다가구", "원룸",
    "투룸", "고시원", "고시텔", "빌리지", "리빙텔", "캐슬", "파크뷰", "단지", "전원", "다중"
  ];
  if (whiteList.some(keyword => addr.includes(keyword))) return true;

  // 2. 명백한 비거주지 강력 블랙리스트 (단어 포함 시 즉시 차단)
  const strongBlacklist = [
    "지하철", "지하상가", "지하쇼핑", "가로판매대", "구두수선", "지하차도", "보도육교",
    "공영주차장", "공공주차장", "환승센터", "지하역사", "역사내"
  ];
  if (strongBlacklist.some(keyword => addr.includes(keyword))) return false;

  // 3. 절대 거주할 수 없는 명백한 공공/시설 블랙리스트 (최소화)
  const infrastructureBlacklist = [
    "역", "출구", "공원", "광장", "교차로", "숲", "유원지", "산", "계곡",
    "지하철", "역사내", "승강장", "환승센터", "터미널", "공항", "시장",
    "경찰서", "파출소", "소방서", "우체국", "시청", "구청", "동주민센터",
    "궁", "문화재", "유적지", "능", "단", "묘", "성곽", "경기장", "운동장"
  ];

  // 4. 패턴 기반 차단 (단어 자체가 독립적으로 쓰일 때만 차단)
  const isBlocked = infrastructureBlacklist.some(keyword => {
    // 예: '서울역', '올림픽공원' 등 명백한 경우만 차단
    const regex = new RegExp(`(^|\\s)${keyword}($|\\s|\\d)`);
    return regex.test(addr);
  });

  // 5. 특정 고유명사 직접 차단 (경복궁, 롯데월드 등)
  const specificLandmarks = [
    "경복궁", "창덕궁", "덕수궁", "창경궁", "종묘", "남산타워", "서울타워",
    "어린이대공원", "올림픽공원", "서울숲", "월드컵공원", "한강공원"
  ];
  if (specificLandmarks.some(name => addr.includes(name))) return false;

  return !isBlocked;
};

// [유틸리티] 건축물대장 API를 통한 실시간 주거용 확인
const checkBuildingRegistry = async (sigunguCd: string, bjdongCd: string, bun: string, ji: string) => {
  try {
    const res = await fetch(`/api/getBuildingInfo?sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&bun=${bun}&ji=${ji}`);
    if (!res.ok) return null;
    
    // JSON 응답인지 확인 (HTML 에러 페이지가 올 경우 대비)
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.warn("Building registry API returned non-JSON response (maybe 404 or not deployed yet)");
      return null;
    }

    const data = await res.json();
    return data.isResidential; // true: 주거용, false: 비주거용, null: 데이터 없음/오류
  } catch (e) {
    console.error("Building registry check failed:", e);
    return null;
  }
};

declare global {
  interface Window {
    naver: any;
    __openWriteSheet: (address: string, lat?: number, lng?: number) => void;
    __openReadList: (address: string) => void;
    __toggleBookmark: (address: string, lat: number, lng: number) => void;
    __reportInaccuracy: (address: string) => void;
  }
}
// [유틸리티] 이미지 로컬 압축 및 Base64 변환 (Firestore 저장용)
const compressAndEncodeImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 800; // 가로/세로 최대 800px로 제한 (용량 최적화)
        if (width > height) { if (width > max) { height *= max / width; width = max; } }
        else { if (height > max) { width *= max / height; height = max; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); // 품질 0.6으로 압축 (데이터량 대폭 감소)
      };
    };
  });
};

// [유틸리티] 비디오 및 대용량 파일용 Firebase Storage 업로드
const uploadMediaToStorage = async (file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `media_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const storageRef = ref(storage, `reviews/${fileName}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};
interface InfoWindowParams {
  address: string;
  lat: number;
  lng: number;
  isBookmarked: boolean;
  isResidential: boolean;
  reviewCount: number;
  avgRating: number;
  hasWritten: boolean;
}

const getInfoWindowMarkup = ({ address, lat, lng, isBookmarked, isResidential, reviewCount, avgRating, hasWritten }: InfoWindowParams) => {
  const buttonText = hasWritten ? "작성 완료" : "방문록 쓰기";
  const disabledAttr = hasWritten ? "disabled style='background:#E5E8EB; color:#A8AFB5; cursor:not-allowed; border:none;'" : "";

  return `
    <div class="iw-container marker">
      <div class="iw-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div class="iw-title" style="margin-bottom:0;">이 공간의 방문록</div>
          ${isResidential ? `
          <button class="iw-bookmark-icon-btn ${isBookmarked ? 'active' : ''}" onclick="window.__toggleBookmark('${address}', ${lat}, ${lng})">
            <svg width="24" height="24" viewBox="0 0 24 24" 
              fill="${isBookmarked ? '#FFD43B' : 'none'}" 
              stroke="${isBookmarked ? '#FFD43B' : '#A8AFB5'}" 
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
          </button>` : ''}
        </div>
        <div class="iw-address"><span>📍</span><span>${address}</span></div>
        
        ${reviewCount > 0 ? `
          <div class="iw-stats">
            <div class="iw-stat-item"><div class="label">리뷰 평점</div><div class="value-wrap"><span class="star">★</span><span class="value">${Number(avgRating).toFixed(2)}</span></div></div>
            <div class="iw-divider"></div>
            <div class="iw-stat-item"><div class="label">총 방문록</div><div class="value-wrap"><span class="value value--blue">${reviewCount}건</span></div></div>
          </div>
        ` : `
          <div style="text-align:center; padding:16px; background:#F9FAFB; border-radius:12px; margin-bottom:16px; font-size:13px; color:#8B95A1;">
            아직 작성된 방문록이 없어요. 👟
          </div>
        `}
        
        ${isResidential && reviewCount > 0 ? `<div style="margin-bottom:12px; font-size:11px; color:#3182F6; font-weight:600; display:flex; align-items:center; gap:4px;">
          <span>🏢</span> 상세 층/호수별 리뷰 정보 포함
        </div>` : ''}

        <div class="iw-button-group">
          ${reviewCount > 0 ? `<button class="iw-button iw-button--read" onclick="window.__openReadList('${address}')">방문록 보기</button>` : ''}
          ${isResidential ? `<button class="iw-button iw-button--write" ${disabledAttr} style="${reviewCount === 0 ? 'width:100%;' : ''}" onclick="window.__openWriteSheet('${address}', ${lat}, ${lng})">${buttonText}</button>` : ''}
        </div>
        
        ${!isResidential ? `<div style="margin-top:12px; padding:10px; background:#FFF0F0; border-radius:8px; display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
             <div style="display:flex; gap:6px; align-items:flex-start;">
               <span style="font-size:14px;">🏠</span>
               <p style="margin:0; font-size:11px; color:#F04452; font-weight:600; line-height:1.4;">거주용 건물이 아니므로<br/>방문록 작성이 제한됩니다.</p>
             </div>
             <button onclick="window.open('/support?type=report&addr=${encodeURIComponent(address)}', '_blank')" 
               style="margin-top:6px; background:none; border:none; color:#8B95A1; font-size:10px; text-decoration:underline; cursor:pointer; padding:0;">
               거주용 건물이 맞는데 오류가 나나요?
             </button>
           </div>` : ''}
        <div class="iw-arrow"></div>
      </div>
    </div>
  `;
};

export function Home() {
  console.log("🏠 [Home] Component Rendering");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();

  // 콜백 내 최신 상태 참조용 Ref
  const isLoggedInRef = useRef(isLoggedIn);
  const userRef = useRef(user);
  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
    userRef.current = user;
  }, [isLoggedIn, user]);

  const { hasWatchedAd, watchAd, isAdShowing } = useAccessControl();

  // [신규] 오판단 제보 전역 함수 등록
  useEffect(() => {
    window.__reportInaccuracy = async (addr: string) => {
      try {
        await addDoc(collection(db, "reports"), {
          address: addr,
          reporterEmail: userRef.current?.email || "비회원",
          reporterId: userRef.current?.id || "anonymous",
          status: "pending",
          createdAt: serverTimestamp()
        });
        alert("제보가 성공적으로 접수되었습니다. 관리자 검토 후 24시간 내에 반영하겠습니다.");
      } catch (e) {
        console.error("Report failed:", e);
        alert("제보 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    };
  }, []);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const { addRecentLog } = useRecentLogs();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedCoord, setSelectedCoord] = useState<{ lat: number, lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddressSelected, setIsAddressSelected] = useState(false);
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isPostcodeOpen, setPostcodeOpen] = useState(false);
  const [isReadListOpen, setReadListOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [ratings, setRatings] = useState({ light: 3, noise: 3, water: 3 });
  const [addressDetail, setAddressDetail] = useState("");
  const [comment, setComment] = useState("");
  const [isLocationActive, setIsLocationActive] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const infoWindowInstance = useRef<any>(null);
  const allLocationsRef = useRef<any[]>([]);
  const unsubscribeReadListRef = useRef<(() => void) | null>(null);
  const isInitialNavRef = useRef(false);
  const clusterRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const allMarkersRef = useRef<any[]>([]);

  // [신규] 건축물 확인 결과 캐시 (성능 최적화용)
  const buildingCacheRef = useRef<Record<string, boolean>>({});

  // 검색 기록 상태
  const [isLocating, setIsLocating] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recent_searches_log');
    return saved ? JSON.parse(saved) : [];
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [showExitToast, setShowExitToast] = useState(false);
  const lastBackPressRef = useRef<number>(0);

  // 전역 상태 및 UI 제어 상태 (useEffect 이전에 선언 필요)
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [customTag, setCustomTag] = useState("");
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationDistance, setVerificationDistance] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [experienceType, setExperienceType] = useState("단순 방문");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoritedAddresses, setFavoritedAddresses] = useState<Set<string>>(new Set());
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    desc?: string;
    icon: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: "",
    desc: "",
    icon: "🥳",
  });

  const handleCloseDetail = useCallback(() => setSelectedReview(null), []);

  // [네이버 로그인] 홈(지도) 복귀 시 해시 토큰 처리
  useEffect(() => {
    if (window.location.hash.includes('access_token=')) {
      const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
      const token = hashParams.get('access_token');
      if (token) {
        handleNaverCallback(token).then(() => {
          // Toast 추후 구현 가능, 우선 토큰 제거 및 정리
        });
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  // [추가] 찜한 주소 목록 실시간 동기화 (마커 표시 및 필터링용)
  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setFavoritedAddresses(new Set());
      return;
    }

    const q = query(collection(db, "bookmarks"), where("userId", "==", user.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const addresses = new Set<string>();
      snapshot.forEach(d => {
        const data = d.data();
        if (data.address) {
          addresses.add(normalizeBaseAddress(data.address));
        }
      });
      setFavoritedAddresses(addresses);
      console.log("⭐ [Sync] 찜한 주소 목록 업데이트:", addresses.size, "건");
    }, (error) => {
      console.error("Bookmarks sync error:", error);
    });

    return () => unsubscribe();
  }, [isLoggedIn, user?.id]);

  const calculateAverageRating = useCallback((reviewList: Review[]) => {
    if (!reviewList || reviewList.length === 0) return "0.0";
    const totalAvg = reviewList.reduce((acc, rev) => {
      const revAvg = ((rev.ratings?.light || 0) + (rev.ratings?.noise || 0) + (rev.ratings?.water || 0)) / 3;
      return acc + revAvg;
    }, 0);
    return (totalAvg / reviewList.length).toFixed(2);
  }, []);

  const isRefreshingRef = useRef(false);
  const refreshMarkers = useCallback(async () => {
    if (!mapInstance.current || isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const snapshot = await getDocs(collection(db, "reviews"));
      const allReviews: any[] = [];
      snapshot.forEach((d: QueryDocumentSnapshot<DocumentData>) => allReviews.push({ id: d.id, ...d.data() }));

      const groups: { [key: string]: any[] } = {};
      allReviews.forEach(r => {
        const key = normalizeBaseAddress(r.address || r.location);
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });

      // 1. 리뷰가 있는 모든 주소 데이터 구성
      const reviewRelatedData = Object.keys(groups).map(addr => {
        const list = groups[addr];
        const first = list[0];
        return {
          address: addr,
          lat: first.lat,
          lng: first.lng,
          count: list.length,
          avgRating: calculateAverageRating(list),
          isFavorited: favoritedAddresses.has(addr),
          isBookmarkStyle: showFavoritesOnly // 찜 필터가 켜져있을 때만 노란색 스타일 적용
        };
      });

      // 2. 최종 데이터 구성 (필터 상태에 따라 분기)
      let finalData: any[] = [];
      if (showFavoritesOnly) {
        // [찜 필터 ON] 찜한 장소들만 추출 (리뷰 없는 장소 포함)
        if (isLoggedIn && user?.id) {
          const bSnap = await getDocs(query(collection(db, "bookmarks"), where("userId", "==", user.id)));
          const reviewAddrs = new Set(reviewRelatedData.map(d => d.address));

          // 리뷰 있는 찜 장소 우선 추가
          finalData = reviewRelatedData.filter(d => d.isFavorited);

          // 리뷰 없는 찜 장소 추가
          bSnap.forEach(d => {
            const bData = d.data();
            const stdAddr = normalizeBaseAddress(bData.address);
            if (!reviewAddrs.has(stdAddr) && bData.lat && bData.lng) {
              finalData.push({
                address: stdAddr,
                lat: bData.lat,
                lng: bData.lng,
                count: 0,
                avgRating: "0.0",
                isFavorited: true,
                isBookmarkStyle: true
              });
              reviewAddrs.add(stdAddr);
            }
          });
        }
      } else {
        // [찜 필터 OFF] 리뷰가 있는 모든 장소 표시 (일반 파란 마커 스타일)
        finalData = reviewRelatedData.map(rd => ({
          ...rd,
          isBookmarkStyle: false
        }));
      }

      // 전역 참조 업데이트 (클릭 이벤트 등에서 사용)
      allLocationsRef.current = finalData;

      allMarkersRef.current.forEach(m => m.setMap(null));
      allMarkersRef.current = [];
      if (clusterRef.current) {
        clusterRef.current.setMap(null);
        clusterRef.current = null;
      }

      const markers = finalData.map(loc => {
        const pos = new window.naver.maps.LatLng(loc.lat, loc.lng);
        const m = new window.naver.maps.Marker({
          position: pos,
          map: mapInstance.current,
          title: loc.address,
          icon: {
            content: `
              <div class="marker-container ${loc.isBookmarkStyle ? 'style-bookmark' : ''}">
                <div class="marker-bubble">
                  <span class="count">${!loc.isBookmarkStyle && loc.count > 0 ? loc.count : ''}</span>
                </div>
              </div>
            `,
            anchor: loc.isBookmarkStyle ? new window.naver.maps.Point(14, 14) : new window.naver.maps.Point(21, 21),
          }
        });
        (m as any).propertyCount = loc.count;
        allMarkersRef.current.push(m);

        window.naver.maps.Event.addListener(m, "click", async () => {
          const latLng = m.getPosition();
          const curZoom = mapInstance.current.getZoom();
          mapInstance.current.autoResize();

          if (curZoom < 16) {
            mapInstance.current.morph(latLng, 16, { duration: 300, easing: "linear" });
            if (infoWindowInstance.current?.getMap()) infoWindowInstance.current.close();
            return;
          }

          if (curZoom < 19) {
            mapInstance.current.morph(latLng, 19, { duration: 300, easing: "linear" });
            if (infoWindowInstance.current?.getMap()) infoWindowInstance.current.close();
            return;
          }

          mapInstance.current.panTo(latLng, { duration: 300, easing: "linear" });

          // [최적화] 즉각적인 로딩 팝업 노출
          infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
          infoWindowInstance.current.setContent(`
            <div class="iw-container marker loading">
              <div class="iw-card" style="padding:24px 20px; display:flex; flex-direction:column; align-items:center; gap:12px; min-width:180px;">
                <div class="spinner" style="width:24px; height:24px; border:3px solid #F2F4F6; border-top-color:#3182F6; border-radius:50%; animation:iw-spin 0.8s linear infinite;"></div>
                <span style="font-size:13px; color:#8B95A1; font-weight:600;">건물 정보 확인 중...</span>
              </div>
            </div>
          `);
          infoWindowInstance.current.open(mapInstance.current, latLng);

          // [캐시 및 비동기 UX 최적화]
          const address = normalizeBaseAddress(loc.address);
          infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });

          // 1. 캐시 확인 시 즉시 노출
          if (buildingCacheRef.current[address] !== undefined) {
            const isRes = buildingCacheRef.current[address];
            const loadAndShow = async () => {
              let isBookmarked = false;
              if (isLoggedIn && user) {
                const bId = `bookmark_${user.id}_${address.replace(/\s+/g, '_')}`;
                const bSnap = await getDoc(doc(db, "bookmarks", bId));
                isBookmarked = bSnap.exists();
              }
              let hasWritten = false;
              if (isLoggedIn && user?.id) {
                const q = query(collection(db, "reviews"), where("authorId", "==", user.id), where("address", "==", address));
                const snap = await getDocs(q);
                hasWritten = !snap.empty;
              }
              infoWindowInstance.current.setContent(getInfoWindowMarkup({
                address, lat: loc.lat, lng: loc.lng, isBookmarked, isResidential: isRes,
                reviewCount: loc.count || 0, avgRating: loc.avgRating || 0, hasWritten
              }));
              infoWindowInstance.current.open(mapInstance.current, latLng);
            };
            loadAndShow();
            return;
          }

          // 2. 캐시 없으면 로딩창 먼저 띄움
          infoWindowInstance.current.setContent(`
            <div class="iw-container marker loading">
              <div class="iw-card" style="padding:20px; display:flex; flex-direction:column; align-items:center; gap:12px;">
                <div class="spinner" style="width:24px; height:24px; border:3px solid #E5E8EB; border-top-color:#3182F6; border-radius:50%; animation:iw-spin 0.8s linear infinite;"></div>
                <span style="font-size:13px; color:#8B95A1; font-weight:600;">건물 확인 중...</span>
              </div>
            </div>
          `);
          infoWindowInstance.current.open(mapInstance.current, latLng);

          // 3. 백그라운드 정밀 검사
          window.naver.maps.Service.reverseGeocode({ coords: latLng, orders: "roadaddr,addr" }, async (status: any, res: any) => {
            let isRes = checkIsResidential(address);
            if (status === window.naver.maps.Service.Status.OK) {
              const addrRes = res.v2.results.find((r: any) => r.name === 'addr' || r.name === 'roadaddr');
              const bName = (addrRes && addrRes.land && addrRes.land.name) ? addrRes.land.name : "";
              isRes = isRes && (!bName || checkIsResidential(bName));

              const addrResult = res.v2.results.find((r: any) => r.name === 'addr');
              if (addrResult) {
                const code = addrResult.code?.id;
                const land = addrResult.land;
                if (code && land?.number1) {
                  const apiRes = await checkBuildingRegistry(code.substring(0, 5), code.substring(5, 10), land.number1, land.number2);
                  if (apiRes !== null) isRes = apiRes;
                }
              }
            }
            buildingCacheRef.current[address] = isRes;

            // 상세 데이터 로드 후 업데이트
            let isBookmarked = false;
            if (isLoggedIn && user) {
              const bId = `bookmark_${user.id}_${address.replace(/\s+/g, '_')}`;
              const bSnap = await getDoc(doc(db, "bookmarks", bId));
              isBookmarked = bSnap.exists();
            }
            let hasWritten = false;
            if (isLoggedIn && user?.id) {
              const q = query(collection(db, "reviews"), where("authorId", "==", user.id), where("address", "==", address));
              const snap = await getDocs(q);
              hasWritten = !snap.empty;
            }

            infoWindowInstance.current.setContent(getInfoWindowMarkup({
              address, lat: loc.lat, lng: loc.lng, isBookmarked, isResidential: isRes,
              reviewCount: loc.count || 0, avgRating: loc.avgRating || 0, hasWritten
            }));
          });
        });
        return m;
      });

      clusterRef.current = new window.MarkerClustering({
        minClusterSize: 2,
        maxZoom: 18,
        map: mapInstance.current,
        markers: markers,
        disableClickZoom: true,
        gridSize: 180,
        icons: [
          { content: '<div class="cluster cluster-s"><div></div></div>', size: new window.naver.maps.Size(52, 52), anchor: new window.naver.maps.Point(26, 26) },
          { content: '<div class="cluster cluster-m"><div></div></div>', size: new window.naver.maps.Size(60, 60), anchor: new window.naver.maps.Point(30, 30) },
          { content: '<div class="cluster cluster-l"><div></div></div>', size: new window.naver.maps.Size(72, 72), anchor: new window.naver.maps.Point(36, 36) },
        ],
        stylingFunction: (clusterMarker: any, count: number) => {
          const el = clusterMarker.getElement();

          // 네이버 클러스터링 모듈은 "clusterclick" 이벤트를 정상적으로 방출하지 않으므로
          // DOM 요소(el)에 직접 클릭 이벤트를 매핑합니다.
          el.onclick = (e: MouseEvent) => {
            e.stopPropagation();
            if (!clusterRef.current) return;

            const clusterObj = clusterRef.current._clusters.find((c: any) => c._clusterMarker === clusterMarker);
            const center = clusterObj ? clusterObj.getCenter() : clusterMarker.getPosition();
            const curZoom = mapInstance.current.getZoom();

            // 현재 줌이 낮으면 17로 점프, 17 이상이면 이미 어느정도 확대되었으므로 바로 19(상세 분기점)로 확 점프
            const targetZoom = curZoom < 17 ? 17 : 19;

            mapInstance.current.morph(center, targetZoom, {
              duration: 300,
              easing: 'linear' // 조금 더 즉각적인 반응을 위해 linear 사용
            });
          };

          const div = el.querySelector('div');
          if (div) {
            if (!clusterRef.current) {
              div.innerText = count;
              return;
            }
            const clusterObj = clusterRef.current._clusters.find((c: any) => c._clusterMarker === clusterMarker);
            if (clusterObj) {
              const members = clusterObj.getClusterMember();
              const totalSum = members.reduce((acc: number, m: any) => acc + (m.propertyCount || 0), 0);
              div.innerText = totalSum > 999 ? "999+" : totalSum;
              el.classList.remove('cluster-s', 'cluster-m', 'cluster-l');
              if (totalSum < 10) el.classList.add('cluster-s');
              else if (totalSum < 100) el.classList.add('cluster-m');
              else el.classList.add('cluster-l');
            } else {
              div.innerText = count;
            }
          }
        }
      });

      setTimeout(() => {
        if (clusterRef.current) clusterRef.current._redraw();
      }, 100);

    } catch (e) { console.error("Marker refresh error:", e); }
    finally {
      isRefreshingRef.current = false;
    }
  }, [calculateAverageRating, isLoggedIn, user, showFavoritesOnly, favoritedAddresses]);

  // [추가] 찜 필터 토글 시 마커 즉시 갱신
  useEffect(() => {
    refreshMarkers();
  }, [showFavoritesOnly, refreshMarkers]);

  const showAlert = useCallback((title: string, desc?: string, icon: string = "✅", onConfirm?: () => void) => {
    setModalConfig({ isOpen: true, title, desc, icon, onConfirm, confirmText: "확인" });
  }, []);

  const showConfirm = useCallback((title: string, onConfirm: () => void, desc?: string, icon: string = "❓", onCancel?: () => void) => {
    setModalConfig({
      isOpen: true,
      title,
      desc,
      icon,
      onConfirm,
      onCancel,
      confirmText: "확인",
      cancelText: "취소"
    });
  }, []);

  const handleEditReview = useCallback((review: any) => {
    setEditingReviewId(review.id);
    setSelectedAddress(review.location);
    setAddressDetail(review.addressDetail || "");
    setSelectedCoord({ lat: review.lat || 37.5, lng: review.lng || 127.0 });
    setComment(review.content);
    setSelectedTags(review.tags || []);
    setExperienceType(review.experienceType || "단순 방문");
    setReadListOpen(false);
    setSelectedReview(null);
    setSheetOpen(true);
  }, []);

  const handleEditDetail = useCallback((review: any) => {
    handleEditReview(review);
  }, [handleEditReview]);

  const handleDeleteReview = useCallback(async (id: string) => {
    showConfirm(
      "방문록 삭제",
      async () => {
        try {
          const success = await deleteReview(id);
          if (success) {
            setReviews(prev => prev.filter(r => r.id !== id));
            showAlert("삭제 완료", "방문록이 삭제되었습니다.", "🗑️");
            refreshMarkers();
          } else {
            showAlert("삭제 실패", "삭제 중 오류가 발생했습니다.", "⚠️");
          }
        } catch (e) {
          console.error(e);
          showAlert("삭제 실패", "삭제 중 오류가 발생했습니다.", "⚠️");
        }
      },
      "정말 이 방문록을 삭제하시겠습니까? (영구 삭제)",
      "🗑️"
    );
  }, [refreshMarkers, showAlert, showConfirm]);

  const handleDeleteDetail = useCallback((id: string) => {
    handleDeleteReview(id);
  }, [handleDeleteReview]);

  const verifyLocation = useCallback((targetLat?: number, targetLng?: number) => {
    if (!navigator.geolocation) return;
    setIsVerifying(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      const uLat = pos.coords.latitude;
      const uLng = pos.coords.longitude;
      const lat = targetLat || selectedCoord?.lat;
      const lng = targetLng || selectedCoord?.lng;
      if (lat && lng) {
        const dist = calculateDistance(uLat, uLng, lat, lng);
        setVerificationDistance(dist);
        setIsVerified(dist <= 150);
      }
      setIsVerifying(false);
    }, (err) => {
      console.error("GPS Verification Error:", err);
      setIsVerifying(false);
    }, { enableHighAccuracy: true });
  }, [selectedCoord]);

  // [환영 모달] 첫 방문 시 노출 여부 체크
  useEffect(() => {
    const expiry = localStorage.getItem("welcome_modal_expiry");
    const sessionSeen = sessionStorage.getItem("welcome_modal_seen");
    const now = new Date().getTime();

    // 24시간 만료 체크 + 현재 세션 노출 여부 체크
    if ((!expiry || now > parseInt(expiry)) && !sessionSeen) {
      setShowWelcomeModal(true);
      sessionStorage.setItem("welcome_modal_seen", "true");
    }
  }, []);

  // [WebView/Mobile] 하드웨어 뒤로가기 버튼 핸들링
  useEffect(() => {
    // 앱 진입 시 가상의 히스토리를 하나 밀어넣어 뒤로가기 이벤트를 가로챌 준비를 합니다.
    window.history.pushState({ isHome: true }, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      // 1. 열려있는 레이어(모달, 시트 등)가 있다면 뒤로가기 시 레이어를 먼저 닫습니다.
      if (isPostcodeOpen) { setPostcodeOpen(false); window.history.pushState({ isHome: true }, '', window.location.href); return; }
      if (isSheetOpen) { setSheetOpen(false); window.history.pushState({ isHome: true }, '', window.location.href); return; }
      if (isReadListOpen) { setReadListOpen(false); window.history.pushState({ isHome: true }, '', window.location.href); return; }
      if (selectedReview) { setSelectedReview(null); window.history.pushState({ isHome: true }, '', window.location.href); return; }
      if (viewerImage) { setViewerImage(null); window.history.pushState({ isHome: true }, '', window.location.href); return; }
      if (isHistoryOpen) { setIsHistoryOpen(false); window.history.pushState({ isHome: true }, '', window.location.href); return; }
      if (modalConfig.isOpen) { setModalConfig(prev => ({ ...prev, isOpen: false })); window.history.pushState({ isHome: true }, '', window.location.href); return; }

      // 2. 레이어가 없는 클린한 상태에서 뒤로가기 시 "한번 더 누르면 종료" 로직 실행
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        // 2초 내에 두 번 누름 -> 실제 종료 (이전 페이지 혹은 브라우저 종료)
        window.history.go(-2); // 우리가 추가한 pushState와 원래 이동하려던 back을 합쳐서 -2
      } else {
        // 첫 번째 누름 -> 토스트 알림
        lastBackPressRef.current = now;
        setShowExitToast(true);
        // 다시 가상 히스토리를 밀어넣어 다음 뒤로가기를 대기합니다.
        window.history.pushState({ isHome: true }, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isPostcodeOpen, isSheetOpen, isReadListOpen, selectedReview, viewerImage, isHistoryOpen, modalConfig.isOpen]);

  // 수정 파라미터 감지 및 로드
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId) {
      const loadToEdit = async () => {
        try {
          const docRef = doc(db, "reviews", editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const r = docSnap.data();
            setEditingReviewId(editId);
            setComment(r.content || "");
            setRatings(r.ratings || { light: 3, noise: 3, water: 3 });
            setSelectedTags(r.tags || []);
            setSelectedAddress(r.address || r.location || "");
            setIsVerified(!!r.isVerified);
            if (r.lat && r.lng) {
              setSelectedCoord({ lat: r.lat, lng: r.lng });
            }
            setExperienceType(r.experienceType || "단순 방문");
            setReadListOpen(false);
            setSelectedReview(null);
            setSheetOpen(true);
          }
        } catch (e) { }

        // Remove param so it doesn't loop
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("edit");
        setSearchParams(nextParams, { replace: true });
      };
      loadToEdit();
    }
  }, [searchParams, setSearchParams]);

  // [추가] 찜 목록/지도 이동 파라미터 감지 및 자동 포커싱 구현
  useEffect(() => {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const rawAddr = searchParams.get("address");
    const addr = rawAddr ? normalizeBaseAddress(rawAddr) : null;

    if (lat && lng && addr && mapInstance.current && infoWindowInstance.current) {
      const targetPos = new window.naver.maps.LatLng(Number(lat), Number(lng));

      // 즉시 이동 및 줌 설정
      mapInstance.current.setZoom(19);
      mapInstance.current.setCenter(targetPos);
      setIsLocationActive(false); // [추가] 외부 좌표 이동 시 GPS 비활성화

      const triggerFocus = async () => {
        // [1] 데이터 로드 (찜 상태 및 거주용 여부)
        // favoritedAddresses를 사용하여 즉시 동기화
        const isBookmarked = favoritedAddresses.has(addr);
        const isRes = checkIsResidential(addr);

        // [2] 본인 작성 여부 체크
        let hasWritten = false;
        if (isLoggedIn && user?.id) {
          const q = query(collection(db, "reviews"), where("authorId", "==", user.id), where("address", "==", addr));
          const snap = await getDocs(q);
          hasWritten = !snap.empty;
        }

        const buttonText = hasWritten ? "작성 완료" : "방문록 쓰기";
        const disabledAttr = hasWritten ? "disabled style='background:#E5E8EB; color:#A8AFB5; cursor:not-allowed; border:none;'" : "";

        // [3] 인포윈도우 템플릿 적용 및 오픈
        const normalizedFull = normalizeBaseAddress(addr);
        const existingLoc = allLocationsRef.current.find(loc => normalizeBaseAddress(loc.address || loc.location) === normalizedFull);
        const reviewCount = existingLoc ? (existingLoc.count || 0) : 0;
        const avgRating = existingLoc ? (existingLoc.rating || 0) : 0;

        infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
        infoWindowInstance.current.setContent(getInfoWindowMarkup({
          address: addr,
          lat,
          lng,
          isBookmarked,
          isResidential: isRes,
          reviewCount,
          avgRating,
          hasWritten
        }));
        infoWindowInstance.current.open(mapInstance.current, targetPos);

        // [4] 파라미터 정리
        const nextParams = new URLSearchParams(); // 모두 정리
        setSearchParams(nextParams, { replace: true });
      };

      triggerFocus();
    }
  }, [searchParams, mapInstance.current, infoWindowInstance.current, isLoggedIn, user, setSearchParams]);

  // [추가] 기존 중복 찜 데이터 클린업 로직 (1회성)
  // [개선] 찜 데이터 전면 마이그레이션 및 클린업 (1회성/지속성 통합)
  useEffect(() => {
    const migrateAndCleanupBookmarks = async () => {
      if (!isLoggedIn || !user?.id) return;

      try {
        const q = query(collection(db, "bookmarks"), where("userId", "==", user.id));
        const snap = await getDocs(q);

        // 정규화된 주소를 키로 하여 데이터 그룹화
        const addressMap = new Map<string, { data: any, ids: string[] }>();

        snap.forEach(d => {
          const rawData = d.data();
          const stdAddr = normalizeBaseAddress(rawData.address);

          if (!addressMap.has(stdAddr)) {
            addressMap.set(stdAddr, { data: rawData, ids: [] });
          }
          addressMap.get(stdAddr)?.ids.push(d.id);
        });

        const batch = writeBatch(db);
        let hasChanges = false;

        for (const [stdAddr, info] of addressMap.entries()) {
          // 신규 표준 ID 규격 생성
          const correctId = `bookmark_${user.id}_${stdAddr.replace(/\s+/g, '_')}`;

          // 1. 마이그레이션 필요 여부 체크: 
          //    - ID가 규격에 맞지 않거나
          //    - 주소 필드가 표준화되지 않았거나
          //    - 중복된 문서가 있는 경우
          const needsMigration = !info.ids.includes(correctId) ||
            info.data.address !== stdAddr ||
            info.ids.length > 1;

          if (needsMigration) {
            hasChanges = true;

            // 새 규격으로 데이터 복사/생성
            const newRef = doc(db, "bookmarks", correctId);
            batch.set(newRef, {
              ...info.data,
              address: stdAddr, // 필드값 표준화
              updatedAt: Timestamp.now()
            });

            // 기존 모든 구형/중복 ID 문서 삭제 (새 ID가 포함되어 있더라도 위에서 set 해줬으므로 안전하게 삭제 로직 구성)
            info.ids.forEach(oldId => {
              if (oldId !== correctId) {
                batch.delete(doc(db, "bookmarks", oldId));
              }
            });
          }
        }

        if (hasChanges) {
          await batch.commit();
          console.log("🧹 [Migration] 찜 데이터 주소 규격을 통합하고 문서 ID를 재배치했습니다.");
          refreshMarkers(); // UI 리프레시 유도
        }
      } catch (e) {
        console.error("Migration error:", e);
      }
    };

    migrateAndCleanupBookmarks();
  }, [isLoggedIn, user?.id]);

  // [개선] 현재 검색된 주소지(혹은 선택된 장소)의 방문록 태그들 중 빈도가 높은 상위 5개를 동적으로 추출
  const dynamicNeighborhoodTags = useMemo(() => {
    if (!selectedAddress || reviews.length === 0) return [];

    const tagCount: { [key: string]: number } = {};
    const normalizedTarget = normalizeBaseAddress(selectedAddress);

    reviews.forEach(r => {
      const docAddr = normalizeBaseAddress(r.location || r.address || "");
      if (docAddr === normalizedTarget && r.tags) {
        r.tags.forEach((t: string) => {
          tagCount[t] = (tagCount[t] || 0) + 1;
        });
      }
    });

    // 많이 쓰인 순서대로 정렬하여 상위 6개 반환
    return Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, 6);
  }, [reviews, selectedAddress]);

  const tags = [
    // ✨ 숨은 매력 장점 (발견하면 좋은 안심 태그)
    "#채광맛집", "#방음잘됨", "#수압짱", "#수납넉넉", "#벌레청정구역",
    "#단열잘됨", "#주차여유", "#하자보수빠름", "#집주인천사", "#분리수거편함",

    // 🚨 치명적인 단점 (입주 전 필수 체크)
    "#층간소음심함", "#벽간소음", "#외부소음", "#결로곰팡이", "#수압약함",
    "#벌레출몰주의", "#바퀴벌레지옥", "#외풍심함", "#녹물나옴", "#환기안됨",
    "#주차공간부족", "#관리비폭탄", "#집주인간섭", "#분리수거불편",

    // 🏘️ 동네 인프라 및 환경 (라이프스타일)
    "#편의점코앞", "#치안좋음", "#언덕심함", "#초역세권", "#뷰맛집",
    "#산책로있음", "#버스정류장가깝"
  ];


  useEffect(() => {
    window.__openReadList = (address: string) => {
      setSelectedAddress(address);
      setReadListOpen(true);
      if (infoWindowInstance.current?.getMap()) infoWindowInstance.current.close();

      setIsLoadingReviews(true);

      if (unsubscribeReadListRef.current) unsubscribeReadListRef.current();

      // [개선] 특정 주소 필드 일치 쿼리 대신, 전체 리스트를 실시간으로 가져와서 주소 정규화 기준으로 필터링합니다.
      // 이는 마커 숫자와 리스트 숫자의 일관성을 100% 보장하며 주소 오타나 필드명 차이(address vs location)로 인한 누락을 방지합니다.
      const q = query(collection(db, "reviews"));
      const normalizedTarget = normalizeBaseAddress(address);

      unsubscribeReadListRef.current = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
        const list: Review[] = [];
        const totalDBCount = snap.size;

        snap.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
          const data = doc.data();
          const docAddr = normalizeBaseAddress(data.address || data.location || "");

          if (docAddr === normalizedTarget) {
            list.push({
              id: doc.id,
              author: data.author,
              authorId: data.authorId,
              lat: data.lat,
              lng: data.lng,
              date: data.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR').format(data.createdAt.toDate()) : "2026.04.10",
              location: data.address || data.location,
              content: data.content,
              images: data.images || [],
              likes: data.likes || 0,
              views: data.views || 0,
              tags: data.tags || [],
              ratings: data.ratings || { light: 3, noise: 3, water: 3 },
              createdAt: data.createdAt,
              isVerified: data.isVerified || false,
              distance: data.distance || 0,
              experienceType: data.experienceType || "단순 방문",
              addressDetail: data.addressDetail || ""
            });
          }
        });

        console.log(`📋 [List Sync Log] Target: ${normalizedTarget}`);
        console.log(`📋 [List Sync Log] Total DB Docs: ${totalDBCount}, Matched: ${list.length}`);

        list.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });

        setReviews(list);
        setIsLoadingReviews(false);
      }, (error: Error) => {
        console.error("Reviews sync error:", error);
        setIsLoadingReviews(false);
      });
    };

    window.__openWriteSheet = (address: string, lat?: number, lng?: number) => {
      if (!isLoggedInRef.current) {
        showConfirm(
          "앗! 로그인이 필요해요 🏠",
          () => navigate('/mypage'),
          "방문록을 작성하여 정보를 나누고, 다른 분들의 생생한 후기도 모두 확인해 보세요!",
          "🔒",
          () => { }
        );
        return;
      }
      setSelectedAddress(address);
      if (lat && lng) setSelectedCoord({ lat, lng });

      // 신규 작성이면 위치 검증 실행
      if (!editingReviewId) {
        verifyLocation(lat, lng);
      }

      setSheetOpen(true);
      if (infoWindowInstance.current?.getMap()) infoWindowInstance.current.close();
    };

    window.__toggleBookmark = async (address: string, lat: number, lng: number) => {
      if (!isLoggedInRef.current || !userRef.current?.id) {
        showConfirm("로그인 필요", () => navigate('/mypage'), "찜하기 기능은 로그인 후 이용 가능합니다.", "🔒");
        return;
      }

      try {
        const normalizedAddr = normalizeBaseAddress(address);
        // 고유 ID 생성 (중복 방지 핵심)
        const bookmarkId = `bookmark_${userRef.current.id}_${normalizedAddr.replace(/\s+/g, '_')}`;
        const bRef = doc(db, "bookmarks", bookmarkId);
        const bSnap = await getDoc(bRef);

        const isDelete = bSnap.exists();

        if (isDelete) {
          // [중급 클린업] 혹시 만에 하나 다른 ID로 중복된 게 있다면 같이 삭제
          const q = query(collection(db, "bookmarks"), where("userId", "==", userRef.current.id), where("address", "==", normalizedAddr));
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.forEach((d: QueryDocumentSnapshot<DocumentData>) => batch.delete(d.ref));
          await batch.commit();

          showAlert("찜 해제", "관심 건물에서 삭제되었습니다.", "💔");
        } else {
          await setDoc(bRef, {
            userId: userRef.current.id,
            address: normalizedAddr, // [핵심 수정] 무조건 표준화된 주소로 저장
            lat,
            lng,
            createdAt: Timestamp.now()
          });
          showAlert("찜 완료!", "이 건물의 새로운 방문록 알림을 보내드릴게요. 🔔", "🏠");
        }

        // [개선] 현재 열린 InfoWindow의 UI를 실시간으로 즉시 업데이트 (DOM 직접 조작)
        const btn = document.querySelector(".iw-bookmark-icon-btn");
        if (btn) {
          const svg = btn.querySelector("svg");
          if (isDelete) {
            btn.classList.remove("active");
            if (svg) {
              svg.setAttribute("fill", "none");
              svg.setAttribute("stroke", "#A8AFB5");
            }
          } else {
            btn.classList.add("active");
            if (svg) {
              svg.setAttribute("fill", "#FFD43B");
              svg.setAttribute("stroke", "#FFD43B");
            }
          }
        }

        // 인포윈도우 상태 갱신을 위해 현재 열린 정보창 다시 그리기 (백그라운드 동기화)
        if (infoWindowInstance.current?.getMap()) {
          refreshMarkers();
        }
      } catch (e) { console.error(e); }
    };

    const initializeMap = () => {
      if (!window.naver?.maps || !mapElement.current || mapInstance.current) return;

      // [핵심 로직] 지도 생성 시점에 내비게이션 여부를 즉시 기록 (Ref 활용)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("lat") || urlParams.get("lng") || urlParams.get("address")) {
        isInitialNavRef.current = true;
      }

      // 초기 서울 중심 위치 - 시청/광장 (가장 표준적인 선택)
      const initialCenter = new window.naver.maps.LatLng(37.5665, 126.9780);

      mapInstance.current = new window.naver.maps.Map(mapElement.current, {
        center: initialCenter,
        zoom: 14,
        zoomControl: false, scaleControl: false, logoControl: false, mapDataControl: false,
        // [추가] 부자연스러운 대각선 움직임 또는 관성 드래그 이슈 대응
        disableKineticPan: true,
        tileTransition: false,
      });

      // 2. 사용자의 GPS 위치 실시간 추적 및 마커 표시
      if (navigator.geolocation) {
        setIsLocating(true);

        // 기존 워치가 있다면 먼저 제거
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }

        watchIdRef.current = navigator.geolocation.watchPosition((pos) => {
          const { latitude: userLat, longitude: userLng, accuracy } = pos.coords;
          const userPos = new window.naver.maps.LatLng(userLat, userLng);

          // 초기 로딩 시 중심 이동 (한 번만)
          if (!isInitialNavRef.current && !userMarkerRef.current) {
            console.log("📍 [GPS 초기 포커싱] 중심 이동 완료");
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
                content: `
                  <div class="user-location-marker">
                    <div class="user-location-pulse"></div>
                    <div class="user-location-dot"></div>
                  </div>
                `,
                anchor: new window.naver.maps.Point(12, 12),
              },
              clickable: false,
              zIndex: 100
            });
          }

          setIsLocating(false);
          console.log(`📍 [GPS 업데이트] 정확도: ${accuracy.toFixed(1)}m`, userLat, userLng);
        }, (err) => {
          console.warn("GPS 허용 불가 또는 오류:", err);
          setIsLocating(false);
        }, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 30000 // 30초 캐시 허용하여 재진입 시 즉각 응답 유도
        });
      }

      infoWindowInstance.current = new window.naver.maps.InfoWindow({
        content: "",
        backgroundColor: "transparent",
        borderWidth: 0,
        disableAnchor: true, // 네이버 기본 화살표 사용 중지 (커스텀 CSS 사용)
        disableAutoPan: true, // [추가] 네이버가 지도를 자기 마음대로 비트는 것을 방지
        pixelOffset: new window.naver.maps.Point(0, -10), // [수정 포인트 1] 위치 보정 (현재 -10, 수동 수정 시 여기를 변경하세요)
      });

      refreshMarkers();

      // 지도 조작 시 내 위치 추적 비활성화 (드래그, 핀치타입 줌, 마우스휠)
      window.naver.maps.Event.addListener(mapInstance.current, "dragstart", () => setIsLocationActive(false));
      window.naver.maps.Event.addListener(mapInstance.current, "pinch", () => setIsLocationActive(false));
      window.naver.maps.Event.addListener(mapInstance.current, "mousewheel", () => setIsLocationActive(false));

      // [추가] 줌 레벨 최적화를 위한 실시간 로그 출력
      window.naver.maps.Event.addListener(mapInstance.current, "zoom_changed", () => {
        console.log("🔍 [Map Zoom] Current Zoom Level:", mapInstance.current.getZoom());
      });

      window.naver.maps.Event.addListener(mapInstance.current, "click", (e: any) => {
        const curZoom = mapInstance.current.getZoom();

        // e.coord 객체는 네이버 지도 엔진에서 재사용되므로, 비동기 호출을 위해 명시적으로 클론 생성
        const clickedPos = e.coord.clone ? e.coord.clone() : new window.naver.maps.LatLng(e.coord.y, e.coord.x);

        // 줌 레벨에 따른 단계별 확대 로직 (19 미만은 주소 체크 X)
        if (curZoom < 16) {
          mapInstance.current.morph(clickedPos, 16, { duration: 300, easing: "linear" });
          if (infoWindowInstance.current?.getMap()) infoWindowInstance.current.close();
          return;
        }

        if (curZoom < 19) {
          mapInstance.current.morph(clickedPos, 19, { duration: 300, easing: "linear" });
          if (infoWindowInstance.current?.getMap()) infoWindowInstance.current.close();
          return;
        }

        // 줌 레벨 19 이상일 때만 주소 체크 및 모달 노출 로직 실행
        mapInstance.current.panTo(clickedPos, { duration: 300, easing: "linear" });

        // [최적화] 즉시 팝업 노출 (낙관적 UX)
        infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
        infoWindowInstance.current.setContent(`
          <div class="iw-container marker loading">
            <div class="iw-card" style="padding:24px 20px; display:flex; flex-direction:column; align-items:center; gap:12px; min-width:180px;">
              <div class="iw-loader"></div>
              <span style="font-size:13px; color:#8B95A1; font-weight:600;">건물 정보 확인 중...</span>
            </div>
          </div>
        `);
        infoWindowInstance.current.open(mapInstance.current, clickedPos);

        if (!window.naver.maps.Service) return;

        window.naver.maps.Service.reverseGeocode({ coords: clickedPos, orders: "roadaddr,addr" }, async (status: any, res: any) => {
          if (status !== window.naver.maps.Service.Status.OK) return;

          let rawAddress = "주소를 찾을 수 없는 지역입니다.";
          const v2Addr = res.v2?.address;
          let buildingName = "";
          if (v2Addr) {
            rawAddress = v2Addr.roadAddress || v2Addr.jibunAddress || rawAddress;
          }

          // [핵심 추가] 네이버 상세 결과에서 건물 명칭(POI 명칭) 추출
          const addrRes = res.v2.results.find((r: any) => r.name === 'addr' || r.name === 'roadaddr');
          if (addrRes && addrRes.land && addrRes.land.name) {
            buildingName = addrRes.land.name;
          }

          const address = normalizeBaseAddress(rawAddress);
          const isKorea = address !== "주소를 찾을 수 없는 지역입니다.";

          // 1차: 주소 및 건물명 기반 빠른 체크 (명백한 블랙리스트 검사)
          // ⚠️ [유도리 개편] isResidential은 무조건 true로 시작하고, 아주 심각한 기피 대상일때만 false로 깎인다.
          const isStrictlyBlocked = !checkIsResidential(address) || (buildingName && !checkIsResidential(buildingName));
          let isResidential = !isStrictlyBlocked;

          // 2차: 건축물대장 API를 통한 정밀 체크
          const addrResult = res.v2.results.find((r: any) => r.name === 'addr');
          if (addrResult && isKorea) {
            const code = addrResult.code?.id;
            const land = addrResult.land;
            const bun = land?.number1;
            const ji = land?.number2;

            if (code && bun) {
              const sigunguCd = code.substring(0, 5);
              const bjdongCd = code.substring(5, 10);
              const apiResult = await checkBuildingRegistry(sigunguCd, bjdongCd, bun, ji);
              // ⚠️ [유도리 개편 핵심] API가 주거용(true)이라 하면 무조건 살린다. 
              // API가 비주거용(false)이라 해도, 앞서 블랙리스트에 안 걸렸으면 그냥 넘긴다 (isResidential 유지).
              if (apiResult === true) {
                isResidential = true;
              }
            }
          }

          // [개선] 이미 해당 주소에 마커가 있는지 체크
          const existingLoc = allLocationsRef.current.find(loc => normalizeBaseAddress(loc.address) === address);

          if (existingLoc) {
            // [개선] 찜하기 상태 확인 로직 (ID 직접 조회)
            const checkBookmark = async () => {
              let isBookmarked = false;
              if (isLoggedIn && user) {
                const stdAddr = normalizeBaseAddress(address);
                const bookmarkId = `bookmark_${user.id}_${stdAddr.replace(/\s+/g, '_')}`;
                const bRef = doc(db, "bookmarks", bookmarkId);
                const bSnap = await getDoc(bRef);
                isBookmarked = bSnap.exists();
              }

              const liveRating = existingLoc.rating || 0;
              const liveCount = existingLoc.count || 0;
              const finalPos = new window.naver.maps.LatLng(existingLoc.lat, existingLoc.lng);

              // 본인 작성 여부 체크 추가
              let hasWritten = false;
              if (isLoggedIn && user?.id) {
                const qCheck = query(
                  collection(db, "reviews"),
                  where("authorId", "==", user.id),
                  where("address", "==", address)
                );
                const snapCheck = await getDocs(qCheck);
                hasWritten = !snapCheck.empty;
              }

              infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
              infoWindowInstance.current.setContent(getInfoWindowMarkup({
                address,
                lat: existingLoc.lat,
                lng: existingLoc.lng,
                isBookmarked,
                isResidential,
                reviewCount: liveCount,
                avgRating: liveRating,
                hasWritten
              }));
              infoWindowInstance.current.open(mapInstance.current, finalPos);
              mapInstance.current.panTo(finalPos, { duration: 300, easing: "linear" });
            };
            checkBookmark();
            return;
          }

          // 신규 장소라면 -> "방문록 쓰기" 인포윈도우 (찜하기 버튼 포함)
          window.naver.maps.Service.geocode({ query: address }, (gStatus: any, gRes: any) => {
            let finalPos = clickedPos;
            if (gStatus === window.naver.maps.Service.Status.OK && gRes.v2.addresses.length > 0) {
              const addrItem = gRes.v2.addresses[0];
              finalPos = new window.naver.maps.LatLng(addrItem.y, addrItem.x);
            }

            const checkBookmarkNone = async () => {
              let isBookmarked = false;
              if (isLoggedIn && user) {
                const stdAddr = normalizeBaseAddress(address);
                const bookmarkId = `bookmark_${user.id}_${stdAddr.replace(/\s+/g, '_')}`;
                const bRef = doc(db, "bookmarks", bookmarkId);
                const bSnap = await getDoc(bRef);
                isBookmarked = bSnap.exists();
              }

              infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
              infoWindowInstance.current.setContent(`
                <div class="iw-container none-marker">
                  <div class="iw-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                      <div class="iw-title" style="margin-bottom:0;">방문록 쓰기</div>
                      ${isResidential ? `
                      <button class="iw-bookmark-icon-btn ${isBookmarked ? 'active' : ''}" onclick="window.__toggleBookmark('${address}', ${finalPos.lat()}, ${finalPos.lng()})">
                        <svg width="24" height="24" viewBox="0 0 24 24" 
                          fill="${isBookmarked ? '#FFD43B' : 'none'}" 
                          stroke="${isBookmarked ? '#FFD43B' : '#A8AFB5'}" 
                          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                        </svg>
                      </button>` : ''}
                    </div>
                    <div class="iw-address"><span>📍</span><span>${address}</span></div>
                    ${isKorea ? (
                  isResidential
                    ? `<div class="iw-button-group"><button class="iw-button iw-button--write" onclick="window.__openWriteSheet('${address}', ${finalPos.lat()}, ${finalPos.lng()})">방문록 쓰기</button></div>`
                    : `<div style="background:#FFF0F0; padding:12px; border-radius:8px; display:flex; gap:6px; align-items:flex-start;">
                           <span style="font-size:16px;">🏠</span>
                           <p style="margin:0; font-size:12px; color:#F04452; font-weight:600; line-height:1.5;">거주용 건물이 아니어서<br/>방문록을 작성할 수 없습니다.</p>
                         </div>`
                ) : ''}
                    <div class="iw-arrow"></div>
                  </div>
                </div>
              `);
              infoWindowInstance.current.open(mapInstance.current, finalPos);
              mapInstance.current.panTo(finalPos, { duration: 300, easing: "linear" });
            };
            checkBookmarkNone();
          });
        });
      });
    };

    const SCRIPT_ID = "naver-map-script";
    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID; s.src = "https://openapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=dj5vfj5th7&submodules=geocoder";
      s.async = true;
      s.onload = () => {
        const cs = document.createElement("script");
        cs.src = "https://cdn.jsdelivr.net/gh/navermaps/marker-tools.js@master/marker-clustering/src/MarkerClustering.js";
        cs.onload = initializeMap;
        document.head.appendChild(cs);
      };
      document.head.appendChild(s);
    } else { initializeMap(); }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []); // Run map init only once on mount

  // 별도 useEffect로 마커 갱신 관리 (상태 변경 시 호출)
  useEffect(() => {
    if (mapInstance.current) {
      refreshMarkers();
    }
  }, [mapInstance.current, refreshMarkers, showFavoritesOnly, favoritedAddresses, isLoggedIn, user]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  const handleAddCustomTag = () => {
    if (customTag.trim()) {
      const f = `#${customTag.trim()}`;
      if (!selectedTags.includes(f)) setSelectedTags([...selectedTags, f]);
      setCustomTag("");
    }
  };
  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };
  const handleSubmitReview = async () => {
    if (!selectedAddress || !selectedCoord) {
      showAlert("오류", "주소 정보가 없습니다.", "⚠️");
      return;
    }

    if (comment.length < 5) {
      showAlert("작성 오류", "후기를 최소 5자 이상 남겨주세요.", "✍️");
      return;
    }

    if (!isLoggedIn) {
      showConfirm(
        "방문록 작성",
        async () => {
          navigate('/mypage');
        },
        "방문록을 작성하려면 로그인하세요.",
        "🔓"
      );
      return;
    }

    try {
      if (!user?.id) { navigate('/mypage'); return; }

      // 0. 매물 단위 중복 체크 (사용자 의견에 따라 엄격한 제한 대신 안내 후 허용으로 변경 가능)
      /* 
      const normalizedDetail = normalizeAddressDetail(addressDetail);
      if (!editingReviewId) {
        ... (중략)
      }
      */

      // 0. 미디어 업로드 (이미지는 Base64 압축, 비디오는 Storage 업로드)
      const imageUrls: string[] = [];
      const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB 제한
      
      for (const file of selectedImages) {
        if (file.type.startsWith('video/')) {
          if (file.size > MAX_VIDEO_SIZE) {
            showAlert("용량 초과", "동영상은 50MB 이하만 업로드 가능합니다.", "⚠️");
            return;
          }
          const videoUrl = await uploadMediaToStorage(file);
          imageUrls.push(videoUrl);
        } else {
          const dataUrl = await compressAndEncodeImage(file);
          imageUrls.push(dataUrl);
        }
      }

      // 1. 리뷰 데이터 가공
      const reviewData: any = {
        address: normalizeBaseAddress(selectedAddress),
        addressDetail: normalizeAddressDetail(addressDetail),
        content: comment,
        ratings,
        tags: selectedTags,
        images: imageUrls,
        experienceType,
        updatedAt: Timestamp.now()
      };

      if (editingReviewId) {
        // [수정 모드]
        await updateDoc(doc(db, "reviews", editingReviewId), reviewData);
        showAlert("수정 완료", "방문록이 성공적으로 수정되었습니다.", "✨");
      } else {
        // [신규 등록 모드]
        reviewData.createdAt = Timestamp.now();
        reviewData.author = user?.name || "jm_tester";
        reviewData.authorId = user?.id;
        reviewData.likes = 0;
        reviewData.views = 0;
        reviewData.lat = selectedCoord.lat;
        reviewData.lng = selectedCoord.lng;
        reviewData.isVerified = isVerified;
        reviewData.distance = verificationDistance || 0;
        reviewData.experienceType = experienceType;

        const docRef = await addDoc(collection(db, "reviews"), reviewData);

        // [추가] 방문록 작성자에게 1년 전체 보기 권한 부여 로직
        if (user?.id) {
          const expiryDate = new Date();
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          await updateDoc(doc(db, "users", user.id), {
            canViewAllUntil: Timestamp.fromDate(expiryDate)
          });
          console.log("🔓 [Auth] 사용자가 방문록을 작성하여 1년 전체 보기 권한이 부여되었습니다.");
        }
        if (user?.id) {
          const q = query(collection(db, "reviews"), where("authorId", "==", user.id));
          const snap = await getDocs(q);
          const totalAfter = snap.size; // 방금 쓴 것 포함
          const totalBefore = totalAfter - 1;

          const newBadge = checkEligibleForNewTitle(totalBefore, totalAfter);

          if (newBadge) {
            await addDoc(collection(db, "notifications"), {
              toUserId: user.id,
              type: "system",
              content: `축하합니다! 방문록 ${totalAfter}회 작성을 달성하여 '${newBadge.title}' 뱃지를 획득했습니다. ${newBadge.icon}`,
              reviewId: docRef.id,
              createdAt: Timestamp.now(),
              isRead: false
            });
            showAlert("🎖️ 새로운 칭호 획득!", `방문록 ${totalAfter}회 작성 기념으로 '${newBadge.title}' 뱃지를 얻었습니다.`, "🏆");
          }
        }

        // 원래 뱃지 로직
        if (isVerified && user?.id) {
          await addDoc(collection(db, "notifications"), {
            toUserId: user.id,
            type: "system",
            content: `회원님이 남기신 방문록의 방문자 인증이 완료되었습니다. 뱃지를 획득했습니다!`,
            reviewId: docRef.id,
            createdAt: Timestamp.now(),
            isRead: false
          });
        }

        showAlert("등록 완료", "소중한 방문록이 지도에 기록되었습니다.", "🥳");

        // [추가] 찜한 사용자들에게 알림 발송
        const bq = query(collection(db, "bookmarks"), where("address", "==", selectedAddress));
        const bsnap = await getDocs(bq);

        const notifyPromises = bsnap.docs.map(async (bdoc: QueryDocumentSnapshot<DocumentData>) => {
          const bm = bdoc.data();
          // 수신자의 알림 설정 확인
          const userRef = doc(db, "users", bm.userId);
          const userSnap = await getDoc(userRef);

          let canNotify = true;
          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.settings?.notifications?.bookmarks === false) {
              canNotify = false;
            }
          }

          if (canNotify) {
            const displayAddress = selectedAddress.split(' ').slice(-2).join(' ');
            await addDoc(collection(db, "notifications"), {
              toUserId: bm.userId,
              type: "local",
              content: `찜한 건물 '${displayAddress}'에 새로운 방문록이 올라왔어요!`,
              reviewId: docRef.id,
              createdAt: Timestamp.now(),
              isRead: false
            });
          }
        });

        await Promise.all(notifyPromises);
      }

      setSheetOpen(false); setComment(""); setAddressDetail(""); setSelectedTags([]); setSelectedImages([]);
      setEditingReviewId(null); setIsVerified(false); setVerificationDistance(null);
      setExperienceType("단순 방문");
      refreshMarkers();
    } catch (e: any) {
      console.error("Submit Error:", e);

      // [핵심] 할당량 초과 시에도 로컬에 저장하고 창을 닫음 (사용자 경험 우선)
      if (e.code === 'resource-exhausted' || e.message?.includes('quota')) {
        const pendingReviews = JSON.parse(localStorage.getItem('pending_reviews') || '[]');
        pendingReviews.push({ ...reviewData, id: 'temp_' + Date.now(), isPending: true });
        localStorage.setItem('pending_reviews', JSON.stringify(pendingReviews));

        setSheetOpen(false); // 창 닫기
        setComment(""); setSelectedImages([]); setSelectedTags([]);

        showAlert("등록 요청 완료", "현재 서버 접속자가 많아 동기화가 지연되고 있습니다. 곧 반영될 예정입니다! ✨", "🚀");
        return;
      }

      showAlert("오류 발생", "처리 중 문제가 생겼습니다. 다시 시도해 주세요.", "❌");
    }
  };




  return (
    <div className="page-home">
      <div className="home-search-bar-container">
        <div className={`home-search-bar ${isHistoryOpen ? 'focused' : ''}`} style={{ position: 'relative', zIndex: isHistoryOpen ? 2202 : 400 }}>
          {!searchQuery && <span className="home-search-icon"><Search size={24} color="#8B95A1" /></span>}
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setIsAddressSelected(false); }}
            onKeyDown={e => {
              if (e.key === "Enter" && searchQuery.trim()) {
                const term = searchQuery.trim();
                setRecentSearches(prev => {
                  const next = [term, ...prev.filter(t => t !== term)].slice(0, 10);
                  localStorage.setItem('recent_searches_log', JSON.stringify(next));
                  return next;
                });
                setPostcodeOpen(true);
                setIsHistoryOpen(false);
              }
            }}
            onFocus={() => setIsHistoryOpen(true)}
            placeholder="어떤 집의 방문Log 궁금하세요?"
            className="home-search-input"
          />
          {searchQuery.length > 0 && (
            <div className="home-search-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                className="icon-clear-btn"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery("");
                  setIsAddressSelected(false);
                }}
              >
                {/* 순수 SVG로 그 정해진 원 안을 최대한 꽉 채우는 큼직한 X 구현 */}
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 2L10 10M10 2L2 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span className="home-search-submit">
                <button className="icon-search-btn" onClick={() => {
                  if (searchQuery.trim()) {
                    setPostcodeOpen(true);
                    setIsHistoryOpen(false);
                  }
                }}>
                  <Search size={22} color="#3182F6" strokeWidth={2.5} />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* 최근 검색어 모달 */}
        <AnimatePresence>
          {isHistoryOpen && (
            <>
              <motion.div
                className="home-search-history-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsHistoryOpen(false)}
              />
              <motion.div
                className="home-search-history"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="history-header">
                  <h3>최근 검색어</h3>
                  <button onClick={() => { setRecentSearches([]); localStorage.setItem('recent_searches_log', '[]'); }}>전체 삭제</button>
                </div>
                <div className="history-list" style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                  {recentSearches.length > 0 ? (
                    recentSearches.map((term, idx) => (
                      <div key={`${term}-${idx}`} className="history-item" onClick={() => {
                        setSearchQuery(term);
                        setRecentSearches(prev => {
                          const next = [term, ...prev.filter(t => t !== term)].slice(0, 10);
                          localStorage.setItem('recent_searches_log', JSON.stringify(next));
                          return next;
                        });
                        setPostcodeOpen(true);
                        setIsHistoryOpen(false);
                      }}>
                        <div className="history-item-left">
                          <MapPin size={16} color="#B0B8C1" />
                          <span>{term}</span>
                        </div>
                        <button className="history-delete" onClick={(e) => {
                          e.stopPropagation();
                          const next = recentSearches.filter((_, i) => i !== idx);
                          setRecentSearches(next);
                          localStorage.setItem('recent_searches_log', JSON.stringify(next));
                        }}>✕</button>
                      </div>
                    ))
                  ) : (
                    <div className="history-empty">최근 검색어가 없습니다.</div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div ref={mapElement} className="home-map-container" />

      {/* 찜한 매물만 골라보기 버튼 (내 위치 버튼 위) */}
      <button
        className={`home-favorites-btn ${showFavoritesOnly ? 'active' : ''}`}
        onClick={() => {
          if (!isLoggedIn) {
            showConfirm(
              "로그인이 필요해요 🏠",
              () => navigate('/mypage'),
              "찜한 매물만 모아보려면 로그인이 필요합니다.",
              "🔒",
              () => { }
            );
            return;
          }
          const next = !showFavoritesOnly;
          setShowFavoritesOnly(next);
        }}
        title="찜한 매물만 보기"
      >
        <Star size={24} fill={showFavoritesOnly ? "#FFD43B" : "none"} strokeWidth={2} />
      </button>

      {/* 내 위치로 이동 버튼 */}
      <button
        className={`home-location-btn ${isLocationActive ? 'active' : ''}`}
        onClick={() => {
          if (!navigator.geolocation || !mapInstance.current) return;

          setIsLocating(true);
          setIsLocationActive(true);

          // 이미 마커가 있다면 즉시 이동 후 새로고침
          if (userMarkerRef.current) {
            mapInstance.current.morph(userMarkerRef.current.getPosition(), 17, { duration: 400, easing: 'linear' });
          }

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const userPos = new window.naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
              mapInstance.current.morph(userPos, 17, { duration: 400, easing: 'linear' });

              if (userMarkerRef.current) {
                userMarkerRef.current.setPosition(userPos);
              }
              setIsLocating(false);
            },
            (err) => {
              console.warn('GPS 오류:', err);
              setIsLocating(false);
              if (err.code === 1) alert("위치 권한이 거부되었습니다. 설정에서 권한을 허용해주세요!");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }}
        title="내 위치로 이동"
      >
        <Crosshair size={24} color={isLocationActive ? "#3182F6" : "#A8AFB5"} strokeWidth={2} />
      </button>

      {isAddressSelected && dynamicNeighborhoodTags.length > 0 && (
        <div className="neighborhood-tag-wrapper">
          <div className="tag-scroll-container">
            {dynamicNeighborhoodTags.map(tag => (
              <button key={tag} onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)} className={`tds-chip ${activeTagFilter === tag ? "active" : ""}`}>{tag}</button>
            ))}
          </div>
        </div>
      )}

      {isPostcodeOpen && (
        <div className="postcode-overlay">
          <div className="postcode-backdrop" onClick={() => setPostcodeOpen(false)} />
          <div className="postcode-sheet">

            {/* 내 위치 찾기 로딩 오버레이 */}
            <AnimatePresence>
              {isLocating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="home-locating-overlay"
                >
                  <div className="locating-content">
                    <div className="locating-spinner" />
                    <p>내 주변의 방문Log를 찾는 중...</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="postcode-header"><h2>주소 검색</h2><button onClick={() => setPostcodeOpen(false)} className="postcode-close">✕</button></div>
            <DaumPostcodeEmbed onComplete={(data: any) => {
              const full = data.address;
              setSearchQuery(full);
              setIsAddressSelected(true);
              setPostcodeOpen(false);
              setIsHistoryOpen(false);

              // [추가] 최근 검색어 저장 로직
              setRecentSearches(prev => {
                const next = [full, ...prev.filter(t => t !== full)].slice(0, 10);
                localStorage.setItem('recent_searches_log', JSON.stringify(next));
                return next;
              });
              window.naver.maps.Service.geocode({ query: full }, async (s: any, r: any) => {
                if (s === window.naver.maps.Service.Status.OK && r.v2.addresses.length > 0) {
                  const p = new window.naver.maps.LatLng(r.v2.addresses[0].y, r.v2.addresses[0].x);
                  mapInstance.current.setZoom(19);
                  mapInstance.current.panTo(p);
                  setIsLocationActive(false); // [추가] 주소 검색 이동 시 GPS 비활성화

                  window.naver.maps.Service.reverseGeocode({ coords: p, orders: "roadaddr,addr" }, async (statusRev: any, resRev: any) => {
                    let standardAddress = full;
                    
                    // [최적화] 검색 위치로 이동 즉시 로딩 팝업 노출
                    infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
                    infoWindowInstance.current.setContent(`
                      <div class="iw-container marker loading">
                        <div class="iw-card" style="padding:24px 20px; display:flex; flex-direction:column; align-items:center; gap:12px; min-width:180px;">
                          <div class="iw-loader"></div>
                          <span style="font-size:13px; color:#8B95A1; font-weight:600;">건물 정보 확인 중...</span>
                        </div>
                      </div>
                    `);
                    infoWindowInstance.current.open(mapInstance.current, p);

                    // [유도리 개편] 1차 키워드 검사 (역, 공원 등 절대 금지 구역 여부)
                    const isStrictlyBlocked = !checkIsResidential(full) || (data.buildingName && !checkIsResidential(data.buildingName));
                    let isRes = !isStrictlyBlocked;

                    if (statusRev === window.naver.maps.Service.Status.OK) {
                      const v2Addr = resRev.v2?.address;
                      if (v2Addr) standardAddress = v2Addr.roadAddress || v2Addr.jibunAddress || standardAddress;

                      // 건축물대장 API 정밀 체크
                      const addrResult = resRev.v2.results.find((r: any) => r.name === 'addr');
                      if (addrResult) {
                        const code = addrResult.code?.id;
                        const bun = addrResult.land?.number1;
                        const ji = addrResult.land?.number2;
                        if (code && bun) {
                          const apiResult = await checkBuildingRegistry(code.substring(0, 5), code.substring(5, 10), bun, ji);
                          // API가 주거용이라 하면 당연히 허용, 
                          // 비주거라고 해도 블랙리스트(역, 공원 등)만 아니면 '유도리' 있게 허용 상태(isRes=true) 유지
                          if (apiResult === true) isRes = true;
                        }
                      }
                    }

                    const normalizedFull = normalizeBaseAddress(standardAddress);

                    // [추가] 검색 결과에서도 중복 체크 수행
                    let hasWritten = false;
                    if (isLoggedIn && user?.id) {
                      const qCheck = query(
                        collection(db, "reviews"),
                        where("authorId", "==", user.id),
                        where("address", "==", standardAddress),
                        where("addressDetail", "==", normalizeAddressDetail(addressDetail))
                      );
                      const snapCheck = await getDocs(qCheck);
                      hasWritten = !snapCheck.empty;
                    }

                    // 검색 결과에서도 찜 상태 확인
                    const checkBookmarkSearch = async () => {
                      let isBookmarked = false;
                      if (isLoggedIn && user?.id) {
                        isBookmarked = favoritedAddresses.has(normalizedFull);
                      }


                      // [핵심 추가] 해당 주소지에 실제 리뷰가 존재하는지 카운트 체크
                      const existingLoc = allLocationsRef.current.find(loc => normalizeBaseAddress(loc.address || loc.location) === normalizedFull);
                      const reviewCount = existingLoc ? (existingLoc.count || 0) : 0;
                      const avgRating = existingLoc ? (existingLoc.rating || 0) : 0;

                      infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
                      infoWindowInstance.current.setContent(getInfoWindowMarkup({
                        address: standardAddress,
                        lat: p.lat(),
                        lng: p.lng(),
                        isBookmarked,
                        isResidential: isRes,
                        reviewCount,
                        avgRating,
                        hasWritten
                      }));
                      infoWindowInstance.current.open(mapInstance.current, p);
                    };

                    checkBookmarkSearch();
                  });
                }
              });
            }} autoClose={false} defaultQuery={searchQuery} className="postcode-embed" />
          </div>
        </div>
      )}

      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => { setSheetOpen(false); setEditingReviewId(null); setComment(""); setSelectedTags([]); setSelectedImages([]); setIsVerified(false); setVerificationDistance(null); }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {editingReviewId ? <Pencil size={20} color="#3182F6" /> : <Star size={20} color="#F5A623" fill="#F5A623" />}
            <span>{editingReviewId ? "방문록 수정하기" : "방문록 쓰기"}</span>
          </div>
        }
      >
        {/* 기존 디자인 그대로 복구 (불필요한 wrapper 및 h3 제거) */}
        <div className="sheet-content">
          <div className={`verification-banner ${isVerified ? 'verified' : ''}`}>
            <div className="banner-left">
              <div className="address-header">
                {isVerified && <div className="badge-verify"><CheckCircle2 size={12} /><span>방문자 인증</span></div>}
                <span className="address-text">{selectedAddress}</span>
              </div>
              {!editingReviewId && (
                <p className="address-desc">
                  {isVerifying ? (
                    "📍 위치 확인 중..."
                  ) : isVerified ? (
                    `📍 장소와 ${verificationDistance}m 거리에 있어 방문 인증이 완료되었습니다.`
                  ) : (
                    "📍 장소와 멀리 떨어져 있어 인증 마크를 달 수 없어요."
                  )}
                </p>
              )}
            </div>
            {!editingReviewId && (
              <button className="refresh-loc-btn" onClick={() => verifyLocation()}>
                <RefreshCw size={16} className={isVerifying ? 'spin' : ''} />
              </button>
            )}
          </div>

          <div className="experience-section">
            <div className="section-title">
              <ClipboardCheck size={16} color="#3182F6" />
              <span>방문 유형 선택</span>
            </div>
            <div className="experience-chips">
              {[
                { label: "단순 방문", icon: <MapPin size={14} /> },
                { label: "거주 경험", icon: <HomeIcon size={14} /> },
                { label: "매물 투어", icon: <Search size={14} /> }
              ].map(type => (
                <button
                  key={type.label}
                  type="button"
                  className={`experience-chip ${experienceType === type.label ? 'active' : ''}`}
                  onClick={() => setExperienceType(type.label)}
                >
                  <span className="icon">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="section-title">
              <ImageIcon size={16} color="#3182F6" />
              <span>방문 사진 및 동영상</span>
            </div>
            <div className="photo-section">
              <button className="photo-button" onClick={() => fileInputRef.current?.click()}>
                <Camera size={24} />
                <span>{selectedImages.length}/10</span>
              </button>
              <input type="file" multiple accept="image/*,video/*" ref={fileInputRef} onChange={e => setSelectedImages(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden-file-input" />
              {selectedImages.map((file, i) => (
                <div key={i} className="preview-item">
                  {file.type.startsWith('video/') ? (
                    <video src={URL.createObjectURL(file)} muted className="preview-video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => setViewerImage(URL.createObjectURL(file))} />
                  ) : (
                    <img src={URL.createObjectURL(file)} onClick={() => setViewerImage(URL.createObjectURL(file))} />
                  )}
                  <button className="preview-remove" onClick={(ev) => { ev.stopPropagation(); handleRemoveImage(i); }}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '20px', marginBottom: '12px' }}>
            <div className="section-title">
              <MapPin size={16} color="#3182F6" />
              <span>상세주소 (선택)</span>
            </div>
            <input
              type="text"
              className="comment-textarea"
              style={{
                height: '52px',
                padding: '0 16px',
                fontSize: '15.5px',
                borderRadius: '14px',
                backgroundColor: '#F2F4F6',
                border: 'none',
                width: '100%',
                outline: 'none'
              }}
              placeholder="예: 101동 201호, 2층 왼쪽, 반지하 등"
              value={addressDetail}
              onChange={e => setAddressDetail(e.target.value)}
            />
            <p style={{ fontSize: '11px', color: '#8B95A1', marginTop: '6px', marginLeft: '4px' }}>
              * 단독/다가구는 층수나 위치를 적어주시면 더 도움이 돼요.
            </p>
          </div>

          <div>
            <div className="section-title">
              <MessageSquare size={16} color="#3182F6" />
              <span>솔직한 방문 후기</span>
            </div>
            <textarea className="comment-textarea" placeholder="방문록을 작성해주세요.(5자 이상)" value={comment} onChange={e => setComment(e.target.value)} />
          </div>

          <div>
            <div className="section-title">
              <Heart size={16} color="#F04452" fill="#F04452" />
              <span>항목별 만족도</span>
            </div>
            <RatingRow label="채광" value={ratings.light} onChange={v => setRatings(r => ({ ...r, light: v }))} />
            <RatingRow label="소음" value={ratings.noise} onChange={v => setRatings(r => ({ ...r, noise: v }))} />
            <RatingRow label="수압" value={ratings.water} onChange={v => setRatings(r => ({ ...r, water: v }))} />
          </div>

          <div>
            <div className="section-title">
              <Tag size={16} color="#3182F6" />
              <span>태그</span>
            </div>
            {selectedTags.length > 0 && (<div className="selected-tags-container">{selectedTags.map(t => (<button key={t} onClick={() => handleTagToggle(t)} className="tag-chip active">{t} <span className="delete-icon">✕</span></button>))}</div>)}
            <div className="custom-tag-field-wrapper"><span className="tag-prefix">#</span><input type="text" placeholder="태그 직접 입력" value={customTag} onChange={e => setCustomTag(e.target.value.replace('#', ''))} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddCustomTag())} className="custom-tag-field-input" /><button className="tag-add-btn" onClick={handleAddCustomTag}><Plus size={20} /></button></div>
            <div className="recommend-tag-section"><p className="recommend-title">추천 태그</p><div className="tags-wrapper">{tags.filter(t => !selectedTags.includes(t)).map(t => (<button key={t} onClick={() => handleTagToggle(t)} className="tag-chip recommended">{t}</button>))}</div></div>
          </div>
        </div>
        <div className="submit-wrapper">
          <button
            className="iw-button"
            onClick={() => {
              if (!isLoggedIn) {
                showConfirm(
                  "앗! 로그인이 필요해요 🏠",
                  () => navigate('/mypage'),
                  "방문록을 작성하려면 로그인이 필요해요. 로그인 후 소중한 발자국을 남겨주세요!",
                  "🔒",
                  () => { }
                );
                return;
              }
              handleSubmitReview();
            }}
            disabled={comment.length < 5}
          >
            {editingReviewId ? "수정 완료하기" : "방문록 등록하기"}
          </button>
        </div>
      </BottomSheet>

      {isReadListOpen && (
        <div className="home-read-overlay">
          <div className="overlay-header">
            <button className="back-btn" onClick={() => setReadListOpen(false)}><ArrowLeft size={24} /></button>
            <div className="info"><h1>이 공간의 방문록</h1><p>{selectedAddress || "나의 위치 근처"}</p></div>
          </div>
          <div className="overlay-filter-bar">
            <div className="filter-count">전체 {reviews.length}개</div>
            <button
              className={`filter-toggle-btn ${showVerifiedOnly ? 'active' : ''}`}
              onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
            >
              <CheckCircle2 size={14} />
              <span>인증된 방문록만 보기</span>
            </button>
          </div>
          <div className="overlay-list">
            {isLoadingReviews ? (
              <div className="loading-state">방문록을 불러오는 중...</div>
            ) : reviews.length > 0 ? (
              reviews
                .filter(r => !showVerifiedOnly || r.isVerified)
                .map((review, index) => (
                  <div key={review.id} className={`review-card ${index > 0 && !user?.canViewAll ? 'blurred' : ''} ${review.isVerified ? 'verified' : ''}`} onClick={async () => {
                    if (index > 0 && !user?.canViewAll) {
                      const commonMsg = "모든 방문록을 보시려면 현재 거주 중인 집이나 전에 살던 집의 방문록을 남겨주세요. 모든 방문록이 즉시 열립니다! 🏠";

                      if (!isLoggedIn) {
                        showConfirm(
                          "방문록 작성하고 전체보기 ✨",
                          () => navigate('/mypage'),
                          commonMsg,
                          "📍",
                          () => { }
                        );
                        return;
                      }

                      showConfirm(
                        "방문록 작성하고 전체보기 ✨",
                        async () => {
                          setReadListOpen(false);

                          // [핵심 개선] 현재 GPS 기반 위치로 포커싱 및 작성 유도
                          if (navigator.geolocation) {
                            setIsLocating(true);
                            navigator.geolocation.getCurrentPosition((pos) => {
                              const userPos = new window.naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
                              mapInstance.current.morph(userPos, 19, { duration: 500, easing: "linear" });

                              // 현재 위치 역지오코딩하여 인포윈도우 오픈
                              window.naver.maps.Service.reverseGeocode({
                                coords: userPos,
                                orders: "roadaddr,addr"
                              }, (status: any, res: any) => {
                                if (status === window.naver.maps.Service.Status.OK) {
                                  const addr = res.v2.address.roadAddress || res.v2.address.jibunAddress;
                                  const stdAddr = normalizeBaseAddress(addr);

                                  // 해당 좌표로 지도 중심 이동 후 정보창 수동 트리거
                                  setTimeout(() => {
                                    window.__openWriteSheet(stdAddr, pos.coords.latitude, pos.coords.longitude);
                                  }, 600);
                                }
                              });
                              setIsLocating(false);
                            }, (err) => {
                              console.error("GPS Error:", err);
                              setIsLocating(false);
                              showAlert("위치 파악 실패", "현재 위치를 알 수 없어 가장 가까운 장소에서 직접 선택해 주세요.", "📍");
                            });
                          }
                        },
                        commonMsg,
                        "📍"
                      );
                      return;
                    }
                    addRecentLog(review.id);
                    setSelectedReview(review);
                    setActiveMenuId(null);
                  }}>
                    <div className="card-top">
                      <div className="card-tags">
                        <div className={`experience-badge ${review.experienceType === '거주 경험' ? 'resident' : review.experienceType === '매물 투어' ? 'visit' : ''}`}>
                          <span className="icon">
                            {review.experienceType === '거주 경험' ? <HomeIcon size={12} /> : review.experienceType === '매물 투어' ? <Search size={12} /> : <MapPin size={12} />}
                          </span>
                          <span>{review.experienceType || "단순 방문"}</span>
                        </div>
                        {review.isVerified && (
                          <div className="card-verify-badge">
                            <CheckCircle2 size={12} />
                            <span>방문자 인증</span>
                          </div>
                        )}
                      </div>
                      {/* [복구] 본인 게시물인 경우에만 더보기 아이콘 표시 */}
                      {user && user.id === review.authorId && (
                        <div className="card-more-container" style={{ position: 'relative' }}>
                          <button
                            className="card-more-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === review.id ? null : review.id);
                            }}
                          >
                            <MoreHorizontal size={20} color="#B0B8C1" />
                          </button>
                          {activeMenuId === review.id && (
                            <div className="card-dropdown-menu" onClick={e => e.stopPropagation()}>
                              <button onClick={() => { handleEditReview(review); setActiveMenuId(null); }}>
                                <Pencil size={14} />
                                <span>수정하기</span>
                              </button>
                              <button className="delete" onClick={() => { handleDeleteReview(review.id); setActiveMenuId(null); }}>
                                <Trash2 size={14} />
                                <span>삭제하기</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="card-address" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#8B95A1', marginBottom: '8px', padding: '0 4px' }}>
                      <MapIcon size={12} color="#3182F6" />
                      <span>{review.location}</span>
                      {review.addressDetail && (
                        <span style={{ color: '#3182F6', fontWeight: 600, marginLeft: '2px' }}>
                          {formatAddressDetail(review.addressDetail)}
                        </span>
                      )}
                    </div>
                    <div className="card-body">
                      <p className="card-content">{review.content}</p>
                      <div className="card-thumb">
                        {review.images && review.images.length > 0 ? (
                          <img src={review.images[0]} alt="thumb" />
                        ) : (
                          <div className="no-image-thumb">이미지 없음</div>
                        )}
                      </div>
                    </div>
                    {review.tags && review.tags.length > 0 && (
                      <div className="card-bottom-tags">
                        {review.tags.slice(0, 3).map((t: string, idx: number) => (
                          <span key={`${t}-${idx}`} className="tag-text">#{t.replace(/^#/, '')}</span>
                        ))}
                        {review.tags.length > 3 && <span className="tag-more">+{review.tags.length - 3}</span>}
                      </div>
                    )}
                    <div className="card-footer">
                      <div className="stats">
                        <span className="stat-item"><Heart size={14} /> {review.likes}</span>
                        <span className="stat-item"><Eye size={14} /> {review.views}</span>
                      </div>
                      <span className="date" style={{ marginLeft: "auto", fontSize: "12px", color: "#8B95A1" }}>{review.date}</span>
                    </div>
                  </div>
                ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">👟</div>
                <h3>아직 작성된 방문록이 없어요</h3>
                <p>이 공간의 첫 번째 발도장을 남기고<br />다른 사람들에게 소중한 정보를 공유해보세요.</p>
                <button
                  className="empty-state-cta"
                  onClick={() => {
                    setReadListOpen(false);
                    if (selectedAddress) {
                      const pos = mapInstance.current.getCenter();
                      window.__openWriteSheet(selectedAddress, pos.lat(), pos.lng());
                    }
                  }}
                >
                  첫 방문록 작성하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedReview && (
        <ReviewDetail
          reviewId={selectedReview.id}
          onClose={() => setSelectedReview(null)}
          onEdit={() => handleEditDetail(selectedReview)}
          onDelete={() => handleDeleteDetail(selectedReview.id)}
          onLoginRequired={() => {
            showConfirm(
              "로그인 필요",
              () => navigate('/mypage'),
              "공감 및 댓글 기능은 로그인 후 이용 가능합니다.",
              "🔒"
            );
          }}
        />
      )}

      {viewerImage && (
        <div className="fullscreen-viewer-overlay" onClick={() => setViewerImage(null)}><div className="viewer-header"><button onClick={() => setViewerImage(null)} className="close-btn">✕</button></div><div className="viewer-content"><img src={viewerImage} onClick={e => e.stopPropagation()} /></div></div>
      )}

      {isAdShowing && (
        <div className="ad-overlay">
          <div className="ad-content">
            <div className="ad-timer">광고 시청 중... (2초)</div>
            <div className="ad-placeholder">🏢 깨끗한 방 찾을 땐? 방문Log</div>
          </div>
        </div>
      )}


      {modalConfig.isOpen && (
        <div className="tds-modal-overlay">
          <div className="tds-modal-content">
            <div className="toss-face-icon">{modalConfig.icon}</div>
            <h2 className="tds-modal-title">{modalConfig.title}</h2>
            {modalConfig.desc && <p className="tds-modal-desc">{modalConfig.desc}</p>}
            <div className="tds-modal-footer" style={{ display: 'flex', gap: '8px', width: '100%' }}>
              {modalConfig.cancelText && (
                <button
                  className="tds-btn-secondary"
                  style={{
                    flex: 1,
                    height: '54px',
                    background: '#F2F4F6',
                    color: '#4E5968',
                    border: 'none',
                    borderRadius: '16px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                    if (modalConfig.onCancel) modalConfig.onCancel();
                  }}
                >
                  {modalConfig.cancelText}
                </button>
              )}
              <button
                className="tds-btn-primary"
                style={{
                  flex: 1,
                  height: '54px',
                  background: '#3182F6',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setModalConfig(prev => ({ ...prev, isOpen: false }));
                  if (modalConfig.onConfirm) modalConfig.onConfirm();
                }}
              >
                {modalConfig.confirmText || "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showWelcomeModal && <WelcomeModal onClose={() => setShowWelcomeModal(false)} />}
      <Toast
        message="버튼을 한 번 더 누르면 종료됩니다."
        isVisible={showExitToast}
        onClose={() => setShowExitToast(false)}
        icon={LogoImg}
      />
    </div>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (<div className="rating-row"><span className="rating-label">{label}</span><div className="stars">{[1, 2, 3, 4, 5].map(s => (<button key={s} onClick={() => onChange(s)} className={`star-button ${s <= value ? "active" : ""}`}><Star size={28} className={s <= value ? "fill-active" : "fill-inactive"} /></button>))}</div></div>);
}
