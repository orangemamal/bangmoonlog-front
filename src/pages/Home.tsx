import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Video, PlayCircle, Star, CheckCircle2, Heart, Eye, ArrowLeft, Search, X, XCircle, Plus, RefreshCw, MoreHorizontal, Pencil, Trash2, MapPin, Map as MapIcon, Home as HomeIcon, ClipboardCheck, Image as ImageIcon, MessageSquare, Tag, Crosshair, Sparkles } from "lucide-react";
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
  orderBy,
  where,
  DocumentData,
  QuerySnapshot,
  QueryDocumentSnapshot,
  doc,
  getDoc,
  serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";
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
import { AISearchModal } from "../components/home/AISearchModal";
import { InquiryModal } from "../components/common/InquiryModal";
import { DiscoveryBottomSheet } from "../components/home/DiscoveryBottomSheet";
import { MarkerInfoWindow } from "../components/home/MarkerInfoWindow";
import { MarkerLoadingWindow } from "../components/home/MarkerLoadingWindow";
import { normalizeAddressDetail, formatAddressDetail, normalizeBaseAddress } from "../utils/addressUtils";
import { calculateDistance } from "../utils/geoUtils";
import { Toast } from "../components/common/Toast";
import LogoImg from "../assets/images/favicon.svg";
import { analyzeReviewWithAI, askGemini } from "../utils/gemini";
import { calculateUserStats, getMyBadges } from "../utils/BadgeLogic";

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
// [유틸리티] 거주용 건물 여부 판단 (비거주 시설 필터링 고도화)
const checkIsResidential = (text: string) => {
  if (!text) return false;

  // 1. 명백한 주거용 키워드 (화이트리스트 - 최우선 순위)
  const whiteList = [
    "아파트", "빌라", "맨션", "주택", "오피스텔", "다세대", "다가구", "원룸",
    "투룸", "고시원", "고시텔", "빌리지", "리빙텔", "캐슬", "파크뷰", "단지", "전원", "다중", "쉐어하우스"
  ];
  if (whiteList.some(keyword => text.includes(keyword))) return true;

  // 2. 명백한 비거주지 강력 블랙리스트 (단어 포함 시 즉시 차단)
  const strongBlacklist = [
    "지하철", "지하상가", "지하쇼핑", "가로판매대", "구두수선", "지하차도", "보도육교",
    "공영주차장", "공공주차장", "환승센터", "지하역사", "역사내", "승강장", "터미널"
  ];
  if (strongBlacklist.some(keyword => text.includes(keyword))) return false;

  // 3. 인프라 시설 블랙리스트 (텍스트가 해당 단어로 끝나거나 공여/시설 명칭인 경우)
  const infrastructureKeywords = [
    "역", "출구", "공원", "광장", "교차로", "숲", "유원지", "산", "계곡",
    "공항", "시장", "경찰서", "파출소", "소방서", "우체국", "시청", "구청", "동주민센터",
    "궁", "문화재", "유적지", "능", "단", "묘", "성곽", "경기장", "운동장"
  ];

  const isBlocked = infrastructureKeywords.some(keyword => {
    // [개선] 단어 자체가 독립적이거나(서울 역), 특정 명칭의 접미사로 쓰인 경우(탑골공원) 차단
    // 단, 한 글자 키워드(역, 산 등)는 오탐 방지를 위해 앞에 공백이 있거나 두 글자 이상의 고유명사 뒤에 붙은 경우만 정교하게 체크
    if (keyword.length === 1) {
      const singleRegex = new RegExp(`[가-힣]{2,}${keyword}$|(^|\\s)${keyword}($|\\s)`);
      return singleRegex.test(text);
    }
    // 두 글자 이상(공원, 광장 등)은 텍스트 내 포함 여부로 더 넓게 차단 (이미 화이트리스트에서 주거지는 걸러짐)
    return text.includes(keyword);
  });

  // 4. 특정 명승지/랜드마크 직접 차단
  const specificLandmarks = [
    "경복궁", "창덕궁", "덕수궁", "창경궁", "종묘", "남산타워", "서울타워",
    "어린이대공원", "올림픽공원", "서울숲", "월드컵공원", "한강공원", "탑골공원"
  ];
  if (specificLandmarks.some(name => text.includes(name))) return false;

  return !isBlocked;
};

// [유틸리티] 건축물대장 API를 통한 실시간 주거용 확인
const checkBuildingRegistry = async (sigunguCd: string, bjdongCd: string, bun: string, ji: string) => {
  try {
    const res = await fetch(`/api/getBuildingInfo?sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&bun=${bun}&ji=${ji}`);
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return null;
    }

    const data = await res.json();
    // [개선] 주거 여부와 함께 주용도 명칭을 함께 반환
    return {
      isResidential: data.isResidential,
      purpose: data.buildings?.[0]?.purpose || null
    };
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

// [유틸리티] 동영상 클라이언트 사이드 압축 (MediaRecorder 활용)
// 고화질 원본을 720p급 비트레이트로 재인코딩하여 업로드 속도 5~10배 개선
const compressVideo = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 최대 가로 1280px (720p급) 유지하며 비율 조정
      const MAX_WIDTH = 1280;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > MAX_WIDTH) {
        height = (MAX_WIDTH / width) * height;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;

      // 브라우저가 지원하는 코덱 확인 (WebM이 가장 범용적이며 압축률 좋음)
      const mimeType = 'video/webm;codecs=vp8';
      const stream = canvas.captureStream(30); // 30fps
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 1500000 // 1.5Mbps (모바일 스트리밍 적정 수준)
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const compressedBlob = new Blob(chunks, { type: 'video/webm' });
        console.log(`📹 [Compression] Original: ${(file.size / 1024 / 1024).toFixed(2)}MB -> Compressed: ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`);
        URL.revokeObjectURL(videoUrl);
        resolve(compressedBlob);
      };

      recorder.start();
      video.play();

      // 매 프레임 캔버스에 그리기
      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx?.drawImage(video, 0, 0, width, height);
        requestAnimationFrame(drawFrame);
      };
      drawFrame();

      video.onended = () => {
        recorder.stop();
      };
    };

    video.onerror = (err) => {
      URL.revokeObjectURL(videoUrl);
      reject(err);
    };

    // 타임아웃 방지 (최대 30초)
    setTimeout(() => {
      if (video.paused) {
        URL.revokeObjectURL(videoUrl);
        reject(new Error("Compression Timeout"));
      }
    }, 30000);
  });
};

// [유틸리티] 비디오 및 대용량 파일용 Firebase Storage 업로드 (진행률 추적 지원)
const uploadMediaToStorage = (
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Blob일 경우 name이 없을 수 있으므로 안전하게 처리
    const fileNameAttr = (file as any).name || `compressed_${Date.now()}.webm`;
    const fileExt = fileNameAttr.split('.').pop();
    const fileName = `media_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storageRef = ref(storage, `reviews/${fileName}`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => reject(error),
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          resolve(downloadURL);
        });
      }
    );
  });
};


export function Home() {
  console.log("🏠 [Home] Component Rendering");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [inquiryData, setInquiryData] = useState<{ type: string; address?: string }>({ type: 'report' });

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
      setInquiryData({ type: 'report', address: addr });
      setIsInquiryModalOpen(true);
    };
  }, []);

  // InfoWindow 전용 React Root 및 컨테이너
  const infoWindowRootRef = useRef<any>(null);
  const infoWindowContainerRef = useRef<HTMLDivElement>(document.createElement('div'));

  const adjustInfoWindowWrapper = useCallback(() => {
    if (!infoWindowInstance.current) return;
    const update = () => {
      const container = infoWindowInstance.current.getContentElement();
      if (container && container.parentElement) {
        const parent = container.parentElement;
        parent.style.setProperty('transform', 'translate(0, -100%)', 'important');
        parent.style.setProperty('height', '0', 'important');
        parent.style.setProperty('overflow', 'visible', 'important');
        parent.style.setProperty('pointer-events', 'none', 'important');

        if (parent.parentElement) {
          const grandParent = parent.parentElement;
          grandParent.style.setProperty('transform', 'translate(0, -100%)', 'important');
          grandParent.style.setProperty('height', '0', 'important');
          grandParent.style.setProperty('overflow', 'visible', 'important');
          grandParent.style.setProperty('pointer-events', 'none', 'important');
        }
      }
    };
    update();
    setTimeout(update, 10);
    setTimeout(update, 100);
  }, []);

  const renderInfoWindow = useCallback((component: React.ReactNode, isNoneMarker: boolean = false) => {
    const container = document.createElement('div');
    // [중요] React가 렌더링되기 전에 네이버 지도가 위치를 계산하므로, 
    // 클래스를 즉시 부여하여 너비(280px)와 transform(-50%, -100%)이 적용되게 함.
    container.className = `iw-container ${isNoneMarker ? 'none-marker' : 'marker'}`;
    container.style.width = '280px';
    container.style.display = 'block';
    container.style.setProperty('height', '0', 'important');
    container.style.setProperty('overflow', 'visible', 'important');
    container.style.setProperty('pointer-events', 'none', 'important');

    const root = createRoot(container);
    root.render(component);
    return container;
  }, []);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const { addRecentLog } = useRecentLogs();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedCoord, setSelectedCoord] = useState<{ lat: number, lng: number } | null>(null);
  const [currentUserLocation, setCurrentUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isAISearchOpen, setIsAISearchOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [lastAiResponse, setLastAiResponse] = useState<{ address: string; reason: string; lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddressSelected, setIsAddressSelected] = useState(false);
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isPostcodeOpen, setPostcodeOpen] = useState(false);
  const [isReadListOpen, setReadListOpen] = useState(false);

  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [ratings, setRatings] = useState({ light: 3, noise: 3, water: 3 });
  const [addressDetail, setAddressDetail] = useState("");
  const [comment, setComment] = useState("");
  const [isLocationActive, setIsLocationActive] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<(File | string)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiStep, setAiStep] = useState<'idle' | 'analyzing' | 'passed' | 'rejected' | 'error'>('idle');
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
  const analysisCircleRef = useRef<any>(null);

  // [신규] 건축물 확인 결과 캐시 (성능 최적화용)
  const buildingCacheRef = useRef<Record<string, { isResidential: boolean; purpose: string | null }>>({});

  // 검색 기록 상태
  const [isLocating, setIsLocating] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recent_searches_log');
    return saved ? JSON.parse(saved) : [];
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // 전역 상태 및 UI 제어 상태 (useEffect 이전에 선언 필요)
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [customTag, setCustomTag] = useState("");
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [isPanoramaOpen, setIsPanoramaOpen] = useState(false);
  const [isRoadviewMode, setIsRoadviewMode] = useState(false); // 로드뷰 탐색 모드
  const [mapCenterCoord, setMapCenterCoord] = useState<{ lat: number, lng: number } | null>(null);
  const [currentRegionName, setCurrentRegionName] = useState<string | null>(null);
  const [aiCommuteInsight, setAiCommuteInsight] = useState<{ score: number, text: string, source?: string } | null>(null);
  const [isAnalyzingCommute, setIsAnalyzingCommute] = useState(false);
  const [aiSafetyInsight, setAiSafetyInsight] = useState<{ score: number, text: string, source?: string } | null>(null);
  const [isAnalyzingSafety, setIsAnalyzingSafety] = useState(false);
  const [aiBarrierFreeInsight, setAiBarrierFreeInsight] = useState<{ score: number, text: string, source?: string } | null>(null);
  const [isAnalyzingBarrierFree, setIsAnalyzingBarrierFree] = useState(false);
  const [isAiAnalysisMode, setIsAiAnalysisMode] = useState(false);
  const [analysisRadius, setAnalysisRadius] = useState(100);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationDistance, setVerificationDistance] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [experienceType, setExperienceType] = useState("단순 방문");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoritedAddresses, setFavoritedAddresses] = useState<Set<string>>(new Set());
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const favoritedAddressesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    favoritedAddressesRef.current = favoritedAddresses;
  }, [favoritedAddresses]);

  // AI 분석 기능 안내 툴팁 표시 로직
  useEffect(() => {
    const timer = setTimeout(() => setShowAiTooltip(true), 1500);
    const hideTimer = setTimeout(() => setShowAiTooltip(false), 5500); 
    return () => { 
      clearTimeout(timer); 
      clearTimeout(hideTimer); 
    };
  }, []);
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

  // [추가] 전체 방문록 실시간 동기화 (마커 실시간 반영용)
  useEffect(() => {
    setIsLoadingReviews(true);
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Review[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        list.push({ id: doc.id, ...data } as Review);
      });
      setReviews(list);
      setIsLoadingReviews(false);
      console.log("📝 [Sync] 전체 방문록 실시간 동기화:", list.length, "건");
    }, (error) => {
      console.error("Reviews sync error:", error);
      setIsLoadingReviews(false);
    });

    return () => unsubscribe();
  }, []); // 컴포넌트 마운트 시 1회 등록

  // [신규] AI 출퇴근 인사이트 자동 생성 엔진
  useEffect(() => {
    if (!currentRegionName || reviews.length === 0) return;

    const generateInsight = async () => {
      setIsAnalyzingCommute(true);
      try {
        // 1. 분석 모드에 따른 리뷰 필터링 (레이더 모드 vs 동네 모드)
        const dongName = currentRegionName.split(' ').pop() || '';
        const baseReviews = isAiAnalysisMode
          ? reviews.filter(r => {
              if (!mapCenterCoord || !r.lat || !r.lng) return false;
              const dist = calculateDistance(mapCenterCoord.lat, mapCenterCoord.lng, r.lat, r.lng);
              return dist <= analysisRadius;
            })
          : reviews.filter(r => (r.address || r.location || '').includes(dongName));

        const commuteReviews = baseReviews.filter(r => 
          /(출퇴근|지하철|버스|역|정류장|교통|걷기|언덕|평지|소음|번잡)/.test(r.content)
        ).slice(0, 5);

        const analysisScope = isAiAnalysisMode ? `반경 ${analysisRadius}m` : `'${dongName}' 지역`;

        // 2. [추가] 실제 공공데이터(지하철 혼잡도) 가져오기 시도
        // 동 이름을 기반으로 가장 가까운 역 이름을 추측 (실제 구현 시 역 매핑 테이블 필요)
        let stationName = dongName.replace('동', '');
        
        // [데모용] 주요 지역 역명 매핑 보정
        const stationMapping: {[key: string]: string} = {
          '다': '을지로입구',
          '무교': '을지로입구',
          '서린': '광화문',
          '태평로': '시청',
          '남대문로': '을지로입구',
          '회현': '회현',
          '명': '명동'
        };
        
        if (stationMapping[stationName]) {
          stationName = stationMapping[stationName];
        }

        const publicData = await import('../services/publicDataService').then(s => s.getSubwayCongestion(stationName));
        
        let publicStat = "해당 지역의 실시간 교통 수치 데이터를 불러올 수 없습니다.";
        if (publicData && publicData.RealtimeSubwayCongestion && publicData.RealtimeSubwayCongestion.row) {
          const stat = publicData.RealtimeSubwayCongestion.row[0];
          publicStat = `실시간 데이터 분석 결과: 현재 ${stationName}역의 혼잡도는 '${stat.CONGEST_LVL || '보통'}' 수준입니다. (수치: ${stat.CONGEST_LVL || 0}%)`;
        } else if (stationName) {
          publicStat = `${stationName} 인근 지하철역의 실시간 혼잡도 데이터를 조회했으나, 현재 제공되지 않는 구간입니다.`;
        }

        // 방문록이 없고 공공데이터도 실패했을 때만 중단
        if (baseReviews.length === 0 && !publicData) {
          setAiCommuteInsight({
            score: 50,
            text: `${currentRegionName} 지역의 상세 데이터를 수집 중입니다. 잠시 후 다시 확인해주세요!`,
            source: "데이터 수집 중"
          });
          setIsAnalyzingCommute(false);
          return;
        }

        const reviewSummary = commuteReviews.length > 0 
          ? commuteReviews.map(r => `- ${r.content}`).join('\n')
          : `${analysisScope} 내에 교통 관련 거주자 리뷰가 아직 존재하지 않습니다. 공공 데이터 수치를 중심으로 분석해주세요.`;
        
        const prompt = `
          당신은 주거 및 교통 데이터 분석 전문가입니다. 
          아래는 ${analysisScope}에 대한 [공공 데이터 수치]와 [거주자 실제 리뷰 ${commuteReviews.length}건]입니다.
          이 데이터를 기반으로 '출퇴근 쾌적도 지수(0~100)'와 '요약 인사이트'를 작성해주세요.
          
          [공공 데이터 팩트]:
          ${publicStat}
          
          [거주자 실제 리뷰]:
          ${reviewSummary}
          
          분석 지침:
          1. 거주자 리뷰가 없더라도 제공된 [공공 데이터 팩트]만으로 해당 지역의 교통 편의성을 객관적으로 평가하십시오.
          2. 리뷰가 있다면 공공 데이터와 비교하여 '체감 만족도'를 함께 분석하십시오.
          3. 분석 리포트(text)는 반드시 '한 문장'으로, 사용자가 직관적으로 이해할 수 있게 '간결하고 심플하게' 작성하십시오. (불필요한 수식어나 긴 설명 금지)
          4. 분석 리포트 서두에 "${analysisScope} 방문록 ${commuteReviews.length}건과 실시간 데이터를 분석한 결과," 와 같은 문구를 넣어 신뢰도를 높이십시오.
          
          응답 형식(JSON):
          {
            "score": 숫자(0~100),
            "text": "위 지침을 따른 전문적인 리포트",
            "source": "${stationName}역 실시간 혼합도 및 ${analysisScope} 리뷰 ${commuteReviews.length}건"
          }
        `;

        const response = await askGemini(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          setAiCommuteInsight(result);
        } else {
          throw new Error("Invalid AI Response Format");
        }
      } catch (error) {
        console.error("❌ [AI 인사이트] 생성 오류:", error);
        setAiCommuteInsight({
          score: 0,
          text: "공공 데이터와 리뷰를 결합하는 중에 작은 문제가 발생했어요. 잠시 후 다시 시도해 주세요!"
        });
      } finally {
        setIsAnalyzingCommute(false);
      }
    };

    // 지도가 멈추고 0.8초 후에 분석 시작 (너무 빈번한 호출 방지)
    const timer = setTimeout(generateInsight, 800);
    return () => clearTimeout(timer);
  }, [currentRegionName, mapCenterCoord, analysisRadius, isAiAnalysisMode, reviews]);

  // [신규] AI 안심 귀가 리포트 생성 엔진
  useEffect(() => {
    if (!currentRegionName || !mapCenterCoord || reviews.length === 0) return;

    const generateSafetyInsight = async () => {
      setIsAnalyzingSafety(true);
      try {
        // 1. 분석 모드에 따른 리뷰 필터링
        const dongName = currentRegionName.split(' ').pop() || '';
        const baseReviews = isAiAnalysisMode
          ? reviews.filter(r => {
              if (!mapCenterCoord || !r.lat || !r.lng) return false;
              const dist = calculateDistance(mapCenterCoord.lat, mapCenterCoord.lng, r.lat, r.lng);
              return dist <= analysisRadius;
            })
          : reviews.filter(r => (r.address || r.location || '').includes(dongName));

        const safetyReviews = baseReviews.filter(r => 
          /(치안|안전|밤길|골목|가로등|CCTV|어둡다|밝다|경찰|무섭다|안심)/.test(r.content)
        ).slice(0, 5);

        const analysisScope = isAiAnalysisMode ? `반경 ${analysisRadius}m` : `'${dongName}' 지역`;

        // 2. 공공데이터(CCTV + 사고 다발지역) 가져오기
        const { getNearbyCCTV, getAccidentHotspots } = await import('../services/publicDataService');
        
        const [cctvData, accidentData] = await Promise.all([
          getNearbyCCTV(mapCenterCoord.lat, mapCenterCoord.lng, analysisRadius),
          getAccidentHotspots(mapCenterCoord.lat, mapCenterCoord.lng)
        ]);
        
        let safetyStat = "";
        let cctvCount = 0;
        let accidentCount = 0;

        // CCTV 데이터 정리
        if (cctvData && cctvData.response && cctvData.response.body) {
          cctvCount = cctvData.response.body.totalCount || 0;
          safetyStat += `[CCTV 현황]: 주변 공공 CCTV 약 ${cctvCount}대 확인. `;
        }
        
        // 사고 다발지역 데이터 정리
        if (accidentData && accidentData.response && accidentData.response.body) {
          accidentCount = accidentData.response.body.totalCount || 0;
          safetyStat += `[사고 위험]: 인근 교통사고 다발 지역 ${accidentCount}곳 감지. `;
        }

        if (!safetyStat) {
          safetyStat = "현재 해당 지역의 실시간 안전 지표 데이터를 수집 중입니다.";
        }

        const reviewSummary = safetyReviews.length > 0 
          ? safetyReviews.map(r => `- ${r.content}`).join('\n')
          : `${analysisScope} 내에 치안 관련 거주자 리뷰가 아직 존재하지 않습니다. 인프라 설치 현황과 사고 기록을 중심으로 분석해주세요.`;
        
        const prompt = `
          당신은 도시 안전 및 치안 분석 전문가입니다. 
          ${analysisScope}의 [보안 및 사고 데이터]와 [거주자 실제 리뷰 ${safetyReviews.length}건]를 기반으로 '안심 귀가 지수(0~100)'와 '요약 인사이트'를 작성해주세요.
          
          [보안 및 사고 데이터]:
          ${safetyStat}
          
          [거주자 실제 리뷰]:
          ${reviewSummary}
          
          분석 지침:
          1. CCTV 대수(보안 시설)와 교통사고 다발지역(위험 요소) 데이터를 종합하여 안전 점수를 산출하십시오.
          2. 거주자 리뷰가 없더라도 제공된 수치 데이터만으로 해당 지역의 객관적인 안전 등급을 산출하십시오.
          3. 리뷰가 있는 경우, 실제 거주자들이 느끼는 '체감 안전도'와 인프라/사고 기록의 차이를 분석하십시오.
          4. 분석 리포트(text)는 반드시 '한 문장'으로, 아주 간결하고 명확하게 작성하십시오. (사용자가 1초 만에 읽을 수 있도록)
          5. 분석 리포트 서두에 "${analysisScope} CCTV 현황 및 사고 기록과 방문록 ${safetyReviews.length}건을 종합 분석한 결과," 와 같은 문구를 넣어 신뢰도를 높이십시오.
          
          응답 형식(JSON):
          {
            "score": 숫자(0~100),
            "text": "치안 및 사고 현황을 기반으로 한 전문적인 분석 리포트",
            "source": "${analysisScope} 공공 CCTV(${cctvCount}대), 사고 기록(${accidentCount}건) 및 ${safetyReviews.length}건의 안전 리뷰"
          }
        `;

        const response = await askGemini(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          setAiSafetyInsight(result);
        }
      } catch (error) {
        console.error("❌ [AI 안심 인사이트] 생성 오류:", error);
      } finally {
        setIsAnalyzingSafety(false);
      }
    };

    const timer = setTimeout(generateSafetyInsight, 1000); // 출퇴근 분석보다 조금 뒤에 실행하여 부하 분산
    return () => clearTimeout(timer);
  }, [currentRegionName, mapCenterCoord, analysisRadius, isAiAnalysisMode, reviews]);

  // [신규] AI 배리어 프리(무장애) 리포트 생성 엔진
  useEffect(() => {
    if (!currentRegionName || !mapCenterCoord || reviews.length === 0) return;

    const generateBarrierFreeInsight = async () => {
      setIsAnalyzingBarrierFree(true);
      try {
        // 1. 분석 모드에 따른 리뷰 필터링
        const dongName = currentRegionName.split(' ').pop() || '';
        const baseReviews = isAiAnalysisMode
          ? reviews.filter(r => {
              if (!mapCenterCoord || !r.lat || !r.lng) return false;
              const dist = calculateDistance(mapCenterCoord.lat, mapCenterCoord.lng, r.lat, r.lng);
              return dist <= analysisRadius;
            })
          : reviews.filter(r => (r.address || r.location || '').includes(dongName));

        const bfReviews = baseReviews.filter(r => 
          /(턱|경사|엘리베이터|휠체어|유모차|평지|언덕|계단|보행|보도|육교)/.test(r.content)
        ).slice(0, 5);

        const analysisScope = isAiAnalysisMode ? `반경 ${analysisRadius}m` : `'${dongName}' 지역`;

        // 2. 공공데이터(장애인 편의시설 + 철도역사 편의시설) 가져오기
        const { getBarrierFreeFacilities, getRailwayConvenience } = await import('../services/publicDataService');
        
        // 동네 이름에서 역 이름 추측 (교통 데이터와 연동)
        let stationName = dongName.replace('동', '');
        const stationMapping: {[key: string]: string} = {
          '다': '을지로입구', '무교': '을지로입구', '서린': '광화문', '태평로': '시청', '남대문로': '을지로입구', '회현': '회현', '명': '명동'
        };
        if (stationMapping[stationName]) stationName = stationMapping[stationName];

        const [facilityData, railwayData] = await Promise.all([
          getBarrierFreeFacilities(dongName),
          getRailwayConvenience(stationName)
        ]);
        
        let bfStat = "";
        let facilityCount = 0;
        let railwayFeatures = [];

        // 건물 편의시설 데이터 정리
        if (facilityData && facilityData.response && facilityData.response.body) {
          facilityCount = facilityData.response.body.totalCount || 0;
          bfStat += `[건물 시설]: 주변에 약 ${facilityCount}곳의 장애인 인증 편의시설 확인. `;
        }
        
        // 철도 역사 편의시설 데이터 정리
        if (railwayData && railwayData.response && railwayData.response.body && railwayData.response.body.items) {
          bfStat += `[역사 시설]: ${stationName}역 내 엘리베이터/수유실 등 무장애 설비 확인됨. `;
        }

        if (!bfStat) {
          bfStat = "해당 지역의 상세 무장애 인프라 데이터를 수집 중입니다. 일반적인 보행 환경을 바탕으로 분석합니다.";
        }

        const reviewSummary = bfReviews.length > 0 
          ? bfReviews.map(r => `- ${r.content}`).join('\n')
          : `${analysisScope} 내에 이동 편의성 관련 거주자 리뷰가 아직 존재하지 않습니다.`;
        
        const prompt = `
          당신은 배리어 프리(Barrier-free) 도시 설계 전문가입니다. 
          ${analysisScope}의 [무장애 인프라 데이터]와 [거주자 실제 리뷰 ${bfReviews.length}건]를 기반으로 '이동 편의성 지수(0~100)'와 '요약 인사이트'를 작성해주세요.
          휠체어, 유모차, 고령층의 시점에서 분석하십시오.
          
          [무장애 인프라 데이터]:
          ${bfStat}
          
          [거주자 실제 리뷰]:
          ${reviewSummary}
          
          분석 지침:
          1. 건물 내 편의시설과 지하철역 역사 내 설비(엘리베이터 등) 데이터를 종합하여 이동 편의성을 평가하십시오.
          2. 데이터가 부족하더라도 ${analysisScope}의 일반적인 지형 특성을 고려하여 전문가로서 추론하십시오.
          3. 분석 리포트(text)는 반드시 '한 문장'으로, 군더더기 없이 심플하게 작성하십시오.
          4. 분석 리포트 서두에 "${analysisScope} 편의시설 데이터와 방문록 ${bfReviews.length}건을 분석한 결과," 와 같은 문구를 넣어 신뢰도를 높이십시오.
          
          응답 형식(JSON):
          {
            "score": 숫자(0~100),
            "text": "이동 약자의 관점에서 본 전문 분석 리포트",
            "source": "${stationName}역 무장애 설비, 주변 편의시설(${facilityCount}곳) 및 ${bfReviews.length}건의 실제 리뷰"
          }
        `;

        const response = await askGemini(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          setAiBarrierFreeInsight(result);
        }
      } catch (error) {
        console.error("❌ [AI 배리어 프리 인사이트] 생성 오류:", error);
      } finally {
        setIsAnalyzingBarrierFree(false);
      }
    };

    const timer = setTimeout(generateBarrierFreeInsight, 1200);
    return () => clearTimeout(timer);
  }, [currentRegionName, mapCenterCoord, analysisRadius, isAiAnalysisMode, reviews]);

  const calculateAverageRating = useCallback((reviewList: Review[]) => {
    if (!reviewList || reviewList.length === 0) return "0.0";
    const totalAvg = reviewList.reduce((acc, rev) => {
      const revAvg = ((rev.ratings?.light || 0) + (rev.ratings?.noise || 0) + (rev.ratings?.water || 0)) / 3;
      return acc + revAvg;
    }, 0);
    return (totalAvg / reviewList.length).toFixed(2);
  }, []);

  const handleMarkerClick = async (m: any, loc: any) => {
    const latLng = m.getPosition();
    mapInstance.current.panTo(latLng, { duration: 300, easing: "linear" });

    infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
    infoWindowInstance.current.setContent(renderInfoWindow(<MarkerLoadingWindow />));
    infoWindowInstance.current.open(mapInstance.current, latLng); adjustInfoWindowWrapper();

    const address = normalizeBaseAddress(loc.address);

    if (buildingCacheRef.current[address] !== undefined) {
      const cache = buildingCacheRef.current[address];
      const isRes = cache.isResidential;
      const purpose = cache.purpose;
      const isBookmarked = favoritedAddressesRef.current.has(address);

      // [핵심 수정] loc.count 대신 실시간 reviews 상태에서 직접 집계 (찜 마커는 count:1 하드코딩 문제 해소)
      const hasWritten = isLoggedIn && !!user?.id && reviews.some(r =>
        (r.authorId === user.id) && normalizeBaseAddress(r.address || (r as any).location) === address
      );
      const targetReviewsCache = reviews.filter(r => normalizeBaseAddress(r.address || (r as any).location || '') === address);
      const reviewCountCache = targetReviewsCache.length;
      const avgRatingCache = Number(calculateAverageRating(targetReviewsCache));

      infoWindowInstance.current.setContent(renderInfoWindow(
        <MarkerInfoWindow
          address={address}
          lat={loc.lat}
          lng={loc.lng}
          isBookmarked={isBookmarked}
          isResidential={isRes}
          reviewCount={reviewCountCache}
          avgRating={avgRatingCache}
          hasWritten={hasWritten}
          buildingPurpose={purpose}
          onToggleBookmark={window.__toggleBookmark}
          onOpenReadList={window.__openReadList}
          onOpenWriteSheet={(addr, lat, lng) => { setSelectedAddress(addr); setSelectedCoord({ lat, lng }); setSheetOpen(true); }}
          onReportInaccuracy={(addr) => window.__reportInaccuracy(addr)}
        />
      ));
      infoWindowInstance.current.open(mapInstance.current, latLng); adjustInfoWindowWrapper();
      return;
    }

    window.naver.maps.Service.reverseGeocode({ coords: latLng, orders: "roadaddr,addr" }, async (status: any, res: any) => {
      let isRes = checkIsResidential(address);
      let purpose: string | null = null;
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
            if (apiRes !== null) {
              isRes = apiRes.isResidential;
              purpose = apiRes.purpose;
            }
          }
        }
      }
      buildingCacheRef.current[address] = { isResidential: isRes, purpose };
      const isBookmarked = favoritedAddressesRef.current.has(address);

      // [핵심 수정] loc.count 대신 실시간 reviews 상태에서 직접 집계 (모든 경로 통일)
      const hasWritten = isLoggedIn && !!user?.id && reviews.some(r =>
        (r.authorId === user.id) && normalizeBaseAddress(r.address || (r as any).location) === address
      );
      const targetReviewsGeo = reviews.filter(r => normalizeBaseAddress(r.address || (r as any).location || '') === address);
      const reviewCountGeo = targetReviewsGeo.length;
      const avgRatingGeo = Number(calculateAverageRating(targetReviewsGeo));

      infoWindowInstance.current.setContent(renderInfoWindow(
        <MarkerInfoWindow
          address={address}
          lat={loc.lat}
          lng={loc.lng}
          isBookmarked={isBookmarked}
          isResidential={isRes}
          reviewCount={reviewCountGeo}
          avgRating={avgRatingGeo}
          hasWritten={hasWritten}
          buildingPurpose={purpose}
          onToggleBookmark={window.__toggleBookmark}
          onOpenReadList={window.__openReadList}
          onOpenWriteSheet={(addr, lat, lng) => { setSelectedAddress(addr); setSelectedCoord({ lat, lng }); setSheetOpen(true); }}
          onReportInaccuracy={(addr) => window.__reportInaccuracy(addr)}
        />
      ));
      infoWindowInstance.current.open(mapInstance.current, latLng); adjustInfoWindowWrapper();
    });
  };

  const isRefreshingRef = useRef(false);
  const refreshCountRef = useRef(0); // [추가] 레이스 컨디션 방지용 카운터

  // [신규] AI 분석 범위 시각화 (60fps 부드러운 애니메이션)
  useEffect(() => {
    if (!mapInstance.current || !mapCenterCoord || !isAiAnalysisMode) {
      if (analysisCircleRef.current) analysisCircleRef.current.setMap(null);
      return;
    }

    if (!analysisCircleRef.current) {
      analysisCircleRef.current = new window.naver.maps.Circle({
        map: mapInstance.current,
        center: new window.naver.maps.LatLng(mapCenterCoord.lat, mapCenterCoord.lng),
        radius: analysisRadius,
        fillColor: '#00D084',
        fillOpacity: 0.1,
        strokeColor: '#00D084',
        strokeWeight: 2,
        strokeOpacity: 0.3,
        clickable: false
      });
    } else {
      analysisCircleRef.current.setMap(mapInstance.current);
      analysisCircleRef.current.setCenter(new window.naver.maps.LatLng(mapCenterCoord.lat, mapCenterCoord.lng));
      analysisCircleRef.current.setRadius(analysisRadius);
      analysisCircleRef.current.setOptions({
        fillColor: '#00D084',
        strokeColor: '#00D084'
      });
    }

    let animationId: number;
    // [수정] 분석 중이 아니더라도 모드가 켜져 있으면 무한 펄스 (Infinity)
    if (isAiAnalysisMode) {
      let start = Date.now();
      const pulse = () => {
        const now = Date.now();
        const elapsed = now - start;
        // 더 은은하게 (0.02 ~ 0.12 사이 진동)
        const opacity = 0.02 + Math.abs(Math.sin(elapsed / 1200)) * 0.1; 
        
        analysisCircleRef.current?.setOptions({ 
          fillOpacity: opacity,
          strokeOpacity: opacity + 0.1
        });
        animationId = requestAnimationFrame(pulse);
      };
      animationId = requestAnimationFrame(pulse);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [mapCenterCoord, analysisRadius, isAiAnalysisMode, isAnalyzingCommute, isAnalyzingSafety, isAnalyzingBarrierFree]);

  const refreshMarkers = useCallback(async () => {
    if (!mapInstance.current) return;

    // 신규 요청 발생 시 카운터 증가 및 현재 ID 보관
    const currentCallId = ++refreshCountRef.current;

    try {
      // [개선] 이미 onSnapshot으로 관리되는 reviews 상태를 사용합니다.
      const allReviews = reviews;

      const groups: { [key: string]: any[] } = {};
      allReviews.forEach(r => {
        const key = normalizeBaseAddress(r.address || (r as any).location);
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });

      // [핵심 수정] 타 페이지 내비게이션 및 검색 연동을 위한 전역 위치 정보 캐시 업데이트
      allLocationsRef.current = Object.keys(groups).map(addr => {
        const list = groups[addr];
        return {
          address: addr,
          lat: list[0].lat,
          lng: list[0].lng,
          count: list.length,
          rating: Number(calculateAverageRating(list))
        };
      });

      // 1. 데이터 분류 (필터 상태에 따라 마커의 '운명' 결정)
      const bookmarkData: any[] = [];
      const visitLogData: any[] = [];

      if (showFavoritesOnly) {
        // [찜 필터 ON] -> 오직 보라색 별만 생성 (bookmarkData만 채움)
        if (isLoggedIn && user?.id) {
          const bSnap = await getDocs(query(collection(db, "bookmarks"), where("userId", "==", user.id)));

          // [추가 체크] 찜 데이터를 가져온 후에도 여전히 최신 요청인지 확인
          if (currentCallId !== refreshCountRef.current) return;

          const uniqueData = new Map<string, any>();
          const addrToCoords = new Map<string, { lat: number, lng: number }>();

          bSnap.forEach(d => {
            const bData = d.data();
            const stdAddr = normalizeBaseAddress(bData.address);
            if (bData.lat && bData.lng) addrToCoords.set(stdAddr, { lat: bData.lat, lng: bData.lng });
          });

          Object.keys(groups).forEach(addr => {
            if (favoritedAddresses.has(addr)) {
              const list = groups[addr];
              const first = list[0];
              const coords = addrToCoords.get(addr);
              // [핵심 수정] count:1 하드코딩 제거 → 실제 방문록 수/평점 반영
              uniqueData.set(addr, {
                address: addr, lat: coords?.lat || first.lat, lng: coords?.lng || first.lng,
                count: list.length,
                avgRating: Number(calculateAverageRating(list)),
                isBookmarkStyle: true
              });
            }
          });

          bSnap.forEach(d => {
            const bData = d.data();
            const stdAddr = normalizeBaseAddress(bData.address);
            if (!uniqueData.has(stdAddr) && bData.lat && bData.lng) {
              // 아직 방문록이 없는 찜 전용 마커 → count 0, rating 0
              uniqueData.set(stdAddr, {
                address: stdAddr, lat: bData.lat, lng: bData.lng,
                count: 0,
                avgRating: 0,
                isBookmarkStyle: true
              });
            }
          });
          bookmarkData.push(...Array.from(uniqueData.values()));
        }
      } else {
        // [찜 필터 OFF] -> 찜 여부 상관없이 모든 장소를 '파란색 원'으로만 생성 (bookmarkData는 비워둠)
        Object.keys(groups).forEach(addr => {
          const list = groups[addr];
          const first = list[0];
          visitLogData.push({
            address: addr, lat: first.lat, lng: first.lng,
            count: list.length,
            isBookmarkStyle: false
          });
        });
      }

      if (currentCallId !== refreshCountRef.current) return;

      allMarkersRef.current.forEach(m => m.setMap(null));
      allMarkersRef.current = [];
      if (clusterRef.current) { clusterRef.current.setMap(null); clusterRef.current = null; }
      if ((window as any).visitCluster) { (window as any).visitCluster.setMap(null); (window as any).visitCluster = null; }

      // 다시 한번 확인 (성능 및 안정성)
      if (currentCallId !== refreshCountRef.current) return;

      const createMarkers = (data: any[]) => {
        return data.map(loc => {
          const m = new window.naver.maps.Marker({
            position: new window.naver.maps.LatLng(loc.lat, loc.lng),
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
          (m as any).propertyCount = loc.isBookmarkStyle ? 1 : (loc.count || 0);
          (m as any).isBookmark = loc.isBookmarkStyle;

          window.naver.maps.Event.addListener(m, "click", () => {
            handleMarkerClick(m, loc);
          });
          allMarkersRef.current.push(m);
          return m;
        });
      };

      const bookmarkMarkers = createMarkers(bookmarkData);
      const visitMarkers = createMarkers(visitLogData);

      const clusterOptions = (isBookmark: boolean) => ({
        minClusterSize: 2,
        maxZoom: 18,
        map: mapInstance.current,
        disableClickZoom: true,
        gridSize: 180,
        icons: [
          { content: `<div class="cluster ${isBookmark ? 'cluster-bookmark' : 'cluster-s'}"><div></div></div>`, size: new window.naver.maps.Size(52, 52), anchor: new window.naver.maps.Point(26, 26) },
          { content: `<div class="cluster ${isBookmark ? 'cluster-bookmark' : 'cluster-m'}"><div></div></div>`, size: new window.naver.maps.Size(60, 60), anchor: new window.naver.maps.Point(30, 30) },
          { content: `<div class="cluster ${isBookmark ? 'cluster-bookmark' : 'cluster-l'}"><div></div></div>`, size: new window.naver.maps.Size(72, 72), anchor: new window.naver.maps.Point(36, 36) },
        ],
        stylingFunction: (clusterMarker: any, count: number) => {
          const el = clusterMarker.getElement();
          el.onclick = (e: MouseEvent) => {
            e.stopPropagation();
            const currentClusterer = isBookmark ? clusterRef.current : (window as any).visitCluster;
            if (!currentClusterer) return;

            const clusterObj = currentClusterer._clusters.find((c: any) => c._clusterMarker === clusterMarker);
            const center = clusterObj ? clusterObj.getCenter() : clusterMarker.getPosition();
            mapInstance.current.morph(center, mapInstance.current.getZoom() < 17 ? 17 : 19);
          };

          const div = el.querySelector('div');
          if (div) {
            const currentClusterer = isBookmark ? clusterRef.current : (window as any).visitCluster;
            if (!currentClusterer) {
              div.innerText = count;
              return;
            }
            const clusterObj = currentClusterer._clusters.find((c: any) => c._clusterMarker === clusterMarker);
            if (clusterObj) {
              const members = clusterObj.getClusterMember();
              const totalSum = members.reduce((acc: number, m: any) => acc + (m.propertyCount || 0), 0);
              div.innerText = totalSum > 999 ? "999+" : totalSum;

              if (isBookmark) {
                el.classList.add('cluster-bookmark');
              } else {
                el.classList.remove('cluster-s', 'cluster-m', 'cluster-l');
                if (totalSum < 10) el.classList.add('cluster-s');
                else if (totalSum < 100) el.classList.add('cluster-m');
                else el.classList.add('cluster-l');
              }
            } else {
              div.innerText = count;
            }
          }
        }
      });

      // 최종 렌더링 직전 ID 확인
      if (currentCallId !== refreshCountRef.current) return;

      clusterRef.current = new window.MarkerClustering({ ...clusterOptions(true), markers: bookmarkMarkers });

      if (!showFavoritesOnly) {
        (window as any).visitCluster = new window.MarkerClustering({ ...clusterOptions(false), markers: visitMarkers });
      }

      setTimeout(() => {
        if (currentCallId !== refreshCountRef.current) return;
        if (clusterRef.current) clusterRef.current._redraw();
        if ((window as any).visitCluster) (window as any).visitCluster._redraw();
      }, 100);

    } catch (e) {
      console.error("Marker refresh error:", e);
    }
  }, [calculateAverageRating, isLoggedIn, user, showFavoritesOnly, favoritedAddresses, reviews]);

  // [추가] 찜 필터 토글 또는 리뷰 데이터 변경 시 마커 즉시 갱신
  useEffect(() => {
    // 지도가 없거나 로딩 중이면 대기
    if (!mapInstance.current) return;

    console.log("🔄 [Refresh] 마커 업데이트 트리거 (Reason: Data/Auth/Filter changed)");
    refreshMarkers();
  }, [showFavoritesOnly, reviews, isLoggedIn, isLoadingReviews, refreshMarkers]);

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
    setSelectedImages(review.images || []);
    setExperienceType(review.experienceType || "단순 방문");
    setReadListOpen(false);
    setSelectedReview(null);
    setSheetOpen(true);
  }, []);

  const handleEditDetail = useCallback((review: any) => {
    console.log("✏️ [Detail Edit] 상세 보기에서 수정을 시작합니다:", review.id);
    handleEditReview(review);
  }, [handleEditReview]);

  const handleDeleteReview = useCallback(async (id: string) => {
    showConfirm(
      "방문록 삭제",
      async () => {
        try {
          console.log("🗑️ [Delete] 삭제를 확정했습니다:", id);
          const success = await deleteReview(id);
          if (success) {
            setReviews(prev => prev.filter(r => r.id !== id));
            showAlert("삭제 완료", "방문록이 삭제되었습니다.", "🗑️");
            setSelectedReview(null); // 삭제 성공 시 상세 창 닫기
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
    console.log("🗑️ [Detail Delete] 상세 보기에서 삭제를 요청했습니다:", id);
    handleDeleteReview(id);
  }, [handleDeleteReview]);

  const handleAISearch = async (directQuery?: string) => {
    const finalQuery = directQuery || aiQuery;
    if (!finalQuery.trim() || isAiProcessing) return;

    setIsAiProcessing(true);
    setLastAiResponse(null);

    try {
      // 주소별로 리뷰를 그룹화하여 유니크한 건물 데이터 생성
      const addressGroups: Record<string, any> = {};
      reviews.forEach(r => {
        const addr = r.address || (r as any).location;
        if (!addr) return;
        if (!addressGroups[addr]) {
          addressGroups[addr] = {
            address: addr,
            lat: r.lat,
            lng: r.lng,
            tags: new Set(),
            contents: []
          };
        }
        if (r.tags) r.tags.forEach((t: string) => addressGroups[addr].tags.add(t));
        addressGroups[addr].contents.push(r.content.substring(0, 30));
      });

      const reviewSummary = Object.values(addressGroups).map((g: any) => ({
        address: g.address,
        lat: g.lat,
        lng: g.lng,
        tags: Array.from(g.tags),
        content: g.contents.join(" | ")
      }));

      const prompt = `
        당신은 부동산 방문록 서비스 '방문Log'의 다정하고 유능한 AI 에이전트입니다.
        사용자의 질문에 따라 두 가지 모드로 작동하세요:

        1. [추천 모드]: 사용자가 특정 조건의 건물을 찾을 때
           - 제공된 방문록 데이터를 바탕으로 가장 적합한 건물을 추천하세요.
           - 반드시 JSON 형식으로 답변: {"address": "주소", "reason": "추천 이유", "lat": 0, "lng": 0}

        2. [대화 모드]: 사용자가 인사를 하거나 서비스에 대해 물어볼 때, 혹은 데이터와 상관없는 질문을 할 때
           - 친절하고 위트 있는 대화체로 답변하세요.
           - 이 경우 address를 "none"으로 설정하세요.
           - 반드시 JSON 형식으로 답변: {"address": "none", "reason": "답변 내용", "lat": 0, "lng": 0}

        사용자 질문: "${finalQuery}"

        우리 서비스의 방문록 데이터 요약:
        ${JSON.stringify(reviewSummary.slice(0, 40))} 

        작업 가이드:
        - 추천 시에는 "방문록에 따르면~" 처럼 데이터에 기반해 신뢰감을 주세요.
        - 답변은 반드시 유효한 JSON 형식 하나만 출력하세요. (추가 설명 생략)
      `;

      const resultText = await askGemini(prompt);
      if (!resultText) throw new Error("AI로부터 응답을 받지 못했습니다.");

      // JSON 추출 및 파싱 시도
      let recommendation;
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          recommendation = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.warn("JSON 파싱 실패, 텍스트 폴백 사용");
          recommendation = { address: "none", reason: resultText.replace(/[\{\}]/g, '').trim(), lat: 0, lng: 0 };
        }
      } else {
        // JSON 형식이 아예 없는 경우 전체 텍스트를 답변으로 사용
        recommendation = { address: "none", reason: resultText.trim(), lat: 0, lng: 0 };
      }

      setLastAiResponse(recommendation);

    } catch (e) {
      console.error("AI Search Error:", e);
      showAlert("AI 검색 오류", "분석 중 문제가 발생했습니다. 다시 시도해 주세요.", "⚠️");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleGoToMap = (lat: number, lng: number, address: string, reason: string) => {
    setIsAISearchOpen(false);
    setAiQuery("");
    setLastAiResponse(null);

    if (mapInstance.current && lat && lng) {
      const targetPos = new window.naver.maps.LatLng(lat, lng);
      mapInstance.current.morph(targetPos, 18);
      
      // 방문록 상세 정보 팝업(InfoWindow) 즉시 오픈
      if (window.__openInfoWindow) {
        window.__openInfoWindow(address, lat, lng);
      }
    }
  };

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

  // [WebView/Mobile] 하드웨어 뒤로가기 버튼 핸들링 (등록 중 이탈 방지)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isSubmitting) {
        window.history.pushState({ isHome: true }, '', window.location.href);
        return;
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSubmitting]);

  // [추가] 브라우저 종료/새로고침 방지 (등록 중)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSubmitting) {
        e.preventDefault();
        e.returnValue = "현재 방문록을 등록 중입니다. 페이지를 벗어나면 등록이 취소될 수 있습니다.";
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSubmitting]);

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
            setSelectedImages(r.images || []);
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
      setIsLocationActive(false);

      const triggerFocus = async () => {
        const isBookmarked = favoritedAddresses.has(addr);
        const isRes = checkIsResidential(addr);

        let hasWritten = false;
        if (isLoggedIn && user?.id) {
          const q = query(collection(db, "reviews"), where("authorId", "==", user.id), where("address", "==", addr));
          const snap = await getDocs(q);
          hasWritten = !snap.empty;
        }

        // [핵심 수정] 캐시된 Ref 대신 실시간 reviews 상태를 직접 사용하여 정확한 카운트 계산
        const normalizedFull = normalizeBaseAddress(addr);
        const targetReviews = reviews.filter(r => normalizeBaseAddress(r.address || r.location || "") === normalizedFull);
        const reviewCount = targetReviews.length;
        const avgRating = Number(calculateAverageRating(targetReviews));

        // [추가] 찜 목록 등에서 이동 시에도 건축물 용도 정보 확인 시도
        let bPurpose: string | null = null;
        if (buildingCacheRef.current[normalizedFull]) {
          bPurpose = buildingCacheRef.current[normalizedFull].purpose;
        }

        infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
        infoWindowInstance.current.setContent(renderInfoWindow(
          <MarkerInfoWindow
            address={addr}
            lat={Number(lat)}
            lng={Number(lng)}
            isBookmarked={isBookmarked}
            isResidential={isRes}
            reviewCount={reviewCount}
            avgRating={avgRating}
            hasWritten={hasWritten}
            buildingPurpose={bPurpose}
            onToggleBookmark={window.__toggleBookmark}
            onOpenReadList={window.__openReadList}
            onOpenWriteSheet={(addr, lat, lng) => { setSelectedAddress(addr); setSelectedCoord({ lat, lng }); setSheetOpen(true); }}
            onReportInaccuracy={(addr) => window.__reportInaccuracy(addr)}
          />
        ));
        infoWindowInstance.current.open(mapInstance.current, targetPos); adjustInfoWindowWrapper();

        // 파라미터 정리
        const nextParams = new URLSearchParams();
        setSearchParams(nextParams, { replace: true });
      };

      triggerFocus();
    }
  }, [searchParams, mapInstance.current, infoWindowInstance.current, isLoggedIn, user, setSearchParams, reviews, calculateAverageRating]);

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

      setIsSubmitting(false); // 작성 시트 열 때 이전 로딩 상태 초기화
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
            address: normalizedAddr,
            lat,
            lng,
            createdAt: Timestamp.now()
          });
          showAlert("찜 완료!", "이 건물의 새로운 방문록 알림을 보내드릴게요. 🔔", "🏠");

          // [핵심 추가] 찜을 누르는 순간 지도의 찜 필터(하단 별 버튼)를 강제로 활성화합니다.
          setShowFavoritesOnly(true);
        }

        // [추가] 낙관적 업데이트 (서버 응답 전 로컬 상태 즉시 반영)
        setFavoritedAddresses(prev => {
          const next = new Set(prev);
          if (isDelete) next.delete(normalizedAddr);
          else next.add(normalizedAddr);
          return next;
        });

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
              svg.setAttribute("fill", "#8B5CF6");
              svg.setAttribute("stroke", "#8B5CF6");
            }
          }
        }

        // [핵심] 여기서 refreshMarkers()를 직접 호출하지 않습니다.
        // setShowFavoritesOnly와 setFavoritedAddresses가 상태를 변경하면,
        // 이를 감시하는 useEffect가 가장 최신 상태값으로 지도를 정확히 다시 그립니다.
      } catch (e) { console.error(e); }
    };

    window.__openInfoWindow = async (address: string, lat: any, lng: any) => {
      if (!window.naver?.maps || !mapInstance.current) return;
      
      // [중요] 제미나이 응답값이 문자열일 수 있으므로 강제 숫자 변환
      const nLat = Number(lat);
      const nLng = Number(lng);
      if (isNaN(nLat) || isNaN(nLng)) return;

      const p = new window.naver.maps.LatLng(nLat, nLng);
      const normalizedAddr = normalizeBaseAddress(address);
      const isBookmarked = favoritedAddressesRef.current.has(normalizedAddr);
      
      const existingLoc = allLocationsRef.current.find(loc => normalizeBaseAddress(loc.address || loc.location) === normalizedAddr);
      const reviewCount = existingLoc ? (existingLoc.count || 0) : 0;
      const avgRating = existingLoc ? (existingLoc.rating || 0) : 0;
      
      let hasWritten = false;
      if (isLoggedInRef.current && userRef.current?.id) {
        const qCheck = query(
          collection(db, "reviews"),
          where("authorId", "==", userRef.current.id),
          where("address", "==", address)
        );
        const snapCheck = await getDocs(qCheck);
        hasWritten = !snapCheck.empty;
      }

      infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
      infoWindowInstance.current.setContent(renderInfoWindow(
        <MarkerInfoWindow
          address={address}
          lat={nLat}
          lng={nLng}
          isBookmarked={isBookmarked}
          isResidential={true}
          reviewCount={reviewCount}
          avgRating={avgRating}
          hasWritten={hasWritten}
          onToggleBookmark={window.__toggleBookmark}
          onOpenReadList={window.__openReadList}
          onOpenWriteSheet={(addr, lat, lng) => { setSelectedAddress(addr); setSelectedCoord({ lat, lng }); setSheetOpen(true); }}
          onReportInaccuracy={(addr) => window.__reportInaccuracy(addr)}
        />
      ));
      
      // 모달이 닫히는 애니메이션(약 300ms)과 지도가 이동하는 시간을 고려하여 충분한 지연 후 팝업 오픈
      setTimeout(() => {
        if (mapInstance.current) {
          infoWindowInstance.current.open(mapInstance.current, p);
          adjustInfoWindowWrapper();
        }
      }, 400);
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
        padding: { bottom: 176 }, // 하단 바텀시트(176px)를 고려한 중심점 오프셋
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

          setCurrentUserLocation({ lat: userLat, lng: userLng });

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

      // 지도 중심 이동 트래킹 (로드뷰 썸네일 및 디스커버리 바텀시트용)
      window.naver.maps.Event.addListener(mapInstance.current, "idle", () => {
        const center = mapInstance.current.getCenter();
        const lat = center.lat();
        const lng = center.lng();
        setMapCenterCoord({ lat, lng });

        // [추가] 현재 보고 있는 지역의 명칭 가져오기 (역지오코딩)
        if (window.naver?.maps?.Service?.reverseGeocode) {
          window.naver.maps.Service.reverseGeocode({
            coords: center,
            orders: [
              window.naver.maps.Service.OrderType.ADDR,
              window.naver.maps.Service.OrderType.ROAD_ADDR
            ].join(',')
          }, (status: any, response: any) => {
            if (status === window.naver.maps.Service.Status.OK) {
              const item = response.v2.results[0];
              if (item) {
                const region = item.region;
                const dong = region.area3.name; // 읍면동
                const gu = region.area2.name;   // 구
                setCurrentRegionName(`${gu} ${dong}`);
              }
            }
          });
        }
      });

      // 지도 조작 시 내 위치 추적 비활성화 (드래그, 핀치타입 줌, 마우스휠)
      window.naver.maps.Event.addListener(mapInstance.current, "dragstart", () => setIsLocationActive(false));
      window.naver.maps.Event.addListener(mapInstance.current, "pinch", () => setIsLocationActive(false));
      window.naver.maps.Event.addListener(mapInstance.current, "mousewheel", () => setIsLocationActive(false));

      // [추가] 줌 레벨 변경 시 기존에 열린 정보 창(InfoWindow) 자동 닫기
      window.naver.maps.Event.addListener(mapInstance.current, "zoom_changed", () => {
        console.log("🔍 [Map Zoom] Current Zoom Level:", mapInstance.current.getZoom());
        if (infoWindowInstance.current?.getMap()) {
          infoWindowInstance.current.close();
        }
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
        // [최적화] 즉시 팝업 노출 (낙관적 UX)
        infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
        infoWindowInstance.current.setContent(renderInfoWindow(<MarkerLoadingWindow />));
        infoWindowInstance.current.open(mapInstance.current, clickedPos); adjustInfoWindowWrapper();

        if (!window.naver.maps.Service) return;

        window.naver.maps.Service.reverseGeocode({ coords: clickedPos, orders: "roadaddr,addr" }, async (status: any, res: any) => {
          if (status !== window.naver.maps.Service.Status.OK) return;

          let rawAddress = "주소를 찾을 수 없는 지역입니다.";
          const v2Addr = res.v2?.address;
          if (v2Addr) {
            rawAddress = v2Addr.roadAddress || v2Addr.jibunAddress || rawAddress;
          }

          // [핵심 추가] 네이버 상세 결과에서 건물 명칭(POI 명칭) 추출
          let buildingName = "";
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
          let buildingPurpose: string | null = null;
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
              if (apiResult !== null) {
                buildingPurpose = apiResult.purpose;
                // ⚠️ [유도리 개편 핵심] API가 주거용이라 하면 무조건 살린다. 
                if (apiResult.isResidential === true) {
                  isResidential = true;
                }
              }
            }
          }

          // [개선] 이미 해당 주소에 마커가 있는지 체크
          const existingLoc = allLocationsRef.current.find(loc => normalizeBaseAddress(loc.address) === address);

          if (existingLoc) {
            // [개선] 찜하기 상태 확인 로직 (ID 직접 조회)
            const checkBookmark = async () => {
              const stdAddr = normalizeBaseAddress(address);
              const isBookmarked = favoritedAddressesRef.current.has(stdAddr);

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
              infoWindowInstance.current.setContent(renderInfoWindow(
                <MarkerInfoWindow
                  address={address}
                  lat={existingLoc.lat}
                  lng={existingLoc.lng}
                  isBookmarked={isBookmarked}
                  isResidential={isResidential}
                  reviewCount={liveCount}
                  avgRating={liveRating}
                  hasWritten={hasWritten}
                  buildingPurpose={buildingPurpose}
                  onToggleBookmark={window.__toggleBookmark}
                  onOpenReadList={window.__openReadList}
                  onOpenWriteSheet={(addr, lat, lng) => { setSelectedAddress(addr); setSelectedCoord({ lat, lng }); setSheetOpen(true); }}
                  onReportInaccuracy={(addr) => window.__reportInaccuracy(addr)}
                />
              ));
              infoWindowInstance.current.open(mapInstance.current, finalPos); adjustInfoWindowWrapper();
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
              const stdAddr = normalizeBaseAddress(address);
              const isBookmarked = favoritedAddressesRef.current.has(stdAddr);

              infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
              infoWindowInstance.current.setContent(renderInfoWindow(
                <MarkerInfoWindow
                  title="방문록 쓰기"
                  address={address}
                  lat={finalPos.lat()}
                  lng={finalPos.lng()}
                  isBookmarked={isBookmarked}
                  isResidential={isResidential && isKorea}
                  reviewCount={0}
                  avgRating={0}
                  hasWritten={false}
                  buildingPurpose={buildingPurpose}
                  onToggleBookmark={window.__toggleBookmark}
                  onOpenReadList={window.__openReadList}

                  onOpenWriteSheet={(addr, lat, lng) => { setSelectedAddress(addr); setSelectedCoord({ lat, lng }); setSheetOpen(true); }}
                  onReportInaccuracy={(addr) => window.__reportInaccuracy(addr)}
                />,
                true
              ));
              infoWindowInstance.current.open(mapInstance.current, finalPos); adjustInfoWindowWrapper();
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
      s.id = SCRIPT_ID; s.src = "https://openapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=dj5vfj5th7&submodules=geocoder,panorama";
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

    if (isSubmitting) return; // [강력 방지] 이미 제출 중이면 즉시 중단

    setIsSubmitting(true);
    setAiStep('analyzing');
    setAiReason(null);

    try {
      if (!user?.id) { navigate('/mypage'); return; }

      // 0. AI 클렌징 시스템 - 진짜 Gemini AI 분석 가동
      const aiResult = await analyzeReviewWithAI(comment);

      if (!aiResult.isPassed) {
        if (aiResult.type === "REJECT") {
          setAiStep('rejected');
          setAiReason(aiResult.reason || "부적절한 내용이 포함되어 있습니다.");
        } else {
          setAiStep('error');
          setAiReason(aiResult.reason || "AI 시스템 점검 중입니다.");
        }

        // 사용자가 내용을 확인하도록 잠시 대기 후 로딩 상태만 해제 (모달은 유지)
        setIsSubmitting(false);
        return;
      }

      // 분석 통과 시 시각적 피드백을 위해 잠시 유지
      setAiStep('passed');
      await new Promise(resolve => setTimeout(resolve, 1500));
      // 로딩 모달 닫기
      setAiStep('idle');

      // 0. 매물 단위 중복 체크 (사용자 의견에 따라 엄격한 제한 대신 안내 후 허용으로 변경 가능)
      /* 
      const normalizedDetail = normalizeAddressDetail(addressDetail);
      if (!editingReviewId) {
        ... (중략)
      }
      */

      // 0. 미디어 업로드 (압축 -> 병렬 처리 + 개별 진행률 추적)
      const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB 제한
      const fileCount = selectedImages.length;
      const progressMap = new Map<number, number>();

      const uploadPromises = selectedImages.map(async (file, index) => {
        if (typeof file === 'string') {
          progressMap.set(index, 100);
          return file;
        }

        if (file.type.startsWith('video/')) {
          if (file.size > MAX_VIDEO_SIZE) {
            throw new Error("VIDEO_SIZE_LIMIT");
          }

          // [추가] 동영상 압축 시도 (5MB 이상일 경우에만 진행하여 작은 파일은 즉시 업로드)
          let uploadTarget: File | Blob = file;
          if (file.size > 5 * 1024 * 1024) {
            setIsCompressing(true);
            try {
              uploadTarget = await compressVideo(file);
            } catch (err) {
              console.warn("Video compression failed, uploading original:", err);
            } finally {
              setIsCompressing(false);
            }
          }

          return await uploadMediaToStorage(uploadTarget as File, (p) => {
            progressMap.set(index, p);
            const totalP = Array.from(progressMap.values()).reduce((a, b) => a + b, 0) / fileCount;
            setUploadProgress(Math.round(totalP));
          });
        } else {
          const res = await compressAndEncodeImage(file);
          progressMap.set(index, 100);
          const totalP = Array.from(progressMap.values()).reduce((a, b) => a + b, 0) / fileCount;
          setUploadProgress(Math.round(totalP));
          return res;
        }
      });

      const imageUrls = await Promise.all(uploadPromises);

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
        reviewData.author = user?.name || "익명 방문자";
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
        // [개선] 칭호 획득 알림 중복 방지 로직 (earnedTitles 필드 활용)
        if (user?.id) {
          const userRef = doc(db, "users", user.id);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.data() || {};
          const earnedTitles = userData.earnedTitles || [];

          const q = query(collection(db, "reviews"), where("authorId", "==", user.id));
          const snap = await getDocs(q);
          const totalAfter = snap.size;
          const totalBefore = totalAfter - 1;

          const newBadge = checkEligibleForNewTitle(totalBefore, totalAfter);

          // 칭호 조건이 맞고, 아직 획득한 적 없는 칭호일 때만 알림 발송
          if (newBadge && !earnedTitles.includes(newBadge.title)) {
            await addDoc(collection(db, "notifications"), {
              toUserId: user.id,
              type: "system",
              content: `축하합니다! 방문록 ${totalAfter}회 작성을 달성하여 '${newBadge.title}' 칭호를 획득했습니다. ${newBadge.icon}`,
              reviewId: docRef.id,
              createdAt: Timestamp.now(),
              isRead: false
            });

            // 획득한 칭호 목록 업데이트 (중복 방지 핵심)
            await updateDoc(userRef, {
              earnedTitles: [...earnedTitles, newBadge.title]
            });

            showAlert("👑 새로운 칭호 획득!", `방문록 ${totalAfter}회 작성 기념으로 '${newBadge.title}' 칭호를 얻었습니다.`, "🏆");
          }

          // [핵심 추가] 지역 점령(보안관) 칭호 체크
          const userReviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const stats = calculateUserStats(userReviews);
          const allBadges = getMyBadges(stats);
          const regionalBadges = allBadges.filter(b => b.category === 'region');

          for (const rb of regionalBadges) {
            // 아직 획득 목록에 없는 새로운 지역 점령 칭호라면 알림!
            if (!earnedTitles.includes(rb.title)) {
              await addDoc(collection(db, "notifications"), {
                toUserId: user.id,
                type: "system",
                content: `🤠 새로운 지역 점령! '${rb.title}' 칭호를 획득했습니다.`,
                reviewId: docRef.id,
                createdAt: Timestamp.now(),
                isRead: false
              });

              // 유저 칭호 목록 업데이트
              earnedTitles.push(rb.title);
              await updateDoc(userRef, {
                earnedTitles: earnedTitles
              });

              showAlert("🤠 새로운 지역 점령!", `'${rb.title}' 칭호를 획득하여 해당 지역의 보안관이 되셨습니다!`, "🏆");
            }
          }
        }

        // 원래 뱃지 로직
        if (isVerified && user?.id) {
          await addDoc(collection(db, "notifications"), {
            toUserId: user.id,
            type: "system",
            content: `회원님이 남기신 방문록의 방문자 인증이 완료되었습니다. 칭호를 획득했습니다!`,
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
      setIsSubmitting(false);
      setUploadProgress(0);
      refreshMarkers();
    } catch (e: any) {
      console.error("Submit Error:", e);

      // [핵심] 할당량 초과 시에도 로컬에 저장하고 창을 닫음 (사용자 경험 우선)
      if (e.code === 'resource-exhausted' || e.message?.includes('quota')) {
        const pendingReviews = JSON.parse(localStorage.getItem('pending_reviews') || '[]');
        pendingReviews.push({
          ...reviewData,
          id: editingReviewId ? editingReviewId : ('temp_' + Date.now()),
          isEditing: !!editingReviewId,
          isPending: true
        });
        localStorage.setItem('pending_reviews', JSON.stringify(pendingReviews));

        setSheetOpen(false); // 창 닫기
        setComment(""); setSelectedImages([]); setSelectedTags([]);
        setIsSubmitting(false);
        setUploadProgress(0);

        showAlert("등록 요청 완료", "현재 서버 접속자가 많아 동기화가 지연되고 있습니다. 곧 반영될 예정입니다! ✨", "🚀");
        return;
      }

      setIsSubmitting(false);
      if (e.message === "VIDEO_SIZE_LIMIT") {
        showAlert("용량 초과", "동영상은 50MB 이하만 업로드 가능합니다.", "⚠️");
      } else {
        showAlert("오류 발생", "처리 중 문제가 생겼습니다. 다시 시도해 주세요.", "❌");
      }
    }
  };




  // [AI 에이전트 전용] 사용자 컨텍스트 데이터 (칭호, 작성 리뷰 등)
  const userReviews = useMemo(() => {
    try {
      return Array.isArray(reviews) ? reviews.filter(r => r && r.authorId === user?.id) : [];
    } catch (e) {
      console.error("userReviews calculation error:", e);
      return [];
    }
  }, [reviews, user?.id]);

  const userStats = useMemo(() => {
    try {
      return calculateUserStats(userReviews);
    } catch (e) {
      console.error("userStats calculation error:", e);
      return { totalCount: 0, totalPhotos: 0, longReviewCount: 0, firstReviewCount: 0, totalLikes: 0, perfectScoreCount: 0, strictScoreCount: 0, regionCounts: {} };
    }
  }, [userReviews]);

  const userBadges = useMemo(() => {
    try {
      return getMyBadges(userStats);
    } catch (e) {
      console.error("userBadges calculation error:", e);
      return [];
    }
  }, [userStats]);
  
  const [discoverySheetState, setDiscoverySheetState] = useState<'collapsed' | 'full'>('collapsed');
  
  // 모달 오픈 시 하단 탭바 숨김 처리
  useEffect(() => {
    const isModalOpen = 
      isSheetOpen || 
      isReadListOpen || 
      isAISearchOpen || 
      isPostcodeOpen || 
      isInquiryModalOpen || 
      discoverySheetState === 'full';

    if (isModalOpen) {
      document.body.classList.add('no-nav');
    } else {
      document.body.classList.remove('no-nav');
    }
    return () => document.body.classList.remove('no-nav');
  }, [
    isSheetOpen, isReadListOpen, isAISearchOpen, isPostcodeOpen, 
    isInquiryModalOpen, discoverySheetState
  ]);
  
  // 바텀시트 상태에 따른 지도 중심(Padding) 동적 조정
  useEffect(() => {
    if (!mapInstance.current || !window.naver?.maps) return;
    const bottomPadding = discoverySheetState === 'full' ? 0 : 176;
    mapInstance.current.setOptions({
      padding: { bottom: bottomPadding }
    });
  }, [discoverySheetState]);

  const isModalOpen = 
    isSheetOpen || 
    isReadListOpen || 
    isAISearchOpen || 
    isPostcodeOpen || 
    isInquiryModalOpen || 
    discoverySheetState === 'full';

  return (
    <div className="page-home">
      <InquiryModal
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
        initialType={inquiryData.type === 'report' ? '오류 제보' : ''}
        initialContent={inquiryData.address ? `[오판단 제보 주소: ${inquiryData.address}]\n내용: ` : ''}
      />
      <div className="home-search-bar-container">
        <div
          className={`home-search-bar ${isHistoryOpen ? 'focused' : ''} ${searchQuery.length > 0 ? 'has-query' : ''}`}
          style={{ position: 'relative', zIndex: isHistoryOpen ? 2202 : 200 }}
        >
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
          {searchQuery.length === 0 && (
            <div
              className="ai-search-entry"
              onClick={() => setIsAISearchOpen(true)}
            >
              <motion.span
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ✨ AI 검색
              </motion.span>
            </div>
          )}
          {searchQuery.length > 0 && (
            <div className="home-search-actions" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
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
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
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

        {/* [New] 상단 AI 분석 범위 컨트롤 바 (복구 완료) */}
        <AnimatePresence>
          {isAiAnalysisMode && (
            <motion.div 
              className="ai-range-control-bar"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="range-label">AI 분석 범위</div>
              <div className="range-options">
                {[50, 100, 200].map(r => (
                  <button 
                    key={r}
                    className={`range-chip ${analysisRadius === r ? 'active' : ''}`}
                    onClick={() => setAnalysisRadius(r)}
                  >
                    {r}m
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- AI 검색 에이전트 모달 (사람인 스타일) --- */}
        <AISearchModal
          isOpen={isAISearchOpen}
          onClose={() => setIsAISearchOpen(false)}
          aiQuery={aiQuery}
          setAiQuery={setAiQuery}
          isAiProcessing={isAiProcessing}
          lastAiResponse={lastAiResponse}
          onSearch={handleAISearch}
          onGoToMap={handleGoToMap}
          onOpenReadList={(addr) => window.__openReadList(addr)}
          userReviews={userReviews}
          userBadges={userBadges}
        />
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

      {/* 중앙 로드뷰 조준경 & 썸네일 (정밀 앵커 시스템) - 모달 오픈 시 숨김 */}
      {!isModalOpen && (
        <div className="map-center-anchor">
          <AnimatePresence>
            {isRoadviewMode && (
              <motion.div
                className="map-center-guide"
                initial={{ opacity: 0, scale: 0.8, y: 15, x: "-50%" }}
                animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
                exit={{ opacity: 0, scale: 0.8, y: 15, x: "-50%" }}
                transition={{ type: "spring", damping: 20, stiffness: 200 }}
              >
                <div
                  className="center-thumbnail-wrapper"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCoord(mapCenterCoord);

                    window.naver.maps.Service.reverseGeocode({
                      coords: new window.naver.maps.LatLng(mapCenterCoord.lat, mapCenterCoord.lng),
                      orders: "roadaddr,addr"
                    }, (status: any, res: any) => {
                      if (status === window.naver.maps.Service.Status.OK) {
                        const addr = res.v2.address.roadAddress || res.v2.address.jibunAddress;
                        setSelectedAddress(addr);
                      }
                      setIsPanoramaOpen(true);
                    });
                  }}
                >
                  <div className="thumbnail-box" key={`${mapCenterCoord?.lat}-${mapCenterCoord?.lng}`}>
                    <div
                      className="mini-panorama"
                      ref={(el) => {
                        if (el && window.naver?.maps?.Panorama && mapCenterCoord) {
                          new window.naver.maps.Panorama(el, {
                            position: new window.naver.maps.LatLng(mapCenterCoord.lat, mapCenterCoord.lng),
                            size: new window.naver.maps.Size(150, 104), // 애니메이션 중 렌더링 축소를 방지하기 위한 명시적 사이즈
                            aroundControl: false,
                            zoomControl: false,
                            logoControl: false,
                            padding: { top: 0, right: 0, bottom: 0, left: 0 }
                          });
                        }
                      }}
                    />
                    <div className="thumbnail-click-overlay">크게보기</div>
                  </div>
                  <div className="thumbnail-tail" />
                </div>

                {/* 세련된 블루 컬러의 클래식 맵 핀 마커 */}
                <div className="map-pin-marker">
                  <div className="pin-main">
                    <MapPin size={32} fill="#3182F6" color="#fff" strokeWidth={1} />
                  </div>
                  <div className="pin-shadow" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 지도 우측 하단 플로팅 버튼 모음 (그룹화하여 위치 관리) - 모달 오픈 시 숨김 */}
      {!isModalOpen && (
        <div className="home-fab-group" style={{ 
          bottom: discoverySheetState === 'full' ? 'auto' : '192px',
          top: discoverySheetState === 'full' ? '80px' : 'auto'
        }}>
          {/* AI 분석 모드 토글 버튼 (툴팁 포함) */}
          <div className="home-ai-toggle-wrapper">
            <AnimatePresence>
              {showAiTooltip && (
                <motion.div 
                  className="ai-toggle-tooltip"
                  initial={{ opacity: 0, x: 10, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 10, scale: 0.9 }}
                >
                  이 버튼을 누르면 AI 지역 리포트를 범위별로 볼 수 있어요!
                </motion.div>
              )}
            </AnimatePresence>
            <button
              className={`home-ai-toggle-btn ${isAiAnalysisMode ? 'active' : ''}`}
              onClick={() => setIsAiAnalysisMode(!isAiAnalysisMode)}
              title="AI 분석 리포트 모드"
            >
              <Sparkles size={24} strokeWidth={2} />
            </button>
          </div>

          {/* 로드뷰 (스트릿뷰) 탐색 모드 토글 버튼 */}
          <button
            className={`home-panorama-btn ${isRoadviewMode ? 'active' : ''}`}
            onClick={() => {
              setIsRoadviewMode(!isRoadviewMode);
            }}
            title={isRoadviewMode ? "로드뷰 탐색 종료" : "로드뷰 탐색 시작"}
          >
            <MapPin size={24} strokeWidth={2} />
          </button>
    
          {/* 찜한 매물만 골라보기 버튼 */}
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
            <Star size={24} strokeWidth={2} />
          </button>
    
          {/* 내 위치로 이동 버튼 */}
          <button
            className={`home-location-btn ${isLocationActive ? 'active' : ''}`}
            onClick={() => {
              if (!navigator.geolocation || !mapInstance.current) return;
    
              setIsLocating(true);
              setIsLocationActive(true);
    
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
            <Crosshair size={24} strokeWidth={2} />
          </button>
        </div>
      )}

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

                    // [최적화] 즉시 팝업 노출 (낙관적 UX)
                    infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
                    infoWindowInstance.current.setContent(renderInfoWindow(<MarkerLoadingWindow />));
                    infoWindowInstance.current.open(mapInstance.current, p); adjustInfoWindowWrapper();

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
                      const normalizedFull = normalizeBaseAddress(standardAddress);
                      const isBookmarked = favoritedAddressesRef.current.has(normalizedFull);


                      // [핵심 추가] 해당 주소지에 실제 리뷰가 존재하는지 카운트 체크
                      const existingLoc = allLocationsRef.current.find(loc => normalizeBaseAddress(loc.address || loc.location) === normalizedFull);
                      const reviewCount = existingLoc ? (existingLoc.count || 0) : 0;
                      const avgRating = existingLoc ? (existingLoc.rating || 0) : 0;

                      infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
                      infoWindowInstance.current.setContent(renderInfoWindow(
                        <MarkerInfoWindow
                          address={standardAddress}
                          lat={p.lat()}
                          lng={p.lng()}
                          isBookmarked={isBookmarked}
                          isResidential={isRes}
                          reviewCount={reviewCount}
                          avgRating={avgRating}
                          hasWritten={hasWritten}
                          onToggleBookmark={window.__toggleBookmark}
                          onOpenReadList={window.__openReadList}

                          onOpenWriteSheet={(addr, lat, lng) => { setSelectedAddress(addr); setSelectedCoord({ lat, lng }); setSheetOpen(true); }}
                          onReportInaccuracy={(addr) => window.__reportInaccuracy(addr)}
                        />
                      ));
                      infoWindowInstance.current.open(mapInstance.current, p); adjustInfoWindowWrapper();
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
        onClose={() => {
          if (isSubmitting) return; // 등록 중에는 닫기 불가
          setSheetOpen(false); setEditingReviewId(null); setComment(""); setSelectedTags([]); setSelectedImages([]); setIsVerified(false); setVerificationDistance(null); setIsSubmitting(false);
        }}
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
                  onClick={() => !isSubmitting && setExperienceType(type.label)}
                  style={isSubmitting ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                >
                  <span className="icon">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="section-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ImageIcon size={16} color="#3182F6" />
              </div>
              <span>방문 사진 및 동영상</span>
              <span style={{ fontSize: '11px', color: '#3182F6', marginLeft: 'auto', backgroundColor: '#E8F3FF', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>동영상 가능</span>
            </div>
            <div className="photo-section">
              <button
                className="photo-button"
                onClick={() => !isSubmitting && fileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                <Camera size={24} />
                <span>{selectedImages.length}/10</span>
              </button>
              <input type="file" multiple accept="image/*,video/*" ref={fileInputRef} onChange={e => !isSubmitting && setSelectedImages(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden-file-input" disabled={isSubmitting} />
              {selectedImages.map((file, i) => {
                const isUrl = typeof file === 'string';
                const isVideo = isUrl ? (file.toLowerCase().includes('.mp4') || file.toLowerCase().includes('media_')) : file.type.startsWith('video/');
                const src = isUrl ? file : URL.createObjectURL(file);

                return (
                  <div key={i} className="preview-item">
                    {isVideo ? (
                      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
                        <video src={src} muted autoPlay loop playsInline className="preview-video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => setViewerImage(src)} />
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                          <PlayCircle size={20} color="#fff" fill="rgba(0,0,0,0.3)" />
                        </div>
                      </div>
                    ) : (
                      <img src={src} onClick={() => setViewerImage(src)} />
                    )}
                    <button className="preview-remove" onClick={(ev) => { ev.stopPropagation(); !isSubmitting && handleRemoveImage(i); }} disabled={isSubmitting}>✕</button>
                  </div>
                );
              })}
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
              readOnly={isSubmitting}
              value={addressDetail}
              onChange={e => setAddressDetail(e.target.value)}
            />
            <p style={{ fontSize: '11px', color: '#8B95A1', marginTop: '6px', marginLeft: '4px' }}>
              * 단독/다가구는 층수나 위치를 적어주시면 더 도움이 돼요.
            </p>
          </div>

          <div>
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={16} color="#3182F6" />
                <span>솔직한 방문 후기</span>
              </div>
              <div className="ai-notice-badge" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#F2F4F6',
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid #E5E8EB'
              }}>
                <motion.div
                  className="ai-pulse-dot"
                  style={{
                    width: '7px',
                    height: '7px',
                    backgroundColor: '#3182F6',
                    borderRadius: '50%',
                    position: 'relative'
                  }}
                  animate={{
                    opacity: [0.4, 1, 0.4],
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  {/* 프리미엄 글로우 효과 레이어 */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      top: '-4px', left: '-4px', right: '-4px', bottom: '-4px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(49, 130, 246, 0.6) 0%, rgba(49, 130, 246, 0) 70%)',
                      zIndex: -1
                    }}
                    animate={{
                      opacity: [0, 0.8, 0],
                      scale: [0.8, 1.8, 0.8]
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeOut"
                    }}
                  />
                </motion.div>
                <motion.span
                  style={{ fontSize: '11px', color: '#3182F6', fontWeight: 700, letterSpacing: '-0.2px' }}
                  animate={{
                    opacity: [0.6, 1, 0.6],
                    textShadow: [
                      '0 0 0px rgba(49, 130, 246, 0)',
                      '0 0 4px rgba(49, 130, 246, 0.3)',
                      '0 0 0px rgba(49, 130, 246, 0)'
                    ]
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  AI 클린 모니터링 중
                </motion.span>
              </div>
            </div>
            <textarea className="comment-textarea" placeholder="방문록을 작성해주세요.(5자 이상)" value={comment} onChange={e => setComment(e.target.value)} readOnly={isSubmitting} />
            <p style={{ fontSize: '11px', color: '#8B95A1', marginTop: '8px', marginLeft: '4px', lineHeight: '1.5' }}>
              * 비속어, 비하 발언, 허위 정보 포함 시 AI 시스템에 의해 <strong>등록이 거부</strong>될 수 있습니다.
            </p>
          </div>

          <div>
            <div className="section-title">
              <Heart size={16} color="#F04452" fill="#F04452" />
              <span>항목별 만족도</span>
            </div>
            <RatingRow label="채광" value={ratings.light} onChange={v => setRatings(r => ({ ...r, light: v }))} disabled={isSubmitting} />
            <RatingRow label="소음" value={ratings.noise} onChange={v => setRatings(r => ({ ...r, noise: v }))} disabled={isSubmitting} />
            <RatingRow label="수압" value={ratings.water} onChange={v => setRatings(r => ({ ...r, water: v }))} disabled={isSubmitting} />
          </div>

          <div>
            <div className="section-title">
              <Tag size={16} color="#3182F6" />
              <span>태그</span>
            </div>
            {selectedTags.length > 0 && (<div className="selected-tags-container" style={isSubmitting ? { pointerEvents: 'none', opacity: 0.7 } : {}}>{selectedTags.map(t => (<button key={t} onClick={() => handleTagToggle(t)} className="tag-chip active">{t} <span className="delete-icon">✕</span></button>))}</div>)}
            <div className="custom-tag-field-wrapper" style={isSubmitting ? { opacity: 0.6 } : {}}><span className="tag-prefix">#</span><input type="text" placeholder="태그 직접 입력" value={customTag} onChange={e => setCustomTag(e.target.value.replace('#', ''))} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), !isSubmitting && handleAddCustomTag())} className="custom-tag-field-input" readOnly={isSubmitting} /><button className="tag-add-btn" onClick={() => !isSubmitting && handleAddCustomTag()} disabled={isSubmitting}><Plus size={20} /></button></div>
            <div className="recommend-tag-section" style={isSubmitting ? { pointerEvents: 'none', opacity: 0.5 } : {}}><p className="recommend-title">추천 태그</p><div className="tags-wrapper">{tags.filter(t => !selectedTags.includes(t)).map(t => (<button key={t} onClick={() => handleTagToggle(t)} className="tag-chip recommended">{t}</button>))}</div></div>
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
            disabled={comment.length < 5 || isSubmitting}
            style={isSubmitting ? { backgroundColor: '#B0B8C1', cursor: 'not-allowed' } : {}}
          >
            {isSubmitting || aiStep !== 'idle' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <RefreshCw size={18} className="animate-spin" />
                <span style={{ fontSize: '14.5px' }}>{isCompressing ? '영상을 압축하고 있어요...' : `등록 중... ${uploadProgress}%`}</span>
              </div>
            ) : (
              editingReviewId ? "수정 완료하기" : "방문록 등록하기"
            )}
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
                          <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: '8px' }}>
                            {(review.images[0].includes('.mp4?') || review.images[0].includes('.mov?') || review.images[0].includes('.webm?')) ? (
                              <video src={review.images[0]} muted autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <img src={review.images[0]} alt="thumb" />
                            )}
                            {(review.images[0].includes('.mp4?') || review.images[0].includes('.mov?') || review.images[0].includes('.webm?')) && (
                              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                                <PlayCircle size={20} color="#fff" fill="rgba(0,0,0,0.3)" />
                              </div>
                            )}
                          </div>
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
        <div className="app-modal-overlay">
          <div className="app-modal-content">
            <div className="app-status-icon">{modalConfig.icon}</div>
            <h2 className="app-modal-title">{modalConfig.title}</h2>
            {modalConfig.desc && <p className="app-modal-desc">{modalConfig.desc}</p>}
            <div className="app-modal-footer" style={{ display: 'flex', gap: '8px', width: '100%' }}>
              {modalConfig.cancelText && (
                <button
                  className="app-btn-secondary"
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
                className="app-btn-primary"
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
      <AnimatePresence>
        {isPanoramaOpen && selectedCoord && (
          <motion.div
            className="panorama-overlay"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="panorama-header">
              <div className="info">
                <span className="label">실물 확인 중</span>
                <h2 className="addr">{selectedAddress}</h2>
              </div>
              <button className="close-btn" onClick={() => setIsPanoramaOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <div
              className="panorama-container"
              ref={(el) => {
                if (el && window.naver?.maps?.Panorama) {
                  new window.naver.maps.Panorama(el, {
                    position: new window.naver.maps.LatLng(selectedCoord.lat, selectedCoord.lng),
                    pov: {
                      pan: 0,
                      tilt: 0,
                      fov: 100
                    },
                    logoControl: false
                  });
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* [Premium] AI Moderation Modal */}
      <AnimatePresence>
        {aiStep !== 'idle' && (
          <motion.div
            className="ai-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
          >
            <motion.div
              className="ai-modal-content"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{
                width: '100%',
                maxWidth: '340px',
                backgroundColor: '#fff',
                borderRadius: '28px',
                padding: '32px 24px',
                textAlign: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
              }}
            >
              <div className="ai-visual-area" style={{ marginBottom: '24px', position: 'relative' }}>
                {aiStep === 'analyzing' && (
                  <div className="ai-scanning-animation">
                    <div className="ai-core-orb"></div>
                    <div className="ai-ring-one"></div>
                    <div className="ai-ring-two"></div>
                  </div>
                )}
                {aiStep === 'passed' && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ai-status-icon success">
                    <CheckCircle2 size={64} color="#3182F6" strokeWidth={2.5} />
                  </motion.div>
                )}
                {aiStep === 'rejected' && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ai-status-icon reject">
                    <XCircle size={64} color="#F04452" strokeWidth={2.5} />
                  </motion.div>
                )}
                {aiStep === 'error' && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ai-status-icon error">
                    <RefreshCw size={64} color="#8B95A1" strokeWidth={2.5} />
                  </motion.div>
                )}
              </div>

              <h3 style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#191F28',
                marginBottom: '12px',
                lineHeight: 1.4
              }}>
                {aiStep === 'analyzing' && "AI가 내용을\n꼼꼼하게 읽고 있어요"}
                {aiStep === 'passed' && "클린한 리뷰 확인 완료!"}
                {aiStep === 'rejected' && "잠시만요!\n내용을 조금 수정해주세요"}
                {aiStep === 'error' && "AI가 잠시 자리를 비웠어요"}
              </h3>

              <p style={{
                fontSize: '15px',
                color: '#4E5968',
                lineHeight: 1.6,
                marginBottom: '28px',
                whiteSpace: 'pre-wrap'
              }}>
                {aiStep === 'analyzing' && "방문Log는 AI와 함께 건전한\n커뮤니티를 만들어가고 있습니다."}
                {aiStep === 'passed' && "부적절한 내용이 발견되지 않았습니다.\n지금 바로 등록을 완료합니다."}
                {aiStep === 'rejected' && (
                  <>
                    <span style={{ color: '#F04452', fontWeight: 600 }}>{aiReason}</span>
                    {"\n위 사유로 인해 등록이 거절되었습니다.\n내용을 수정 후 다시 시도해주세요."}
                  </>
                )}
                {aiStep === 'error' && (aiReason || "일시적인 오류가 발생했습니다.\n다시 시도해주시겠어요?")}
              </p>

              {(aiStep === 'rejected' || aiStep === 'error') && (
                <button
                  onClick={() => setAiStep('idle')}
                  style={{
                    width: '100%',
                    height: '56px',
                    backgroundColor: '#3182F6',
                    color: '#fff',
                    borderRadius: '16px',
                    border: 'none',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  수정하러 가기
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 신규: 디스커버리 바텀시트 (모달 오픈 시 숨김) */}
      {!isModalOpen && (
        <DiscoveryBottomSheet
          reviews={reviews}
          userLocation={currentUserLocation}
          mapCenter={mapCenterCoord}
          regionName={currentRegionName}
          aiInsight={aiCommuteInsight}
          isAnalyzing={isAnalyzingCommute}
          aiSafetyInsight={aiSafetyInsight}
          isAnalyzingSafety={isAnalyzingSafety}
          aiBarrierFreeInsight={aiBarrierFreeInsight}
          isAnalyzingBarrierFree={isAnalyzingBarrierFree}
          onOpenReview={(review) => {
            setSelectedReview(review);
            addRecentLog(review.id);
          }}
          onOpenReadList={(address) => {
            setSelectedAddress(address);
            setReadListOpen(true);
          }}
        />
      )}
    </div>
  );
}

function RatingRow({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (<div className="rating-row" style={disabled ? { opacity: 0.6, pointerEvents: 'none' } : {}}><span className="rating-label">{label}</span><div className="stars">{[1, 2, 3, 4, 5].map(s => (<button key={s} onClick={() => !disabled && onChange(s)} className={`star-button ${s <= value ? "active" : ""}`} disabled={disabled}><Star size={28} className={s <= value ? "fill-active" : "fill-inactive"} /></button>))}</div></div>);
}
