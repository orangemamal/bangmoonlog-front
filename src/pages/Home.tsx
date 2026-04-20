import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Camera, Star, CheckCircle2, Heart, Eye, ArrowLeft, Search, X, XCircle, Plus, RefreshCw, MoreHorizontal, Pencil, Trash2, MapPin, Map as MapIcon, Home as HomeIcon, ClipboardCheck, Image as ImageIcon, MessageSquare, Tag } from "lucide-react";
import DaumPostcodeEmbed from "react-daum-postcode";
import { BottomSheet } from "../components/common/BottomSheet";
import { db } from '../services/firebase';
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
  getDoc
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
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
const checkIsResidential = (addr: string) => {
  if (!addr) return false;

  // 1. 거주지 관련 명칭이 포함되어 있으면 우선적으로 허용 (오탐지 방지)
  const residentialKeywords = ["아파트", "빌라", "맨션", "주택", "오피스텔", "빌리지", "원룸", "고시원", "고시텔", "멘션", "빌"];
  if (residentialKeywords.some(keyword => addr.includes(keyword))) return true;

  // 2. 비거주지 강력 블랙리스트 (포함만 되어도 차단)
  const strongBlacklist = ["지하철", "지하상가", "지하쇼핑", "가로판매대", "구두수선", "지하차도", "보도육교"];
  if (strongBlacklist.some(keyword => addr.includes(keyword))) return false;

  // 비거주 시설 키워드 블랙리스트
  const blacklist = ["역", "출구", "공원", "광장", "교차로", "쉼터"];

  // 3. 패턴 기반 차단 (주소의 끝부분이나 특정 명칭 패턴 분석)
  // (예: ...을지로입구역 2호선, ...1번 출구, ...역사, ...공원)
  const isBlocked = blacklist.some(keyword => {
    const regex = new RegExp(`${keyword}(\\s|\\d|호선|번|사|전|$)`);
    return regex.test(addr);
  });

  return !isBlocked;
};

declare global {
  interface Window {
    naver: any;
    __openWriteSheet: (address: string, lat?: number, lng?: number) => void;
    __openReadList: (address: string) => void;
    __toggleBookmark: (address: string, lat: number, lng: number) => void;
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

export function Home() {
  console.log("🏠 [Home] Component Rendering");
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoggedIn, user, login } = useAuth();
  const { hasWatchedAd, watchAd, isAdShowing } = useAccessControl();
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

  const calculateAverageRating = useCallback((reviewList: Review[]) => {
    if (!reviewList || reviewList.length === 0) return "0.0";
    const totalAvg = reviewList.reduce((acc, rev) => {
      const revAvg = ((rev.ratings?.light || 0) + (rev.ratings?.noise || 0) + (rev.ratings?.water || 0)) / 3;
      return acc + revAvg;
    }, 0);
    return (totalAvg / reviewList.length).toFixed(2);
  }, []);

  const refreshMarkers = useCallback(async () => {
    if (!mapInstance.current) return;
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

      const data = Object.keys(groups).map(addr => {
        const list = groups[addr];
        const first = list[0];
        return {
          address: addr,
          lat: first.lat,
          lng: first.lng,
          count: list.length,
          avgRating: calculateAverageRating(list),
        };
      });

      allMarkersRef.current.forEach(m => m.setMap(null));
      allMarkersRef.current = [];
      if (clusterRef.current) {
        clusterRef.current.setMap(null);
        clusterRef.current = null;
      }

      const markers = data.map(loc => {
        const pos = new window.naver.maps.LatLng(loc.lat, loc.lng);
        const m = new window.naver.maps.Marker({
          position: pos,
          map: mapInstance.current,
          title: loc.address,
          icon: {
            content: `
              <div class="marker-container">
                <div class="marker-bubble">
                  <span class="count">${loc.count}</span>
                </div>
              </div>
            `,
            anchor: new window.naver.maps.Point(21, 21),
          }
        });
        (m as any).propertyCount = loc.count;
        allMarkersRef.current.push(m);

        window.naver.maps.Event.addListener(m, "click", () => {
          const latLng = m.getPosition();
          const curZoom = mapInstance.current.getZoom();
          mapInstance.current.autoResize();

          if (curZoom < 17) {
            mapInstance.current.morph(latLng, 17, { duration: 300, easing: "linear" });
            if (infoWindowInstance.current?.getMap()) infoWindowInstance.current.close();
            return;
          }

          if (curZoom < 19) {
            mapInstance.current.morph(latLng, 19, { duration: 300, easing: "linear" });
            if (infoWindowInstance.current?.getMap()) infoWindowInstance.current.close();
            return;
          }

          mapInstance.current.panTo(latLng, { duration: 300, easing: "linear" });

          const checkBookmark = async () => {
            let isBookmarked = false;
            if (isLoggedIn && user) {
              const stdAddr = normalizeBaseAddress(loc.address);
              const bookmarkId = `bookmark_${user.id}_${stdAddr.replace(/\s+/g, '_')}`;
              const bRef = doc(db, "bookmarks", bookmarkId);
              const bSnap = await getDoc(bRef);
              isBookmarked = bSnap.exists();
            }

            const isRes = checkIsResidential(loc.address);

            const openInfoWindow = async () => {
              let hasWritten = false;
              if (isLoggedIn && user?.id) {
                const q = query(
                  collection(db, "reviews"),
                  where("authorId", "==", user.id),
                  where("address", "==", loc.address)
                );
                const snap = await getDocs(q);
                hasWritten = !snap.empty;
              }

              const buttonText = hasWritten ? "작성 완료" : "방문록 쓰기";
              const disabledAttr = hasWritten ? "disabled style='background:#E5E8EB; color:#A8AFB5; cursor:not-allowed; border:none;'" : "";

              infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
              infoWindowInstance.current.setContent(`
                <div class="iw-container marker">
                  <div class="iw-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                      <div class="iw-title" style="margin-bottom:0;">이 공간의 방문록</div>
                      ${isRes ? `
                      <button class="iw-bookmark-icon-btn ${isBookmarked ? 'active' : ''}" onclick="window.__toggleBookmark('${loc.address}', ${loc.lat}, ${loc.lng})">
                        <svg width="24" height="24" viewBox="0 0 24 24" 
                          fill="${isBookmarked ? '#FFD43B' : 'none'}" 
                          stroke="${isBookmarked ? '#FFD43B' : '#A8AFB5'}" 
                          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </button>` : ''}
                    </div>
                    <div class="iw-address"><span>📍</span><span>${loc.address}</span></div>
                    <div class="iw-stats">
                      <div class="iw-stat-item"><div class="label">리뷰 평점</div><div class="value-wrap"><span class="star">★</span><span class="value">${Number(loc.avgRating || 0).toFixed(2)}</span></div></div>
                      <div class="iw-divider"></div>
                      <div class="iw-stat-item"><div class="label">총 방문록</div><div class="value-wrap"><span class="value value--blue">${loc.count}건</span></div></div>
                    </div>
                    <div class="iw-button-group">
                      <button class="iw-button iw-button--read" onclick="window.__openReadList('${loc.address}')">방문록 보기</button>
                      ${isRes ? `<button class="iw-button iw-button--write" ${disabledAttr} onclick="window.__openWriteSheet('${loc.address}', ${loc.lat}, ${loc.lng})">${buttonText}</button>` : ''}
                    </div>
                    ${!isRes ? `<div style="margin-top:12px; padding:10px; background:#FFF0F0; border-radius:8px; display:flex; gap:6px; align-items:flex-start;">
                         <span style="font-size:14px;">🏠</span>
                         <p style="margin:0; font-size:11px; color:#F04452; font-weight:600; line-height:1.4;">거주용 건물이 아니므로<br/>방문록 작성이 제한됩니다.</p>
                       </div>` : ''}
                    <div class="iw-arrow"></div>
                  </div>
                </div>
              `);
              infoWindowInstance.current.open(mapInstance.current, latLng);
            };

            openInfoWindow();
          };
          checkBookmark();
        });
        return m;
      });

      clusterRef.current = new window.MarkerClustering({
        minClusterSize: 2,
        maxZoom: 18,
        map: mapInstance.current,
        markers: markers,
        disableClickZoom: false,
        gridSize: 180,
        icons: [
          { content: '<div class="cluster cluster-s"><div></div></div>', size: new window.naver.maps.Size(52, 52), anchor: new window.naver.maps.Point(26, 26) },
          { content: '<div class="cluster cluster-m"><div></div></div>', size: new window.naver.maps.Size(60, 60), anchor: new window.naver.maps.Point(30, 30) },
          { content: '<div class="cluster cluster-l"><div></div></div>', size: new window.naver.maps.Size(72, 72), anchor: new window.naver.maps.Point(36, 36) },
        ],
        stylingFunction: (clusterMarker: any, count: number) => {
          const el = clusterMarker.getElement();
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
  }, [calculateAverageRating, isLoggedIn, user]);

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

      const triggerFocus = async () => {
        // [1] 데이터 로드 (찜 상태 및 거주용 여부)
        let isBookmarked = false;
        if (isLoggedIn && user) {
          const bookmarkId = `bookmark_${user.id}_${addr.replace(/\s+/g, '_')}`;
          const bRef = doc(db, "bookmarks", bookmarkId);
          const bSnap = await getDoc(bRef);
          isBookmarked = bSnap.exists();
        }

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
        infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
        infoWindowInstance.current.setContent(`
          <div class="iw-container marker">
            <div class="iw-card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div class="iw-title" style="margin-bottom:0;">이 공간의 방문록</div>
                ${isRes ? `
                <button class="iw-bookmark-icon-btn ${isBookmarked ? 'active' : ''}" onclick="window.__toggleBookmark('${addr}', ${lat}, ${lng})">
                  <svg width="24" height="24" viewBox="0 0 24 24" 
                    fill="${isBookmarked ? '#FFD43B' : 'none'}" 
                    stroke="${isBookmarked ? '#FFD43B' : '#A8AFB5'}" 
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                  </svg>
                </button>` : ''}
              </div>
              <div class="iw-address"><span>📍</span><span>${addr}</span></div>
              <div class="iw-button-group">
                <button class="iw-button iw-button--read" onclick="window.__openReadList('${addr}')">방문록 보기</button>
                ${isRes ? `<button class="iw-button iw-button--write" ${disabledAttr} onclick="window.__openWriteSheet('${addr}', ${lat}, ${lng})">${buttonText}</button>` : ''}
              </div>
              <div class="iw-arrow"></div>
            </div>
          </div>
        `);
        infoWindowInstance.current.open(mapInstance.current, targetPos);

        // [4] 파라미터 정리 (반복 실행 방지)
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("lat");
        nextParams.delete("lng");
        nextParams.delete("address");
        nextParams.delete("zoom");
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
      if (!isLoggedIn || !user?.id) {
        showConfirm("로그인 필요", () => login(), "찜하기 기능은 로그인 후 이용 가능합니다.", "🔒");
        return;
      }

      try {
        const normalizedAddr = normalizeBaseAddress(address);
        // 고유 ID 생성 (중복 방지 핵심)
        const bookmarkId = `bookmark_${user.id}_${normalizedAddr.replace(/\s+/g, '_')}`;
        const bRef = doc(db, "bookmarks", bookmarkId);
        const bSnap = await getDoc(bRef);

        const isDelete = bSnap.exists();

        if (isDelete) {
          // [중급 클린업] 혹시 만에 하나 다른 ID로 중복된 게 있다면 같이 삭제
          const q = query(collection(db, "bookmarks"), where("userId", "==", user.id), where("address", "==", normalizedAddr));
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.forEach((d: QueryDocumentSnapshot<DocumentData>) => batch.delete(d.ref));
          await batch.commit();

          showAlert("찜 해제", "관심 건물에서 삭제되었습니다.", "💔");
        } else {
          await setDoc(bRef, {
            userId: user.id,
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
            mapInstance.current.setCenter(userPos);
            mapInstance.current.setZoom(17); // 14 -> 17로 더 가깝게 초기화
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
              }
            });

            window.naver.maps.Event.addListener(userMarkerRef.current, "click", () => {
              const curZoom = mapInstance.current.getZoom();
              const latestPos = userMarkerRef.current.getPosition();
              if (curZoom < 17) {
                mapInstance.current.morph(latestPos, 17, { duration: 300, easing: "linear" });
              } else if (curZoom < 19) {
                mapInstance.current.morph(latestPos, 19, { duration: 300, easing: "linear" });
              }
            });
          }

          setIsLocating(false);
          console.log(`📍 [GPS 업데이트] 정확도: ${accuracy.toFixed(1)}m`, userLat, userLng);
        }, (err) => {
          console.warn("GPS 허용 불가 또는 오류:", err);
          setIsLocating(false);
        }, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0 // 캐시된 위치 대신 항상 새로운 위치 요청
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

      window.naver.maps.Event.addListener(mapInstance.current, "click", (e: any) => {
        const curZoom = mapInstance.current.getZoom();

        // e.coord 객체는 네이버 지도 엔진에서 재사용되므로, 비동기 호출을 위해 명시적으로 클론 생성
        const clickedPos = e.coord.clone ? e.coord.clone() : new window.naver.maps.LatLng(e.coord.y, e.coord.x);

        // 줌 레벨에 따른 단계별 확대 로직 (19 미만은 주소 체크 X)
        if (curZoom < 17) {
          mapInstance.current.morph(clickedPos, 17, { duration: 300, easing: "linear" });
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

        if (!window.naver.maps.Service) return;

        window.naver.maps.Service.reverseGeocode({ coords: clickedPos, orders: "roadaddr,addr" }, (status: any, res: any) => {
          if (status !== window.naver.maps.Service.Status.OK) return;

          let rawAddress = "주소를 찾을 수 없는 지역입니다.";
          const v2Addr = res.v2?.address;
          if (v2Addr) rawAddress = v2Addr.roadAddress || v2Addr.jibunAddress || rawAddress;

          const address = normalizeBaseAddress(rawAddress);
          const isKorea = address !== "주소를 찾을 수 없는 지역입니다.";
          const isResidential = checkIsResidential(address);

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

              infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
              infoWindowInstance.current.setContent(`
                <div class="iw-container marker">
                  <div class="iw-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                      <div class="iw-title" style="margin-bottom:0;">이 공간의 방문록</div>
                      ${isResidential ? `
                      <button class="iw-bookmark-icon-btn ${isBookmarked ? 'active' : ''}" onclick="window.__toggleBookmark('${address}', ${existingLoc.lat}, ${existingLoc.lng})">
                        <svg width="24" height="24" viewBox="0 0 24 24" 
                          fill="${isBookmarked ? '#FFD43B' : 'none'}" 
                          stroke="${isBookmarked ? '#FFD43B' : '#A8AFB5'}" 
                          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </button>` : ''}
                    </div>
                    <div class="iw-address"><span>📍</span><span>${address}</span></div>
                    <div class="iw-stats">
                      <div class="iw-stat-item"><div class="label">리뷰 평점</div><div class="value-wrap"><span class="star">★</span><span class="value">${Number(liveRating).toFixed(2)}</span></div></div>
                      <div class="iw-divider"></div>
                      <div class="iw-stat-item"><div class="label">총 방문록</div><div class="value-wrap"><span class="value value--blue">${liveCount}건</span></div></div>
                    </div>
                    ${isResidential ? `<div style="margin-bottom:12px; font-size:11px; color:#3182F6; font-weight:600; display:flex; align-items:center; gap:4px;">
                      <span>🏢</span> 상세 층/호수별 리뷰 정보 포함
                    </div>` : ''}
                    <div class="iw-button-group">
                      <button class="iw-button iw-button--read" onclick="window.__openReadList('${address}')">방문록 보기</button>
                      ${isResidential ? `<button class="iw-button iw-button--write" onclick="window.__openWriteSheet('${address}', ${existingLoc.lat}, ${existingLoc.lng})">방문록 쓰기</button>` : ''}
                    </div>
                    ${!isResidential ? `<div style="margin-top:12px; padding:10px; background:#FFF0F0; border-radius:8px; display:flex; gap:6px; align-items:flex-start;">
                         <span style="font-size:14px;">🏠</span>
                         <p style="margin:0; font-size:11px; color:#F04452; font-weight:600; line-height:1.4;">거주용 건물이 아니므로<br/>방문록 작성이 제한됩니다.</p>
                       </div>` : ''}
                    <div class="iw-arrow"></div>
                  </div>
                </div>
              `);
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
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
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
  }, [editingReviewId, refreshMarkers, verifyLocation, isLoggedIn, user, showAlert, showConfirm, login]);

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
          await login();
          showAlert("로그인 완료", "이제 방문록을 작성할 수 있어요.", "🔓");
        },
        "방문록을 작성하려면 로그인하세요.",
        "🔓"
      );
      return;
    }

    try {
      if (!user?.id) { login(); return; }

      // 0. 매물 단위 중복 체크 (사용자 의견에 따라 엄격한 제한 대신 안내 후 허용으로 변경 가능)
      /* 
      const normalizedDetail = normalizeAddressDetail(addressDetail);
      if (!editingReviewId) {
        ... (중략)
      }
      */

      // 0. 이미지 압축 및 Base64 변환 (Firestore 저장 방식)
      const imageUrls: string[] = [];
      for (const file of selectedImages) {
        const dataUrl = await compressAndEncodeImage(file);
        imageUrls.push(dataUrl);
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

        // 칭호 체크 로직
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
            <div className="home-search-actions" style={{ display: "flex", alignItems: "center", gap: "8px", paddingRight: "4px" }}>
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

      {/* 내 위치로 이동 버튼 */}
      <button
        className="home-location-btn"
        onClick={() => {
          if (!navigator.geolocation || !mapInstance.current) return;

          setIsLocating(true);

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
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3182F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
        </svg>
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
                  mapInstance.current.setZoom(19); mapInstance.current.panTo(p);

                  // [추가] 검색 결과에서도 중복 체크 수행
                  let hasWritten = false;
                  if (isLoggedIn && user?.id) {
                    const qCheck = query(
                      collection(db, "reviews"),
                      where("authorId", "==", user.id),
                      where("address", "==", full),
                      where("addressDetail", "==", normalizeAddressDetail(addressDetail))
                    );
                    const snapCheck = await getDocs(qCheck);
                    hasWritten = !snapCheck.empty;
                  }

                  // 검색 결과에서도 찜 상태 확인
                  const checkBookmarkSearch = async () => {
                    let isBookmarked = false;
                    if (isLoggedIn && user?.id) {
                      const bq = query(collection(db, "bookmarks"), where("userId", "==", user.id), where("address", "==", full));
                      const bsnap = await getDocs(bq);
                      isBookmarked = !bsnap.empty;
                    }

                    const isRes = checkIsResidential(full);

                    // [핵심 추가] 해당 주소지에 실제 리뷰가 존재하는지 카운트 체크
                    const qReviews = query(collection(db, "reviews"), where("address", "==", full));
                    const snapReviews = await getDocs(qReviews);
                    const reviewCount = snapReviews.size;

                    const buttonText = hasWritten ? "작성 완료" : "방문록 쓰기";
                    const disabledAttr = hasWritten ? "disabled style='background:#E5E8EB; color:#A8AFB5; cursor:not-allowed; border:none;'" : "";

                    infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
                    infoWindowInstance.current.setContent(`
                      <div class="iw-container marker">
                        <div class="iw-card">
                          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div class="iw-title" style="margin-bottom:0;">이 공간의 방문록</div>
                            ${isRes ? `
                            <button class="iw-bookmark-icon-btn ${isBookmarked ? 'active' : ''}" onclick="window.__toggleBookmark('${full}', ${p.lat()}, ${p.lng()})">
                              <svg width="24" height="24" viewBox="0 0 24 24" 
                                fill="${isBookmarked ? '#FFD43B' : 'none'}" 
                                stroke="${isBookmarked ? '#FFD43B' : '#A8AFB5'}" 
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                              </svg>
                            </button>` : ''}
                          </div>
                          <div class="iw-address"><span>📍</span><span>${full}</span></div>
                          
                          ${reviewCount > 0 ? `
                            <div class="iw-stats" style="margin-bottom:12px; padding:8px; background:#F9FAFB; border-radius:8px; font-size:12px; display:flex; gap:12px; justify-content:center;">
                              <div style="color:#4E5968;">등록된 방문록 <strong style="color:#3182F6;">${reviewCount}건</strong></div>
                            </div>
                          ` : `
                            <div style="text-align:center; padding:12px; background:#F2F4F6; border-radius:12px; margin-bottom:16px; font-size:13px; color:#8B95A1;">
                              아직 작성된 방문록이 없어요. 👟
                            </div>
                          `}

                          <div class="iw-button-group">
                            ${reviewCount > 0 ? `<button class="iw-button iw-button--read" onclick="window.__openReadList('${full}')">방문록 보기</button>` : ''}
                            ${isRes ? `<button class="iw-button iw-button--write" ${disabledAttr} style="${reviewCount === 0 ? 'width:100%;' : ''}" onclick="window.__openWriteSheet('${full}', ${p.lat()}, ${p.lng()})">${buttonText}</button>` : ''}
                          </div>
                          <div class="iw-arrow"></div>
                        </div>
                      </div>
                    `);

                    infoWindowInstance.current.open(mapInstance.current, p);
                  };

                  checkBookmarkSearch();
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
              <span>방문 사진</span>
            </div>
            <div className="photo-section">
              <button className="photo-button" onClick={() => fileInputRef.current?.click()}>
                <Camera size={24} />
                <span>{selectedImages.length}/10</span>
              </button>
              <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={e => setSelectedImages(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden-file-input" />
              {selectedImages.map((file, i) => (
                <div key={i} className="preview-item">
                  <img src={URL.createObjectURL(file)} onClick={() => setViewerImage(URL.createObjectURL(file))} />
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
            onClick={handleSubmitReview}
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
                  <div key={review.id} className={`review-card ${index > 0 && !hasWatchedAd ? 'blurred' : ''} ${review.isVerified ? 'verified' : ''}`} onClick={async () => {
                    if (index > 0 && !hasWatchedAd) {
                      showConfirm(
                        "광고 시청 후 전체 보기",
                        async () => {
                          await watchAd();
                        },
                        "광고를 시청하고 모든 방문록을 확인하시겠습니까?",
                        "📺"
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
              () => login(),
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
