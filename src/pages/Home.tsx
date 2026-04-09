import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Star, CheckCircle2, Heart, Eye, MapPin, MoreVertical, ArrowLeft, MessageSquare, Plus } from "lucide-react";
import DaumPostcodeEmbed from "react-daum-postcode";
import { IconButton } from "@toss/tds-mobile";
import { BottomSheet } from "../components/common/BottomSheet";
import { db } from '../services/firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, where, doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "../hooks/useAuth";
import { useAccessControl } from "../hooks/useAccessControl";

interface Review {
  id: string;
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

declare global {
  interface Window {
    naver: any;
    __openWriteSheet: (address: string) => void;
    __openReadList: (address: string) => void;
  }
}

export function Home() {
  const { isLoggedIn, user, login } = useAuth();
  const { canRead, incrementReadCount, watchAd, isAdShowing } = useAccessControl();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedCoord, setSelectedCoord] = useState<{ lat: number, lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddressSelected, setIsAddressSelected] = useState(false);
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isPostcodeOpen, setPostcodeOpen] = useState(false);
  const [isReadListOpen, setReadListOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [postcodeKey, setPostcodeKey] = useState(0);
  const [ratings, setRatings] = useState({ light: 3, noise: 3, water: 3 });
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const infoWindowInstance = useRef<any>(null);
  const navigate = useNavigate();

  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [customTag, setCustomTag] = useState("");
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const neighborhoodTags = ["#채광맛집", "#방음주의", "#수압짱", "#집주인천사", "#편의점가깝", "#언덕주의"];
  const tags = ["#바퀴벌레지옥", "#채광맛집", "#집주인천사", "#수압짱", "#방음안됨", "#뷰맛집"];

  useEffect(() => {
    window.__openReadList = async (address: string) => { 
      setSelectedAddress(address); 
      setReadListOpen(true);
      
      // 해당 주소의 리뷰 가져오기
      setIsLoadingReviews(true);
      try {
        const q = query(collection(db, "reviews"), where("address", "==", address));
        const snap = await getDocs(q);
        const list: Review[] = [];
        snap.forEach(doc => {
          const data = doc.data();
          list.push({
            id: doc.id,
            author: data.author,
            date: data.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR').format(data.createdAt.toDate()) : "2026.04.09",
            location: data.address,
            content: data.content,
            image: data.images?.[0] || "https://images.unsplash.com/photo-1600592858560-9fef0f602f40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400&q=80",
            likes: data.likes || 0,
            views: data.views || 0,
            tag: data.tags?.[0] || "#채광맛집",
            tagBg: "#E8F3FF",
            tagColor: "#3182F6",
            ratings: data.ratings || { light: 3, noise: 3, water: 3 }
          });
        });
        setReviews(list);
      } catch (e) {
        console.error("Reviews fetch error:", e);
      } finally {
        setIsLoadingReviews(false);
      }
    };

    const initializeMap = () => {
      if (!window.naver?.maps || !mapElement.current || mapInstance.current) return;

      // 초기 서울 중심 위치
      let initialCenter = new window.naver.maps.LatLng(37.5385, 127.0694);

      mapInstance.current = new window.naver.maps.Map(mapElement.current, {
        center: initialCenter,
        zoom: 14,
        zoomControl: false, scaleControl: false, logoControl: false, mapDataControl: false,
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
            mapInstance.current.autoResize(); // 중심 보정

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
        pixelOffset: new window.naver.maps.Point(0, 0),
      });

      const fetchMarkers = async () => {
        try {
          const snapshot = await getDocs(collection(db, "locations"));
          let data: any[] = [];
          snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
          
          if (data.length === 0) {
            // 초기 데이터가 아예 없는 경우에만 셋팅 (데모용)
            data = [
              { lat: 37.5385, lng: 127.0694, address: "서울특별시 광진구 아차산로30길 19-6 길린빌", rating: 4.5, count: 12 },
              { lat: 37.5402, lng: 127.0685, address: "서울특별시 광진구 동일로18길 10 한영해시안아파트", rating: 3.8, count: 8 },
              { lat: 37.5450, lng: 127.0700, address: "서울특별시 광진구 자양번영로1길 12", rating: 4.2, count: 5 }
            ];
          }

          const markers = data.map(loc => {
            const m: any = new window.naver.maps.Marker({
              position: new window.naver.maps.LatLng(loc.lat, loc.lng),
              map: mapInstance.current,
              icon: {
                content: `<div class="map-marker" style="width:42px;height:42px">${loc.count}</div>`,
                size: new window.naver.maps.Size(42, 42), anchor: new window.naver.maps.Point(21, 21),
              },
            });
            m.propertyCount = loc.count;
            window.naver.maps.Event.addListener(m, "click", () => {
              const curZoom = mapInstance.current.getZoom();
              const pos = m.getPosition();
              // [추가] 지도의 물리적인 현재 크기를 재계산하여 정중앙 오차 방지
              mapInstance.current.autoResize();

              // [수정] 줌 레벨에 따른 단계별 확대 로직 (19 미만은 모달 노출 X)
              if (curZoom < 17) {
                mapInstance.current.morph(pos, 17, { duration: 300, easing: "linear" });
                if (infoWindowInstance.current?.getMap()) infoWindowInstance.current.close();
                return;
              }

              if (curZoom < 19) {
                mapInstance.current.morph(pos, 19, { duration: 300, easing: "linear" });
                if (infoWindowInstance.current?.getMap()) infoWindowInstance.current.close();
                return;
              }

              // 줌 레벨 19 이상일 때만 모달 노출 로직 실행
              mapInstance.current.panTo(pos, { duration: 300, easing: "linear" });

              infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -160) });
              infoWindowInstance.current.setContent(`
                <div class="iw-container marker">
                  <div class="iw-card">
                    <div class="iw-title">이 공간의 방문록</div>
                    <div class="iw-address"><span>📍</span><span>${loc.address}</span></div>
                    <div class="iw-stats">
                      <div class="iw-stat-item"><div class="label">리뷰 평점</div><div class="value-wrap"><span class="star">★</span><span class="value">${loc.rating || 4.5}</span></div></div>
                      <div class="iw-divider"></div>
                      <div class="iw-stat-item"><div class="label">누적 방문록</div><div class="value-wrap"><span class="value value--blue">${loc.count || 1}건</span></div></div>
                    </div>
                    <div class="iw-button-group">
                      <button class="iw-button iw-button--read" onclick="window.__openReadList('${loc.address}')">방문록 보기</button>
                      <button class="iw-button iw-button--write" onclick="window.__openWriteSheet('${loc.address}')">방문록 쓰기</button>
                    </div>
                    <div class="iw-arrow"></div>
                  </div>
                </div>
              `);
              infoWindowInstance.current.open(mapInstance.current, pos);
            });
            return m;
          });

          if ((window as any).MarkerClustering) {
            let clusterer: any = null;
            clusterer = new (window as any).MarkerClustering({
              minClusterSize: 2, maxZoom: 14, map: mapInstance.current, markers: markers,
              icons: [{ content: '<div class="map-marker" style="width:48px;height:48px"></div>', size: new window.naver.maps.Size(48, 48), anchor: new window.naver.maps.Point(24, 24) }],
              stylingFunction: (cm: any, count: number) => {
                let total = 0;
                if (clusterer?._clusters) {
                  const c = clusterer._clusters.find((cl: any) => cl._clusterMarker === cm);
                  if (c) c._clusterMember.forEach((m: any) => total += (m.propertyCount || 1));
                }
                const display = total || count;
                const text = display >= 1000 ? "999+" : display.toString();
                const size = display < 15 ? 48 : 56;
                cm.setIcon({
                  content: `<div class="map-marker" style="width:${size}px;height:${size}px;background:rgba(49,130,246,${display < 15 ? 0.9 : 1.0})">${text}</div>`,
                  size: new window.naver.maps.Size(size, size), anchor: new window.naver.maps.Point(size / 2, size / 2)
                });
              }
            });
            setTimeout(() => { if (clusterer) clusterer._redraw(); }, 100);
          }
        } catch (e) { console.error(e); }
      };

      fetchMarkers();

      window.naver.maps.Event.addListener(mapInstance.current, "click", (e: any) => {
        // [추가] 지도의 물리적인 현재 크기를 재계산하여 정중앙 오차 방지
        mapInstance.current.autoResize();
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

          let address = "주소를 찾을 수 없는 지역입니다.";
          const v2Addr = res.v2?.address;
          if (v2Addr) address = v2Addr.roadAddress || v2Addr.jibunAddress || address;

          // [수정] 정중앙 가로 정렬 + 4px 수직 간격 세팅
          infoWindowInstance.current.setOptions({ pixelOffset: new window.naver.maps.Point(0, -24) });
          infoWindowInstance.current.setContent(`
            <div class="iw-container none-marker">
              <div class="iw-card">
                <div class="iw-title">방문록 쓰기</div>
                <div class="iw-address"><span>📍</span><span>${address}</span></div>
                <div class="iw-button-group">
                  <button class="iw-button iw-button--write" onclick="window.__openWriteSheet('${address}')">방문록 쓰기</button>
                </div>
                <div class="iw-arrow"></div>
              </div>
            </div>
          `);
          infoWindowInstance.current.open(mapInstance.current, clickedPos);
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
  }, []);

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
    if (!selectedAddress || !selectedCoord) { alert("주소 정보가 없습니다."); return; }
    
    // 토스 로그인 체크
    if (!isLoggedIn) {
      if (confirm("방문록을 작성하려면 토스 로그인이 필요합니다. 로그인하시겠습니까?")) {
        await login();
        alert("로그인되었습니다. 다시 등록 버튼을 눌러주세요.");
      }
      return;
    }

    try {
      // 1. 리뷰 상세 저장
      const reviewData = {
        address: selectedAddress, lat: selectedCoord.lat, lng: selectedCoord.lng,
        content: comment, ratings, tags: selectedTags, images: selectedImages,
        createdAt: serverTimestamp(), author: user?.name || "익명 방문자", 
        authorId: user?.id, likes: 0, views: 0
      };
      await addDoc(collection(db, "reviews"), reviewData);

      // 2. locations 집계 데이터 업데이트
      const locId = selectedAddress.replace(/ /g, '_'); // 간단한 ID 생성
      const locRef = doc(db, "locations", locId);
      const locSnap = await getDoc(locRef);

      if (locSnap.exists()) {
        const d = locSnap.data();
        const newCount = (d.count || 0) + 1;
        const newRating = ((d.rating || 0) * (d.count || 0) + (ratings.light + ratings.noise + ratings.water) / 3) / newCount;
        await updateDoc(locRef, {
          count: newCount,
          rating: Number(newRating.toFixed(1)),
          lastUpdatedAt: serverTimestamp()
        });
      } else {
        await setDoc(locRef, {
          address: selectedAddress,
          lat: selectedCoord.lat,
          lng: selectedCoord.lng,
          count: 1,
          rating: Number(((ratings.light + ratings.noise + ratings.water) / 3).toFixed(1)),
          lastUpdatedAt: serverTimestamp()
        });
      }

      alert("방문록이 등록되었습니다!"); 
      setSheetOpen(false); setComment(""); setSelectedTags([]); setSelectedImages([]);
      // 마커 갱신을 위해 새로고침 또는 마커 다시 불러오기 로직 필요 (여기선 얼럿 후 종료로 간소화)
    } catch (e) { 
      console.error(e);
      alert("오류 발생"); 
    }
  };

  return (
    <div className="page-home">
      <div className="home-search-bar">
        {!searchQuery && <span className="home-search-icon"><IconButton src="https://static.toss.im/icons/svg/icon-search-bold-mono.svg" variant="clear" iconSize={20} /></span>}
        <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setIsAddressSelected(false); }} onKeyDown={e => e.key === "Enter" && setPostcodeOpen(true)} placeholder="주소를 입력해 방문록을 찾아보세요" className="home-search-input" />
        {searchQuery.length > 0 && <span className="home-search-submit"><IconButton src="https://static.toss.im/icons/svg/icon-search-bold-mono.svg" variant="fill" iconSize={20} onClick={() => setPostcodeOpen(true)} /></span>}
      </div>

      <div ref={mapElement} className="home-map-container" />

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
            <DaumPostcodeEmbed key={postcodeKey} onComplete={(data: any) => {
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

      <BottomSheet isOpen={isSheetOpen} onClose={() => setSheetOpen(false)} title="방문록 쓰기">
        {/* 기존 디자인 그대로 복구 (불필요한 wrapper 및 h3 제거) */}
        <div className="sheet-content">
          <div>
            <div className="address-header"><span className="address-text">{selectedAddress}</span><div className="badge-verify"><CheckCircle2 size={12} /><span>인증</span></div></div>
            <p className="address-desc">실제 방문한 위치가 맞습니다.</p>
          </div>

          <div>
            <div className="section-title">사진</div>
            <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={e => setSelectedImages(prev => [...prev, ...Array.from(e.target.files || []).map(f => URL.createObjectURL(f))])} className="hidden-file-input" />
            <div className="photo-section">
              <button className="photo-button" onClick={() => fileInputRef.current?.click()}>
                <Camera size={24} />
                <span>{selectedImages.length}/10</span>
              </button>
              {selectedImages.map((u, i) => (
                <div key={i} className="preview-item">
                  <img src={u} onClick={() => setViewerImage(u)} />
                  <button className="preview-remove" onClick={(ev) => { ev.stopPropagation(); handleRemoveImage(i); }}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="section-title">후기</div>
            <textarea className="comment-textarea" placeholder="후기를 남겨주세요." value={comment} onChange={e => setComment(e.target.value)} />
          </div>

          <div>
            <div className="section-title">환경 평가</div>
            <RatingRow label="채광" value={ratings.light} onChange={v => setRatings(r => ({ ...r, light: v }))} />
            <RatingRow label="소음" value={ratings.noise} onChange={v => setRatings(r => ({ ...r, noise: v }))} />
            <RatingRow label="수압" value={ratings.water} onChange={v => setRatings(r => ({ ...r, water: v }))} />
          </div>

          <div>
            <div className="section-title">태그 선택</div>
            {selectedTags.length > 0 && (<div className="selected-tags-container">{selectedTags.map(t => (<button key={t} onClick={() => handleTagToggle(t)} className="tag-chip active">{t} <span className="delete-icon">✕</span></button>))}</div>)}
            <div className="custom-tag-field-wrapper"><span className="tag-prefix">#</span><input type="text" placeholder="태그 직접 입력" value={customTag} onChange={e => setCustomTag(e.target.value.replace('#', ''))} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddCustomTag())} className="custom-tag-field-input" /><button className="tag-add-btn" onClick={handleAddCustomTag}><Plus size={20} /></button></div>
            <div className="recommend-tag-section"><p className="recommend-title">추천 태그</p><div className="tags-wrapper">{tags.filter(t => !selectedTags.includes(t)).map(t => (<button key={t} onClick={() => handleTagToggle(t)} className="tag-chip recommended">{t}</button>))}</div></div>
          </div>
        </div>
        <div className="submit-wrapper"><button className="iw-button" onClick={handleSubmitReview}>방문록 등록하기</button></div>
      </BottomSheet>

      {isReadListOpen && (
        <div className="home-read-overlay">
          <div className="overlay-header">
            <button className="back-btn" onClick={() => setReadListOpen(false)}><ArrowLeft size={24} /></button>
            <div className="info"><h1>이 공간의 방문록</h1><p>{selectedAddress || "나의 위치 근처"}</p></div>
          </div>
          <div className="overlay-list">
            {isLoadingReviews ? (
              <div className="loading-state">방문록을 불러오는 중...</div>
            ) : reviews.length > 0 ? (
              reviews.map(review => (
                <div key={review.id} className="review-card" onClick={async () => {
                  if (!canRead) {
                    if (confirm("더 많은 방문록을 읽으려면 간단한 광고 시청이 필요합니다. 보시겠습니까?")) {
                      await watchAd();
                      setSelectedReview(review);
                      incrementReadCount();
                    }
                  } else {
                    setSelectedReview(review);
                    incrementReadCount();
                  }
                }}>
                  <div className="card-top"><div className="card-tag" style={{ backgroundColor: review.tagBg, color: review.tagColor }}>{review.tag}</div><MoreVertical size={18} color="#ADB5BD" /></div>
                  <div className="card-body"><p className="card-content">{review.content}</p><div className="card-thumb"><img src={review.image} alt="thumb" /></div></div>
                  <div className="card-footer"><div className="stats"><span className="stat-item"><Heart size={14} /> {review.likes}</span><span className="stat-item"><Eye size={14} /> {review.views}</span></div><span className="date">{review.date}</span></div>
                </div>
              ))
            ) : (
              <div className="empty-state">아직 작성된 방문록이 없습니다.</div>
            )}
          </div>
          {selectedReview && (
            <div className="home-detail-overlay">
              <div className="header"><button className="back-btn" onClick={() => setSelectedReview(null)}><ArrowLeft size={24} /></button><span className="title">방문록 상세보기</span></div>
              <div className="body">
                <div className="img-box"><img src={selectedReview.image} alt="detail" /><div className="tag-float" style={{ backgroundColor: selectedReview.tagBg, color: selectedReview.tagColor }}>{selectedReview.tag}</div></div>
                <div className="info-section">
                  <div className="profile-row"><div className="avatar"></div><div className="meta"><div className="name">{selectedReview.author}</div><div className="date">{selectedReview.date}</div></div></div>
                  <div className="location-info"><MapPin size={14} /><span>{selectedReview.location}</span></div>
                  <div className="rating-box">
                    <h4 className="title">건물 환경 평가</h4>
                    <div className="rating-list">
                      <div className="rating-row-small"><span className="label">☀️ 채광</span><div className="stars">{[1, 2, 3, 4, 5].map(v => (<Star key={v} size={14} fill={v <= selectedReview.ratings.light ? "#F5A623" : "none"} color={v <= selectedReview.ratings.light ? "#F5A623" : "#D1D6DB"} />))}</div></div>
                      <div className="rating-row-small"><span className="label">🔇 소음</span><div className="stars">{[1, 2, 3, 4, 5].map(v => (<Star key={v} size={14} fill={v <= selectedReview.ratings.noise ? "#F5A623" : "none"} color={v <= selectedReview.ratings.noise ? "#F5A623" : "#D1D6DB"} />))}</div></div>
                      <div className="rating-row-small"><span className="label">💧 수압</span><div className="stars">{[1, 2, 3, 4, 5].map(v => (<Star key={v} size={14} fill={v <= selectedReview.ratings.water ? "#F5A623" : "none"} color={v <= selectedReview.ratings.water ? "#F5A623" : "#D1D6DB"} />))}</div></div>
                    </div>
                  </div>
                  <div className="content-box">{selectedReview.content}</div>
                </div>
              </div>
              <div className="footer-actions"><button className="action"><Heart size={20} /> 공감하기</button><button className="action"><MessageSquare size={20} /> 댓글 {parseInt(selectedReview.id) * 3}</button></div>
            </div>
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
            <div className="ad-placeholder">🏢 깨끗한 방 찾을 땐? 방문LOG</div>
          </div>
        </div>
      )}
    </div>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (<div className="rating-row"><span className="rating-label">{label}</span><div className="stars">{[1, 2, 3, 4, 5].map(s => (<button key={s} onClick={() => onChange(s)} className={`star-button ${s <= value ? "active" : ""}`}><Star size={28} className={s <= value ? "fill-active" : "fill-inactive"} /></button>))}</div></div>);
}
