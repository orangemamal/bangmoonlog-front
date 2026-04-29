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
  // 지역명에서 시도코드 추출
  const ctpvCd = Object.entries(CITY_CODE_MAP).find(
    ([key]) => regionName.includes(key)
  )?.[1] || '11';

  // ── Step 1: 월별 데이터 최대 6개월 뒤로 재시도 ──
  for (let retry = 2; retry <= 7; retry++) {
    try {
      const target = new Date();
      target.setMonth(target.getMonth() - retry);
      const oprYm = `${target.getFullYear()}${String(target.getMonth() + 1).padStart(2, '0')}`;

      console.log(`[교통] 월별 조회 시도: ${oprYm} (${retry}개월 전)`);
      const url = `${getProxyBase()}?type=transit&ctpvCd=${ctpvCd}&oprYm=${oprYm}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const result = parseTransitResponse(data, ctpvCd);
      if (result) {
        console.log(`✅ [교통] ${oprYm} 데이터 조회 성공! 이용객: ${result.totalPassengers.toLocaleString()}명`);
        return result;
      }
    } catch { /* 다음 달로 */ }
  }

  // ── Step 2: 연간 데이터 폴백 ──
  try {
    console.log('[교통] 월별 데이터 전부 없음, 연간 데이터 조회...');
    const annualUrl = `${getProxyBase()}?type=transit&ctpvCd=${ctpvCd}&mode=annual`;
    const res = await fetch(annualUrl);
    if (res.ok) {
      const data = await res.json();
      const result = parseTransitResponse(data, ctpvCd);
      if (result) {
        console.log(`✅ [교통] 연간 데이터 조회 성공!`);
        return result;
      }
    }
  } catch { /* 폴백으로 */ }

  // ── Step 3: 시연 끊김 방지용 추정치 반환 ──
  console.warn('[교통] 모든 조회 실패, 지역 평균 추정치 반환');
  const cityName = Object.entries(CITY_CODE_MAP).find(([, v]) => v === ctpvCd)?.[0] || '서울';
  // 시도별 일평균 대중교통 이용객 추정치 (만명)
  const avgEstimates: Record<string, number> = {
    '서울': 8500000, '경기': 4200000, '부산': 1800000, '인천': 1200000,
    '대구': 900000, '대전': 600000, '광주': 500000, '울산': 350000,
    '세종': 80000, '강원': 200000, '충북': 250000, '충남': 300000,
    '전북': 280000, '전남': 220000, '경북': 300000, '경남': 350000, '제주': 150000,
  };

  return {
    totalPassengers: avgEstimates[cityName] || 5000000,
    lines: [],
    period: `${new Date().getFullYear() - 1}년 평균 추정`,
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
 * 2. 주변 CCTV 현황 (행정안전부)
 */
export const getNearbyCCTV = async (lat: number, lng: number, radius: number = 300) => {
  try {
    const url = `${getProxyBase()}?type=cctv&lat=${lat}&lng=${lng}&radius=${radius}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    // 다양한 공공데이터 응답 형식 처리
    if (data.response?.body) return data;
    if (data.items) return { response: { body: { totalCount: data.items.length, items: data.items } } };
    if (data.totalCount !== undefined) return { response: { body: data } };
    if (data.data) return { response: { body: { totalCount: data.data.length || 0, items: data.data } } };
    // 어떤 형식이든 데이터가 있으면 래핑해서 반환
    if (typeof data === 'object' && Object.keys(data).length > 0) {
      console.log('[CCTV] 비표준 응답 형식, 래핑 처리:', Object.keys(data));
      return { response: { body: { totalCount: 0, items: [], raw: data } } };
    }
    throw new Error('Unexpected format');
  } catch (error) {
    console.warn('[안전] CCTV 조회 실패, 폴백 사용:', error);
    // 폴백: 서울 도심 평균 CCTV 밀도 기반 추정치
    const estimatedCount = Math.round(radius / 20) + 8;
    return {
      response: { body: { totalCount: estimatedCount, items: [] } },
      _fallback: true
    };
  }
};

/**
 * 3. 교통사고 다발지역 (도로교통공단)
 */
export const getAccidentHotspots = async (lat: number, lng: number) => {
  try {
    const url = `${getProxyBase()}?type=accident&siDo=11&guGun=680`;
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
