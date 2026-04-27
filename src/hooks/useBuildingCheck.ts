import { useState, useCallback, useRef } from 'react';
import { normalizeBaseAddress } from '../utils/addressUtils';

export const useBuildingCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const cacheRef = useRef<Record<string, boolean>>({});

  const checkIsResidentialLogic = (text: string) => {
    if (!text) return false;
    const whiteList = [
      "아파트", "빌라", "맨션", "주택", "오피스텔", "다세대", "다가구", "원룸",
      "투룸", "고시원", "고시텔", "빌리지", "리빙텔", "캐슬", "파크뷰", "단지", "전원", "다중", "쉐어하우스"
    ];
    if (whiteList.some(keyword => text.includes(keyword))) return true;

    const strongBlacklist = [
      "지하철", "지하상가", "지하쇼핑", "가로판매대", "구두수선", "지하차도", "보도육교",
      "공영주차장", "공공주차장", "환승센터", "지하역사", "역사내", "승강장", "터미널"
    ];
    if (strongBlacklist.some(keyword => text.includes(keyword))) return false;

    const infrastructureKeywords = [
      "역", "출구", "공원", "광장", "교차로", "숲", "유원지", "산", "계곡",
      "공항", "시장", "경찰서", "파출소", "소방서", "우체국", "시청", "구청", "동주민센터",
      "궁", "문화재", "유적지", "능", "단", "묘", "성곽", "경기장", "운동장"
    ];

    const isBlocked = infrastructureKeywords.some(keyword => {
      if (keyword.length === 1) {
        const singleRegex = new RegExp(`[가-힣]{2,}${keyword}$|(^|\\s)${keyword}($|\\s)`);
        return singleRegex.test(text);
      }
      return text.includes(keyword);
    });

    return !isBlocked;
  };

  const getBuildingInfo = async (sigunguCd: string, bjdongCd: string, bun: string, ji: string) => {
    try {
      const res = await fetch(`/api/getBuildingInfo?sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&bun=${bun}&ji=${ji}`);
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return null;
      const data = await res.json();
      return data.isResidential;
    } catch (e) {
      console.error("Building registry check failed:", e);
      return null;
    }
  };

  const checkAddress = useCallback(async (address: string, naverService?: any, coords?: any) => {
    const stdAddr = normalizeBaseAddress(address);
    if (cacheRef.current[stdAddr] !== undefined) return cacheRef.current[stdAddr];

    setIsChecking(true);
    let isRes = checkIsResidentialLogic(stdAddr);

    if (naverService && coords) {
      // 리버스 지오코딩을 통한 추가 확인
      await new Promise<void>((resolve) => {
        naverService.reverseGeocode({ coords, orders: "roadaddr,addr" }, async (status: any, res: any) => {
          if (status === window.naver.maps.Service.Status.OK) {
            const addrRes = res.v2.results.find((r: any) => r.name === 'addr' || r.name === 'roadaddr');
            const bName = addrRes?.land?.name || "";
            if (bName) isRes = isRes && checkIsResidentialLogic(bName);

            const addrResult = res.v2.results.find((r: any) => r.name === 'addr');
            if (addrResult) {
              const code = addrResult.code?.id;
              const land = addrResult.land;
              if (code && land?.number1) {
                const apiRes = await getBuildingInfo(code.substring(0, 5), code.substring(5, 10), land.number1, land.number2);
                if (apiRes !== null) isRes = apiRes;
              }
            }
          }
          resolve();
        });
      });
    }

    cacheRef.current[stdAddr] = isRes;
    setIsChecking(false);
    return isRes;
  }, []);

  return { checkAddress, isChecking };
};
