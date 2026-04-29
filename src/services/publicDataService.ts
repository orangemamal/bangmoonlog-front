/**
 * 공공데이터 연동 서비스 (Vercel Serverless Proxy 경유)
 * 
 * corsproxy.io가 불안정하여 자체 Vercel 프록시(/api/publicData)를 통해 
 * 서버사이드에서 공공데이터포털 API를 호출합니다.
 * 로컬 개발 시에는 직접 호출을 시도하고, 실패 시 프록시를 사용합니다.
 */

// 프록시 base URL (배포 시 자동으로 같은 도메인, 로컬에서도 Vercel dev로 동작)
const getProxyBase = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/api/publicData';
  }
  return '/api/publicData';
};

// 시도 코드 매핑 (지역명 → ctpv_cd)
const CITY_CODE_MAP: Record<string, string> = {
  '서울': '11', '부산': '26', '대구': '27', '인천': '28', '광주': '29',
  '대전': '30', '울산': '31', '세종': '36', '경기': '41', '강원': '42',
  '충북': '43', '충남': '44', '전북': '45', '전남': '46', '경북': '47',
  '경남': '48', '제주': '50',
};

/**
 * 1. 국토교통부 대중교통 이용인원수
 * 월별 → 최대 6개월 재시도 → 연간 폴백 → 추정치 폴백
 */
export const getTransitPassengerCount = async (regionName: string = '서울') => {
  const ctpvCd = Object.entries(CITY_CODE_MAP).find(
    ([key]) => regionName.includes(key)
  )?.[1] || '11';

  // 시도별 대중교통 일평균 이용객 추정치
  const cityName = Object.entries(CITY_CODE_MAP).find(([, v]) => v === ctpvCd)?.[0] || '서울';
  const avgEstimates: Record<string, number> = {
    '서울': 8500000, '경기': 4200000, '부산': 1800000, '인천': 1200000,
    '대구': 900000, '대전': 600000, '광주': 500000, '울산': 350000,
    '세종': 80000, '강원': 200000, '충북': 250000, '충남': 300000,
    '전북': 280000, '전남': 220000, '경북': 300000, '경남': 350000, '제주': 150000,
  };

  // 1회만 시도 (3개월 전), 실패하면 즉시 추정치
  try {
    const target = new Date();
    target.setMonth(target.getMonth() - 3);
    const oprYm = `${target.getFullYear()}${String(target.getMonth() + 1).padStart(2, '0')}`;
    const res = await fetch(`${getProxyBase()}?type=transit&ctpvCd=${ctpvCd}&oprYm=${oprYm}`);
    if (res.ok) {
      const data = await res.json();
      const result = parseTransitResponse(data, ctpvCd);
      if (result) return result;
    }
  } catch { /* 추정치로 */ }

  return {
    totalPassengers: avgEstimates[cityName] || 5000000,
    lines: [],
    period: `${cityName} 지역 평균`,
    cityCode: ctpvCd,
    itemCount: 0,
    _fallback: true,
  };
};

/** 공공데이터 응답을 파싱하여 구조화된 결과 반환 (데이터 없으면 null) */
function parseTransitResponse(data: any, ctpvCd: string) {
  const rawItems = data?.response?.body?.items?.item;
  if (!rawItems) return null;

  const itemList = Array.isArray(rawItems) ? rawItems : [rawItems];
  if (itemList.length === 0 || !itemList[0]) return null;

  let totalPassengers = 0;
  const lines: string[] = [];

  itemList.forEach((item: any) => {
    totalPassengers += parseInt(item.utztn_nope || item.psngr_num || '0', 10);
    const lineName = item.rte_nm || item.line_nm;
    if (lineName && !lines.includes(lineName)) lines.push(lineName);
  });

  if (totalPassengers === 0) return null;

  const period = itemList[0]?.opr_ym || itemList[0]?.opr_yr || '미상';

  return {
    totalPassengers,
    lines: lines.slice(0, 10),
    period: String(period),
    cityCode: ctpvCd,
    itemCount: itemList.length,
  };
}

// 기존 함수명 호환 (Home.tsx에서 사용 중)
export const getSubwayCongestion = getTransitPassengerCount;

/**
 * 2. 주변 CCTV 현황
 * 행정안전부 도로교통 CCTV API + 지역 밀도 기반 추정
 * (해당 API는 도로교통용 CCTV만 포함. 방범용은 별도 관리)
 */
export const getNearbyCCTV = async (lat: number, lng: number, radius: number = 300) => {
  // 서울 도심 기준 방범 CCTV 밀도 추정 (200m 반경 기준 약 25~40대)
  const estimateCCTV = (r: number) => {
    const base = Math.round(r / 10) + 15; // 도심 기본 밀도
    // 서울 도심(종로/중구) 좌표 범위면 밀도 높임
    if (lat > 37.55 && lat < 37.58 && lng > 126.97 && lng < 127.01) {
      return Math.round(base * 1.5); // 도심 핵심부 보정
    }
    return base;
  };

  try {
    const url = `${getProxyBase()}?type=cctv&lat=${lat}&lng=${lng}&radius=${radius}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // 도로교통 CCTV API 응답 처리
    const count = data.response?.body?.totalCount 
      || data.totalCount 
      || (data.items?.length) 
      || 0;

    // API에서 실제 데이터가 있으면 방범 CCTV 추정치와 합산
    if (count > 0) {
      const totalEstimate = count + estimateCCTV(radius);
      return {
        response: { body: { totalCount: totalEstimate, items: data.response?.body?.items?.item || [] } },
      };
    }

    // API 데이터 없으면 지역 밀도 추정치만 사용
    const estimated = estimateCCTV(radius);
    return {
      response: { body: { totalCount: estimated, items: [] } },
      _estimated: true,
    };
  } catch (error) {
    console.warn('[안전] CCTV API 실패, 지역 밀도 추정:', error);
    return {
      response: { body: { totalCount: estimateCCTV(radius), items: [] } },
      _estimated: true,
    };
  }
};

// 좌표 → 시도/구군 코드 매핑 (서울 주요 구)
const getDistrictCode = (lat: number, lng: number): { siDo: string; guGun: string } => {
  // 서울시 구별 대략적 좌표 범위 → 구군 코드
  const districts = [
    { name: '중구',     code: '680', latMin: 37.555, latMax: 37.575, lngMin: 126.97, lngMax: 127.01 },
    { name: '종로구',   code: '110', latMin: 37.575, latMax: 37.60,  lngMin: 126.96, lngMax: 127.01 },
    { name: '강남구',   code: '680', latMin: 37.49,  latMax: 37.53,  lngMin: 127.02, lngMax: 127.07 },
    { name: '서초구',   code: '650', latMin: 37.47,  latMax: 37.50,  lngMin: 126.98, lngMax: 127.05 },
    { name: '마포구',   code: '440', latMin: 37.54,  latMax: 37.57,  lngMin: 126.90, lngMax: 126.96 },
    { name: '영등포구', code: '560', latMin: 37.51,  latMax: 37.54,  lngMin: 126.89, lngMax: 126.93 },
    { name: '송파구',   code: '710', latMin: 37.49,  latMax: 37.52,  lngMin: 127.08, lngMax: 127.14 },
    { name: '용산구',   code: '170', latMin: 37.52,  latMax: 37.55,  lngMin: 126.96, lngMax: 127.01 },
    { name: '성동구',   code: '200', latMin: 37.55,  latMax: 37.57,  lngMin: 127.01, lngMax: 127.06 },
    { name: '광진구',   code: '215', latMin: 37.53,  latMax: 37.56,  lngMin: 127.07, lngMax: 127.11 },
  ];

  for (const d of districts) {
    if (lat >= d.latMin && lat <= d.latMax && lng >= d.lngMin && lng <= d.lngMax) {
      return { siDo: '11', guGun: d.code };
    }
  }
  return { siDo: '11', guGun: '680' }; // 기본: 서울 중구
};

/**
 * 3. 교통사고 다발지역 (도로교통공단)
 */
export const getAccidentHotspots = async (lat: number, lng: number) => {
  const { siDo, guGun } = getDistrictCode(lat, lng);
  try {
    const url = `${getProxyBase()}?type=accident&siDo=${siDo}&guGun=${guGun}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.response?.body) return data;
    return null;
  } catch (error) {
    console.warn('[안전] 사고다발지역 조회 실패:', error);
    return null;
  }
};

/**
 * 4. 장애인 편의시설 현황 (한국사회보장정보원)
 */
export const getBarrierFreeFacilities = async (buildingName: string) => {
  try {
    if (!buildingName) return null;
    const url = `${getProxyBase()}?type=barrier&name=${encodeURIComponent(buildingName)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.response?.body) return data;
    return null;
  } catch (error) {
    console.warn('[편의] 편의시설 조회 실패:', buildingName, error);
    return null;
  }
};

/**
 * 5. 전국 철도역사 편의시설 (TAGO)
 */
export const getRailwayConvenience = async (stationName: string) => {
  try {
    if (!stationName) return null;
    const url = `${getProxyBase()}?type=railway&station=${encodeURIComponent(stationName)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.response?.body) return data;
    return null;
  } catch (error) {
    console.warn('[편의] 철도역사 조회 실패:', stationName, error);
    return null;
  }
};

/**
 * 6. 전국 지하철역 정보 (TAGO) — 기존 호환용
 */
export const getNationalSubwayInfo = async (stationName: string) => {
  return getRailwayConvenience(stationName);
};

/**
 * 7. 전국 버스 도착 정보 (TAGO) — 향후 확장용
 */
export const getNationalBusArrival = async (cityCode: string, stationId: string) => {
  // 추후 프록시에 bus 타입 추가 시 연동
  return null;
};

// 주소 → 법정동코드/지번 매핑 (서울 주요 구)
const DISTRICT_MAP: Record<string, { sigungu: string; bjdong: Record<string, string> }> = {
  '중구': { sigungu: '11140', bjdong: { '다동': '10300', '무교동': '10200', '을지로': '11500', '회현동': '12200', '명동': '11400', '남대문로': '10700', '서소문동': '10100' } },
  '종로구': { sigungu: '11110', bjdong: { '종로': '15400', '청진동': '10200', '서린동': '10300', '수송동': '10400', '관철동': '14600' } },
  '강남구': { sigungu: '11680', bjdong: { '역삼동': '10300', '삼성동': '10500', '대치동': '10700', '논현동': '10100' } },
  '서초구': { sigungu: '11650', bjdong: { '서초동': '10800', '반포동': '10500', '잠원동': '10300', '방배동': '10100' } },
  '마포구': { sigungu: '11440', bjdong: { '합정동': '10100', '망원동': '10200', '연남동': '10400', '상수동': '10300' } },
  '용산구': { sigungu: '11170', bjdong: { '한남동': '10800', '이태원동': '10600', '용산동': '10100' } },
  '송파구': { sigungu: '11710', bjdong: { '잠실동': '10400', '가락동': '10800', '문정동': '10600' } },
  '영등포구': { sigungu: '11560', bjdong: { '여의도동': '10100', '영등포동': '10200', '당산동': '10400' } },
};

/**
 * 8. 건축물대장 정보 (국토교통부)
 * 주소에서 건물 층수, 승강기, 건축연도 등 조회
 */
export const getBuildingInfo = async (address: string) => {
  try {
    if (!address) return null;

    // 주소 파싱: "서울 중구 다동 70-5" → sigunguCd, bjdongCd, bun, ji
    const parts = address.replace(/특별시|광역시|도/g, '').trim().split(/\s+/);
    const guName = parts.find(p => p.endsWith('구'));
    const dongName = parts.find(p => p.endsWith('동') || p.endsWith('로'));
    const lotPart = parts.find(p => /^\d/.test(p)); // "70-5" 등

    if (!guName) return null;

    const district = DISTRICT_MAP[guName];
    if (!district) return null;

    // 동 이름 매칭
    const dongKey = dongName ? Object.keys(district.bjdong).find(k => dongName.includes(k)) : null;
    const bjdongCd = dongKey ? district.bjdong[dongKey] : Object.values(district.bjdong)[0];

    // 번지 파싱
    let bun = '0000', ji = '0000';
    if (lotPart) {
      const [mainNum, subNum] = lotPart.split('-');
      bun = (mainNum || '0').padStart(4, '0');
      ji = (subNum || '0').padStart(4, '0');
    }

    const url = `${getProxyBase()}?type=building&sigunguCd=${district.sigungu}&bjdongCd=${bjdongCd}&bun=${bun}&ji=${ji}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const item = data?.response?.body?.items?.item;
    const info = Array.isArray(item) ? item[0] : item;

    if (!info) return null;

    return {
      buildingName: info.bldNm || '',           // 건물명
      mainPurpose: info.mainPurpsCdNm || '',     // 주용도
      totalFloors: parseInt(info.grndFlrCnt || '0', 10),  // 지상층수
      underFloors: parseInt(info.ugrndFlrCnt || '0', 10), // 지하층수
      hasElevator: parseInt(info.rideUseElvtCnt || '0', 10) > 0, // 승강기 유무
      elevatorCount: parseInt(info.rideUseElvtCnt || '0', 10),    // 승강기 수
      builtYear: info.useAprDay ? info.useAprDay.substring(0, 4) : '', // 사용승인년도
      totalArea: parseFloat(info.totArea || '0'),  // 연면적
      structure: info.strctCdNm || '',            // 구조
    };
  } catch (error) {
    console.warn('[건물] 건축물대장 조회 실패:', address, error);
    return null;
  }
};
