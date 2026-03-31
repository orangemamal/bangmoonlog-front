import { useState, useEffect, useRef } from "react";
import { Search, Camera, Star, CheckCircle2 } from "lucide-react";
import { BottomSheet } from "../components/BottomSheet";
import DaumPostcodeEmbed from "react-daum-postcode";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Global declaration for naver maps
declare global {
  interface Window {
    naver: any;
    __openWriteSheet: (address: string) => void;
  }
}

export function Home() {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isPostcodeOpen, setPostcodeOpen] = useState(false);
  
  // Form State
  const [ratings, setRatings] = useState({ light: 3, noise: 3, water: 3 });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const infoWindowInstance = useRef<any>(null);
  
  const tags = ["#바퀴벌레지옥", "#채광맛집", "#집주인천사", "#수압짱", "#방음안됨", "#뷰맛집"];

  useEffect(() => {
    // Expose React state setter to global window so the InfoWindow HTML string can trigger it
    window.__openWriteSheet = (address: string) => {
      setSelectedAddress(address);
      setSheetOpen(true);
    };

    // Dynamically load Naver Maps API script with Geocoder submodule
    const script = document.createElement("script");
    script.src = "https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=YOUR_NCP_CLIENT_ID&submodules=geocoder";
    script.async = true;
    
    script.onload = () => {
      if (window.naver && window.naver.maps && mapElement.current) {
        // Initialize Map
        const center = new window.naver.maps.LatLng(37.5385, 127.0694); // 자양동 근처
        
        mapInstance.current = new window.naver.maps.Map(mapElement.current, {
          center: center,
          zoom: 14,
          mapTypeId: window.naver.maps.MapTypeId.NORMAL,
          zoomControl: false,
          scaleControl: false,
          logoControl: false,
          mapDataControl: false,
        });

        // Initialize InfoWindow (Tooltip)
        infoWindowInstance.current = new window.naver.maps.InfoWindow({
          content: '',
          backgroundColor: "transparent",
          borderWidth: 0,
          disableAnchor: true,
          pixelOffset: new window.naver.maps.Point(0, -10)
        });

        // Add Mock Markers
        const locations = [
          { lat: 37.5385, lng: 127.0694, address: "서울시 광진구 자양동 123-4", label: "12건", rating: 4.5, count: 12 },
          { lat: 37.5450, lng: 127.0700, address: "서울시 성동구 화양동 45-2", label: "5건", rating: 3.2, count: 5 },
          { lat: 37.5250, lng: 127.0500, address: "서울시 강남구 삼성동 22-1", label: "28건", rating: 4.8, count: 28 },
          { lat: 37.5500, lng: 127.0850, address: "서울시 광진구 구의동 12-5", label: "3건", rating: 2.1, count: 3 }
        ];

        locations.forEach(loc => {
          const markerPosition = new window.naver.maps.LatLng(loc.lat, loc.lng);
          
          const marker = new window.naver.maps.Marker({
            position: markerPosition,
            map: mapInstance.current,
            icon: {
              content: `
                <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
                  <div style="background-color: #3182F6; color: white; font-weight: bold; font-size: 14px; padding: 6px 12px; border-radius: 999px; box-shadow: 0 4px 12px rgba(49,130,246,0.3); z-index: 10; font-family: Pretendard, sans-serif;">
                    ${loc.label}
                  </div>
                  <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #3182F6; margin-top: -2px; z-index: 0;"></div>
                </div>
              `,
              size: new window.naver.maps.Size(60, 40),
              anchor: new window.naver.maps.Point(0, 0),
            }
          });

          // Show Tooltip InfoWindow on marker click
          window.naver.maps.Event.addListener(marker, 'click', () => {
            const contentString = `
              <div style="background: white; padding: 16px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); text-align: center; min-width: 200px; font-family: Pretendard, sans-serif; position: relative; margin-bottom: 8px;">
                <div style="font-size: 15px; font-weight: bold; color: #333D4B; margin-bottom: 4px;">${loc.address}</div>
                <div style="font-size: 13px; color: #6B7684; margin-bottom: 14px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                  <span style="color: #F5A623; font-size: 14px;">★</span>
                  <span style="font-weight: bold; color: #4E5968;">${loc.rating}</span>
                  <span>(${loc.count}개의 리뷰)</span>
                </div>
                <button onclick="window.__openWriteSheet('${loc.address}')" style="background: #3182F6; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; width: 100%; transition: opacity 0.2s;">
                  방문록 작성하기
                </button>
                <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid white;"></div>
              </div>
            `;
            infoWindowInstance.current.setContent(contentString);
            infoWindowInstance.current.open(mapInstance.current, marker);
          });
        });
      }
    };

    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleCompletePostcode = (data: any) => {
    let fullAddress = data.address;
    let extraAddress = '';

    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
      fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
    }

    setSearchQuery(fullAddress);
    setPostcodeOpen(false); // Close the Daum search sheet
    
    // Attempt Geocoding to move Map
    if (mapInstance.current && window.naver) {
      const showTooltipOnMap = (lat: number, lng: number) => {
        const newPos = new window.naver.maps.LatLng(lat, lng);
        
        mapInstance.current.setCenter(newPos);
        mapInstance.current.setZoom(16, true);

        // Add small point marker for the searched location
        const searchMarker = new window.naver.maps.Marker({
          position: newPos,
          map: mapInstance.current,
          icon: {
            content: `
              <div style="width: 16px; height: 16px; background-color: #F04452; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transform: translate(-50%, -50%);"></div>
            `,
            anchor: new window.naver.maps.Point(0, 0)
          }
        });

        // Open Tooltip for new searched location
        const contentString = `
          <div style="background: white; padding: 16px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); text-align: center; min-width: 200px; font-family: Pretendard, sans-serif; position: relative; margin-bottom: 8px;">
            <div style="font-size: 15px; font-weight: bold; color: #333D4B; margin-bottom: 4px; word-break: keep-all;">${fullAddress}</div>
            <div style="font-size: 13px; color: #6B7684; margin-bottom: 14px; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <span style="color: #F5A623; font-size: 14px;">★</span>
              <span style="font-weight: bold; color: #4E5968;">0.0</span>
              <span>(0개의 리뷰)</span>
            </div>
            <button onclick="window.__openWriteSheet('${fullAddress}')" style="background: #3182F6; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; width: 100%; transition: opacity 0.2s;">
              첫 방문록 작성하기
            </button>
            <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid white;"></div>
          </div>
        `;
        infoWindowInstance.current.setContent(contentString);
        infoWindowInstance.current.open(mapInstance.current, searchMarker);
      };

      // In real scenario, we use geocode. If fails (like now without real ID), we fallback to random coord mock
      if (window.naver.maps.Service) {
        window.naver.maps.Service.geocode({ query: fullAddress }, (status: any, response: any) => {
          if (status === window.naver.maps.Service.Status.OK && response.v2.addresses.length > 0) {
            const item = response.v2.addresses[0];
            showTooltipOnMap(parseFloat(item.y), parseFloat(item.x));
          } else {
            // Mock random fallback for preview
            showTooltipOnMap(37.5385 + (Math.random() - 0.5) * 0.04, 127.0694 + (Math.random() - 0.5) * 0.04);
          }
        });
      } else {
        // Mock fallback if geocoder submodule didn't load (due to API key)
        showTooltipOnMap(37.5385 + (Math.random() - 0.5) * 0.04, 127.0694 + (Math.random() - 0.5) * 0.04);
      }
    }
  };

  return (
    <div className="relative w-full h-full bg-[#E5E5E5] overflow-hidden flex flex-col items-center">
      {/* Search Bar - Floating */}
      <div className="absolute top-10 w-[calc(100%-48px)] max-w-md bg-white rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.08)] px-5 py-3 flex items-center gap-3 z-10 transition-all">
        <Search className="text-[#6B7684]" size={20} />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="주소를 입력해 방문록을 찾아보세요" 
          className="flex-1 text-[15px] outline-none text-[#333D4B] placeholder:text-[#8B95A1] bg-transparent"
        />
        {searchQuery.length > 0 && (
          <button 
            onClick={() => setPostcodeOpen(true)}
            className="text-[14px] font-bold text-[#3182F6] whitespace-nowrap px-1 transition-all"
          >
            검색하기
          </button>
        )}
      </div>

      {/* Naver Map Container */}
      <div ref={mapElement} className="absolute inset-0 z-0 w-full h-full" />

      {/* Address Search Postcode Modal/Sheet */}
      <BottomSheet
        isOpen={isPostcodeOpen}
        onClose={() => setPostcodeOpen(false)}
        title="주소 검색"
      >
        <div className="mt-4 -mx-6 h-[60vh]">
          {/* DaumPostcodeEmbed keeps its own search bar allowing users to search deeply */}
          <DaumPostcodeEmbed
            onComplete={handleCompletePostcode}
            autoClose={false}
            defaultQuery={searchQuery}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </BottomSheet>

      {/* Bottom Sheet for Writing */}
      <BottomSheet 
        isOpen={isSheetOpen} 
        onClose={() => setSheetOpen(false)}
        title="방문록 작성하기"
      >
        <div className="flex flex-col gap-8 mt-2">
          {/* Address Area */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[16px] font-bold text-[#333D4B]">{selectedAddress}</span>
              <div className="flex items-center gap-1 bg-[#E8F3FF] text-[#3182F6] px-2 py-0.5 rounded-full text-[11px] font-semibold">
                <CheckCircle2 size={12} />
                <span>방문자 인증</span>
              </div>
            </div>
            <p className="text-[13px] text-[#6B7684]">실제 방문한 위치가 맞습니다.</p>
          </div>

          {/* Photo Attachment */}
          <div>
            <h3 className="text-[15px] font-bold text-[#333D4B] mb-3">사진 첨부</h3>
            <button className="w-24 h-24 rounded-[12px] border-2 border-dashed border-[#D1D6DB] flex flex-col items-center justify-center gap-1 text-[#8B95A1] bg-[#F9FAFB] hover:bg-[#F2F4F6] transition-colors">
              <Camera size={24} />
              <span className="text-[12px]">0/5</span>
            </button>
          </div>

          {/* Ratings */}
          <div>
            <h3 className="text-[15px] font-bold text-[#333D4B] mb-4">어떤 점이 좋았나요?</h3>
            <div className="space-y-4">
              <RatingRow label="채광" value={ratings.light} onChange={(v) => setRatings(r => ({ ...r, light: v }))} />
              <RatingRow label="소음" value={ratings.noise} onChange={(v) => setRatings(r => ({ ...r, noise: v }))} />
              <RatingRow label="수압" value={ratings.water} onChange={(v) => setRatings(r => ({ ...r, water: v }))} />
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-[15px] font-bold text-[#333D4B] mb-3">태그 선택</h3>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={cn(
                    "px-4 py-2 rounded-full text-[14px] font-medium transition-colors border",
                    selectedTags.includes(tag) 
                      ? "bg-[#E8F3FF] text-[#3182F6] border-[#3182F6]" 
                      : "bg-[#F2F4F6] text-[#4E5968] border-transparent hover:bg-[#E5E8EB]"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="absolute bottom-6 left-6 right-6">
          <button 
            className="w-full bg-[#3182F6] text-white rounded-[16px] py-4 text-[16px] font-bold shadow-md active:scale-[0.98] transition-transform"
            onClick={() => {
              alert('방문록이 등록되었습니다!');
              setSheetOpen(false);
            }}
          >
            방문록 등록하기
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

function RatingRow({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[15px] text-[#4E5968] w-12">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} onClick={() => onChange(star)} className="p-1">
            <Star 
              size={28} 
              className={star <= value ? "fill-[#F5A623] text-[#F5A623]" : "fill-[#E5E8EB] text-[#E5E8EB]"} 
            />
          </button>
        ))}
      </div>
    </div>
  );
}
