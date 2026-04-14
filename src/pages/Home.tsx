import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Star, CheckCircle2, Heart, Eye, ArrowLeft, Search, Plus, RefreshCw, MoreHorizontal, Pencil, Trash2, MapPin, Map as MapIcon, User, Home as HomeIcon, ClipboardCheck, Image as ImageIcon, MessageSquare, Tag } from "lucide-react";
import DaumPostcodeEmbed from "react-daum-postcode";
import { BottomSheet } from "../components/common/BottomSheet";
import { db } from '../services/firebase';
import {
  collection,
  getDocs,
  addDoc,
  query,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  onSnapshot,
  where,
  DocumentData,
  QuerySnapshot,
  QueryDocumentSnapshot
} from "firebase/firestore";
import { useSearchParams } from "react-router-dom";
import { checkEligibleForNewTitle } from "../utils/titleSystem";
import { useAuth } from "../hooks/useAuth";
import { useRecentLogs } from "../hooks/useRecentLogs";
import { useAccessControl } from "../hooks/useAccessControl";
import { ReviewDetail } from "../components/ReviewDetail";
import { deleteReview } from "../services/reviewService";
import { WelcomeModal } from "../components/home/WelcomeModal";

interface Review {
  id: string;
  author: string;
  authorId?: string;
  lat?: number;
  lng?: number;
  date: string;
  location: string;
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
}


// [유틸리티] 두 좌표 사이의 거리 계산 (Haversine 공식, m 단위)
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000; // 지구 반지름 (m)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// [유틸리티] 주소 정규화 (중복 방지용 키 생성)
const normalizeAddress = (addr: string) => {
  if (!addr) return "";
  // 1. 공백 제거 및 소문자화 (네이버 주소는 보통 대항문자이므로 큰 의미는 없지만 기본 처리)
  // 2. 괄호 안의 상세 주소(예: (서린동)) 제거 - 주소지 단일화를 위함
  return addr.replace(/\(.*\)/g, "").replace(/\s+/g, " ").trim();
};

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
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const infoWindowInstance = useRef<any>(null);
  const allLocationsRef = useRef<any[]>([]);
  const unsubscribeReadListRef = useRef<(() => void) | null>(null);
  const clusterRef = useRef<any>(null);
  const allMarkersRef = useRef<any[]>([]);

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
        searchParams.delete("edit");
        setSearchParams(searchParams, { replace: true });
      };
      loadToEdit();
    }
  }, [searchParams, setSearchParams]);

  // [핸들러] 리뷰 상세 보기 관련 핸들러 안정화 (무한 루프 해결)
  const handleCloseDetail = useCallback(() => setSelectedReview(null), []);

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
        const key = normalizeAddress(r.address || r.location);
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

          // 줌 레벨에 따른 단계별 확대 로직 (19 미만은 모달 노출 X)
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

          // 줌 레벨 19 이상일 때만 모달 노출 로직 실행
          // 줌 레벨 19 이상일 때만 모달 노출 로직 실행
          mapInstance.current.panTo(latLng, { duration: 300, easing: "linear" });

          // [개선] 찜하기 상태 확인 로직 추가
          const checkBookmark = async () => {
            let isBookmarked = false;
            if (isLoggedIn && user) {
              const bq = query(collection(db, "bookmarks"), where("userId", "==", user.id), where("address", "==", loc.address));
              const bsnap = await getDocs(bq);
              isBookmarked = !bsnap.empty;
            }

            const isRes = checkIsResidential(loc.address);
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
                     ${isRes ? `<button class="iw-button iw-button--write" onclick="window.__openWriteSheet('${loc.address}', ${loc.lat}, ${loc.lng})">방문록 쓰기</button>` : ''}
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
  }, [calculateAverageRating]);

  const handleEditReview = useCallback((review: any) => {
    setEditingReviewId(review.id);
    setSelectedAddress(review.location);
    setSelectedCoord({ lat: review.lat || 37.5, lng: review.lng || 127.0 });
    setComment(review.content);
    setSelectedTags(review.tags || []);
    setExperienceType(review.experienceType || "단순 방문");
    setReadListOpen(false);
    setSelectedReview(null); // 수정 진입 시 상세 보기 팝업 닫기 (이중 모달 방지)
    setSheetOpen(true);
  }, []);

  const handleEditDetail = useCallback((review: Review) => {
    handleEditReview(review);
  }, [handleEditReview]);

  // [삭제] 핸들러
  const handleDeleteReview = useCallback(async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    showConfirm(
      "방문록 삭제",
      async () => {
        try {
          const success = await deleteReview(id);
          if (success) {
            setReviews(prev => prev.filter(r => r.id !== id));
            showAlert("삭제 완료", "방문록이 삭제되었습니다.", "🗑️");
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
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
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
  }, [refreshMarkers]);

  const handleDeleteDetail = useCallback((id: string) => {
    handleDeleteReview(id);
  }, [handleDeleteReview]);

  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [customTag, setCustomTag] = useState("");
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  // [인증] 방문자 인증 관련 상태
  const [isVerified, setIsVerified] = useState(false);
  const [verificationDistance, setVerificationDistance] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // [방문 유형]
  const [experienceType, setExperienceType] = useState("단순 방문");

  // 시트 진입 시 위치 검증 함수
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

  const showAlert = (title: string, desc?: string, icon: string = "✅", onConfirm?: () => void) => {
    setModalConfig({ isOpen: true, title, desc, icon, onConfirm, confirmText: "확인" });
  };

  const showConfirm = (title: string, onConfirm: () => void, desc?: string, icon: string = "❓", onCancel?: () => void) => {
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
  };

  const neighborhoodTags = ["#채광맛집", "#방음주의", "#수압짱", "#집주인천사", "#편의점가깝", "#언덕주의"];
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
      const normalizedTarget = normalizeAddress(address);

      unsubscribeReadListRef.current = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
        const list: Review[] = [];
        const totalDBCount = snap.size;

        snap.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
          const data = doc.data();
          const docAddr = normalizeAddress(data.address || data.location || "");

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
              experienceType: data.experienceType || "단순 방문"
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
      if (!isLoggedIn) {
        showConfirm("로그인 필요", () => login(), "찜하기 기능은 로그인 후 이용 가능합니다.", "🔒");
        return;
      }

      try {
        const q = query(collection(db, "bookmarks"), where("userId", "==", user?.id), where("address", "==", address));
        const snap = await getDocs(q);
        const isDelete = !snap.empty;

        if (isDelete) {
          await deleteDoc(doc(db, "bookmarks", snap.docs[0].id));
          showAlert("찜 해제", "관심 건물에서 삭제되었습니다.", "💔");
        } else {
          await addDoc(collection(db, "bookmarks"), {
            userId: user?.id,
            address, lat, lng,
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

      // 2. 사용자의 GPS 위치로 설정 + 파란색 점 마크 추가
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          const userPos = new window.naver.maps.LatLng(userLat, userLng);

          mapInstance.current.setCenter(userPos);
          mapInstance.current.setZoom(14);

          const myMarker = new window.naver.maps.Marker({
            position: userPos,
            map: mapInstance.current,
            icon: {
              content: `<div style="width:16px;height:16px;background:#3182F6;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
              anchor: new window.naver.maps.Point(8, 8), // [참고] 16px이므로 8,8이 정중앙입니다.
            }
          });

          // [추가] 내 위치 마커 클릭 시 단계별 확대 기능
          window.naver.maps.Event.addListener(myMarker, "click", () => {
            const curZoom = mapInstance.current.getZoom();

            if (curZoom < 17) {
              mapInstance.current.morph(userPos, 17, { duration: 300, easing: "linear" });
            } else if (curZoom < 19) {
              mapInstance.current.morph(userPos, 19, { duration: 300, easing: "linear" });
            }
          });
          console.log("📍 [내 위치 초기화 완료]:", userLat, userLng);
        }, (err) => {
          console.warn("GPS 허용 불가, 기본 좌표를 유지합니다.", err);
        }, { enableHighAccuracy: true });
      }

      window.naver.maps.Event.addListener(mapInstance.current, "zoom_changed", () => {
        console.log("현재 네이버 지도 줌 레벨:", mapInstance.current.getZoom());
      });

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

          const address = normalizeAddress(rawAddress);
          const isKorea = address !== "주소를 찾을 수 없는 지역입니다.";
          const isResidential = checkIsResidential(address);

          // [개선] 이미 해당 주소에 마커가 있는지 체크
          const existingLoc = allLocationsRef.current.find(loc => normalizeAddress(loc.address) === address);

          if (existingLoc) {
            // 이미 등록된 장소라면 -> 마커 클릭과 동일한 인포윈도우 노출 (찜하기 버튼 포함)
            const checkBookmark = async () => {
              let isBookmarked = false;
              if (isLoggedIn && user) {
                const bq = query(collection(db, "bookmarks"), where("userId", "==", user.id), where("address", "==", address));
                const bsnap = await getDocs(bq);
                isBookmarked = !bsnap.empty;
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
                const bq = query(collection(db, "bookmarks"), where("userId", "==", user.id), where("address", "==", address));
                const bsnap = await getDocs(bq);
                isBookmarked = !bsnap.empty;
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
  }, [editingReviewId, refreshMarkers, verifyLocation]);

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
      // 0. 이미지 압축 및 Base64 변환 (Firestore 저장 방식)
      const imageUrls: string[] = [];
      for (const file of selectedImages) {
        const dataUrl = await compressAndEncodeImage(file);
        imageUrls.push(dataUrl);
      }

      // 1. 리뷰 데이터 가공
      const reviewData: any = {
        address: selectedAddress,
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
        bsnap.forEach(async (bdoc) => {
          const bm = bdoc.data();
          if (bm.userId !== user?.id) { // 본인 제외
            await addDoc(collection(db, "notifications"), {
              toUserId: bm.userId,
              type: "local",
              content: `찜한 건물 '${selectedAddress.split(' ').slice(-1)}'에 새로운 방문록이 올라왔어요!`,
              reviewId: docRef.id,
              createdAt: Timestamp.now(),
              isRead: false
            });
          }
        });
      }

      setSheetOpen(false); setComment(""); setSelectedTags([]); setSelectedImages([]);
      setEditingReviewId(null); setIsVerified(false); setVerificationDistance(null);
      setExperienceType("단순 방문");
      refreshMarkers();
    } catch (e) {
      console.error(e);
      showAlert("오류 발생", "처리 중 문제가 생겼습니다. 다시 시도해 주세요.", "❌");
    }
  };




  return (
    <div className="page-home">
      <div className="home-search-bar">
        {!searchQuery && <span className="home-search-icon"><Search size={24} color="#8B95A1" /></span>}
        <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setIsAddressSelected(false); }} onKeyDown={e => e.key === "Enter" && setPostcodeOpen(true)} placeholder="어떤 집의 방문Log가 궁금하세요?" className="home-search-input" />
        {searchQuery.length > 0 && <span className="home-search-submit"><button className="icon-search-btn" onClick={() => setPostcodeOpen(true)}><Search size={24} color="#3182F6" /></button></span>}
      </div>

      <div ref={mapElement} className="home-map-container" />

      {/* 내 위치로 이동 버튼 */}
      <button
        className="home-location-btn"
        onClick={() => {
          if (!navigator.geolocation || !mapInstance.current) return;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const userPos = new window.naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
              mapInstance.current.morph(userPos, 17, { duration: 400, easing: 'linear' });
            },
            (err) => console.warn('GPS 오류:', err),
            { enableHighAccuracy: true }
          );
        }}
        title="내 위치로 이동"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="8" strokeDasharray="2 2" strokeOpacity="0.4" />
        </svg>
      </button>

      {isAddressSelected && (
        <div className="neighborhood-tag-wrapper">
          <div className="tag-scroll-container">
            {neighborhoodTags.map(tag => (
              <button key={tag} onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)} className={`tds-chip ${activeTagFilter === tag ? "active" : ""}`}>{tag}</button>
            ))}
          </div>
        </div>
      )}

      {isPostcodeOpen && (
        <div className="postcode-overlay">
          <div className="postcode-backdrop" onClick={() => setPostcodeOpen(false)} />
          <div className="postcode-sheet">
            <div className="postcode-header"><h2>주소 검색</h2><button onClick={() => setPostcodeOpen(false)} className="postcode-close">✕</button></div>
            <DaumPostcodeEmbed onComplete={(data: any) => {
              const full = data.address;
              setSearchQuery(full); setIsAddressSelected(true); setPostcodeOpen(false);
              window.naver.maps.Service.geocode({ query: full }, (s: any, r: any) => {
                if (s === window.naver.maps.Service.Status.OK && r.v2.addresses.length > 0) {
                  const p = new window.naver.maps.LatLng(r.v2.addresses[0].y, r.v2.addresses[0].x);
                  mapInstance.current.setZoom(19); mapInstance.current.panTo(p);
                  infoWindowInstance.current.open(mapInstance.current, p);
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
              <div className="empty-state">아직 작성된 방문록이 없습니다.</div>
            )}
          </div>
          {selectedReview && (
            <ReviewDetail
              reviewId={selectedReview.id}
              onClose={handleCloseDetail}
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
        </div>
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
    </div>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (<div className="rating-row"><span className="rating-label">{label}</span><div className="stars">{[1, 2, 3, 4, 5].map(s => (<button key={s} onClick={() => onChange(s)} className={`star-button ${s <= value ? "active" : ""}`}><Star size={28} className={s <= value ? "fill-active" : "fill-inactive"} /></button>))}</div></div>);
}
