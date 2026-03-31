import { useState, useEffect, useRef } from "react";
import { Camera } from "lucide-react";
import DaumPostcodeEmbed from "react-daum-postcode";
import { Badge, Button, IconButton } from "@toss/tds-mobile";
import { BottomSheet } from "../components/BottomSheet";

declare global {
  interface Window {
    naver: any;
    __openWriteSheet: (address: string) => void;
  }
}

export function Home() {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddressSelected, setIsAddressSelected] = useState(false);
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isPostcodeOpen, setPostcodeOpen] = useState(false);
  const [postcodeKey, setPostcodeKey] = useState(0);
  const [ratings, setRatings] = useState({ light: 3, noise: 3, water: 3 });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const infoWindowInstance = useRef<any>(null);

  const tags = ["#바퀴벌레지옥", "#채광맛집", "#집주인천사", "#수압짱", "#방음안됨", "#뷰맛집"];

  const openPostcode = () => {
    setPostcodeKey(k => k + 1);
    setPostcodeOpen(true);
  };

  useEffect(() => {
    window.__openWriteSheet = (address: string) => {
      setSelectedAddress(address);
      setSheetOpen(true);
    };

    const NAVER_MAP_SCRIPT_ID = "naver-map-script";

    const initializeMap = () => {
      if (!window.naver?.maps || !mapElement.current || mapInstance.current) return;

      const center = new window.naver.maps.LatLng(37.5385, 127.0694);

      mapInstance.current = new window.naver.maps.Map(mapElement.current, {
        center,
        zoom: 14,
        mapTypeId: window.naver.maps.MapTypeId.NORMAL,
        zoomControl: false,
        scaleControl: false,
        logoControl: false,
        mapDataControl: false,
      });

      infoWindowInstance.current = new window.naver.maps.InfoWindow({
        content: "",
        backgroundColor: "transparent",
        borderWidth: 0,
        disableAnchor: true,
        // 마커 말풍선 높이(≈40px) + 여유 20px = -60px
        // 네이버 지도에서 음수 y = 위 방향
        pixelOffset: new window.naver.maps.Point(0, -45),
      });

      const locations = [
        { lat: 37.5385, lng: 127.0694, address: "서울시 광진구 자양동 123-4", label: "12건", rating: 4.5, count: 12 },
        { lat: 37.5450, lng: 127.0700, address: "서울시 성동구 화양동 45-2", label: "5건", rating: 3.2, count: 5 },
        { lat: 37.5250, lng: 127.0500, address: "서울시 강남구 삼성동 22-1", label: "28건", rating: 4.8, count: 28 },
        { lat: 37.5500, lng: 127.0850, address: "서울시 광진구 구의동 12-5", label: "3건", rating: 2.1, count: 3 },
      ];

      locations.forEach(loc => {
        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(loc.lat, loc.lng),
          map: mapInstance.current,
          icon: {
            content: `
              <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;transform:translate(-50%,-100%)">
                <div style="background:#3182F6;color:#fff;font-weight:700;font-size:14px;padding:6px 12px;border-radius:999px;box-shadow:0 4px 12px rgba(49,130,246,0.3);font-family:'Toss Product Sans',sans-serif;white-space:nowrap">
                  ${loc.label}
                </div>
                <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #3182F6;margin-top:-1px"></div>
              </div>
            `,
            size: new window.naver.maps.Size(60, 40),
            anchor: new window.naver.maps.Point(0, 0),
          },
        });

        window.naver.maps.Event.addListener(marker, "click", () => {
          infoWindowInstance.current.setContent(`
            <div style="background:#fff;padding:16px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.15);text-align:center;min-width:200px;font-family:'Toss Product Sans',sans-serif;position:relative;margin-bottom:8px">
              <div style="font-size:15px;font-weight:700;color:#333D4B;margin-bottom:4px">${loc.address}</div>
              <div style="font-size:13px;color:#6B7684;margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:4px">
                <span style="color:#F5A623;font-size:14px">★</span>
                <span style="font-weight:700;color:#4E5968">${loc.rating}</span>
                <span>(${loc.count}개의 리뷰)</span>
              </div>
              <button onclick="window.__openWriteSheet('${loc.address}')" style="background:#3182F6;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;width:100%">
                방문록 작성하기
              </button>
              <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid #fff"></div>
            </div>
          `);
          infoWindowInstance.current.open(mapInstance.current, marker);
        });
      });
    };

    let script = document.getElementById(NAVER_MAP_SCRIPT_ID) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = NAVER_MAP_SCRIPT_ID;
      script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=dj5vfj5th7&submodules=geocoder`;
      script.async = true;
      script.onload = initializeMap;
      document.head.appendChild(script);
    } else if (window.naver?.maps) {
      initializeMap();
    } else {
      script.addEventListener("load", initializeMap);
    }

    return () => {
      script?.removeEventListener("load", initializeMap);
    };
  }, []);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleCompletePostcode = (data: any) => {
    let fullAddress = data.address;
    let extraAddress = "";
    if (data.addressType === "R") {
      if (data.bname !== "") extraAddress += data.bname;
      if (data.buildingName !== "") extraAddress += extraAddress !== "" ? `, ${data.buildingName}` : data.buildingName;
      fullAddress += extraAddress !== "" ? ` (${extraAddress})` : "";
    }

    setSearchQuery(fullAddress);
    setIsAddressSelected(true);
    setPostcodeOpen(false);

    if (mapInstance.current && window.naver?.maps?.Service) {
      window.naver.maps.Service.geocode({ query: fullAddress }, (status: any, response: any) => {
        const fallbackLat = 37.5385 + (Math.random() - 0.5) * 0.04;
        const fallbackLng = 127.0694 + (Math.random() - 0.5) * 0.04;
        let lat = fallbackLat, lng = fallbackLng;

        if (status === window.naver.maps.Service.Status.OK && response.v2.addresses.length > 0) {
          lat = parseFloat(response.v2.addresses[0].y);
          lng = parseFloat(response.v2.addresses[0].x);
        }

        const newPos = new window.naver.maps.LatLng(lat, lng);
        mapInstance.current.setCenter(newPos);
        mapInstance.current.setZoom(16, true);

        infoWindowInstance.current.setContent(`
          <div style="background:#fff;padding:16px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.15);text-align:center;min-width:200px;font-family:'Toss Product Sans',sans-serif;position:relative;margin-bottom:8px">
            <div style="font-size:15px;font-weight:700;color:#333D4B;margin-bottom:4px;word-break:keep-all">${fullAddress}</div>
            <div style="font-size:13px;color:#6B7684;margin-bottom:14px">
              <span style="color:#F5A623">★</span> 0.0 (0개의 리뷰)
            </div>
            <button onclick="window.__openWriteSheet('${fullAddress}')" style="background:#3182F6;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;width:100%">
              첫 방문록 작성하기
            </button>
            <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid #fff"></div>
          </div>
        `);

        const searchMarker = new window.naver.maps.Marker({
          position: newPos,
          map: mapInstance.current,
          icon: {
            content: `<div style="width:16px;height:16px;background:#F04452;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:translate(-50%,-50%)"></div>`,
            anchor: new window.naver.maps.Point(0, 0),
          },
        });

        infoWindowInstance.current.open(mapInstance.current, searchMarker);
      });
    } else {
      setSelectedAddress(fullAddress);
      setSheetOpen(true);
    }
  };

  return (
    <div className="page-home">
      {/* 검색바 */}
      <div
        className={`home-search-bar${isAddressSelected ? " home-search-bar--selected" : ""}`}
        onClick={isAddressSelected ? openPostcode : undefined}
      >
        {/* 왼쪽 돋보기: 타이핑 중(미선택 상태)에서만 숨김 */}
        {(searchQuery.length === 0 || isAddressSelected) && (
          <span className="home-search-icon">
            <IconButton
              src="https://static.toss.im/icons/svg/icon-search-bold-mono.svg"
              variant="clear"
              iconSize={20}
              aria-label="검색"
            />
          </span>
        )}

        <input
          type="text"
          value={searchQuery}
          readOnly={isAddressSelected}
          onChange={e => {
            setSearchQuery(e.target.value);
            setIsAddressSelected(false);
          }}
          placeholder="주소를 입력해 방문록을 찾아보세요"
          className={`home-search-input${isAddressSelected ? " home-search-input--readonly" : ""}`}
        />

        {/* 타이핑 중 → 검색 버튼 / 주소 선택 완료 → X 버튼 */}
        {searchQuery.length > 0 && (
          isAddressSelected ? (
            <IconButton
              src="https://static.toss.im/icons/svg/icon-close-bold-mono.svg"
              variant="clear"
              iconSize={16}
              aria-label="검색 초기화"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setSearchQuery("");
                setIsAddressSelected(false);
              }}
            />
          ) : (
            <IconButton
              src="https://static.toss.im/icons/svg/icon-search-bold-mono.svg"
              variant="fill"
              iconSize={20}
              aria-label="검색하기"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                openPostcode();
              }}
            />
          )
        )}
      </div>

      {/* 네이버 지도 */}
      <div ref={mapElement} className="home-map-container" />

      {/* ────────────────────────────────────────────────────
          주소 검색: BottomSheet 대신 독립 fixed 오버레이로 분리
          → motion transform 스택 컨텍스트 문제 완전 회피
          → iframe input focus 정상 동작
      ──────────────────────────────────────────────────── */}
      {isPostcodeOpen && (
        <div className="postcode-overlay">
          <div className="postcode-backdrop" onClick={() => setPostcodeOpen(false)} />
          <div className="postcode-sheet">
            <div className="postcode-header">
              <h2 className="postcode-title">주소 검색</h2>
              <button className="postcode-close" onClick={() => setPostcodeOpen(false)}>✕</button>
            </div>
            <div className="postcode-body">
              <DaumPostcodeEmbed
                key={postcodeKey}
                onComplete={handleCompletePostcode}
                autoClose={false}
                defaultQuery={searchQuery}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 방문록 작성 바텀시트 */}
      <BottomSheet isOpen={isSheetOpen} onClose={() => setSheetOpen(false)} title="방문록 작성하기">
        <div className="sheet-content">
          <div>
            <div className="address-header">
              <span className="address-text">{selectedAddress}</span>
              <Badge type="primary">방문자 인증</Badge>
            </div>
            <p className="address-desc">실제 방문한 위치가 맞습니다.</p>
          </div>

          <div>
            <h3 className="section-title">사진 첨부</h3>
            <button className="photo-button">
              <Camera size={24} />
              <span>0/5</span>
            </button>
          </div>

          <div>
            <h3 className="section-title">어떤 점이 좋았나요?</h3>
            <RatingRow label="채광" value={ratings.light} onChange={v => setRatings(r => ({ ...r, light: v }))} />
            <RatingRow label="소음" value={ratings.noise} onChange={v => setRatings(r => ({ ...r, noise: v }))} />
            <RatingRow label="수압" value={ratings.water} onChange={v => setRatings(r => ({ ...r, water: v }))} />
          </div>

          <div>
            <h3 className="section-title">태그 선택</h3>
            <div className="tags-wrapper">
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`tag-button ${selectedTags.includes(tag) ? "selected" : "unselected"}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="submit-wrapper">
          <Button
            size="large"
            type="primary"
            onClick={() => {
              alert("방문록이 등록되었습니다!");
              setSheetOpen(false);
            }}
          >
            방문록 등록하기
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rating-row">
      <span className="rating-label">{label}</span>
      <div className="stars">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => onChange(star)} className={`star-button ${star <= value ? "active" : ""}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
