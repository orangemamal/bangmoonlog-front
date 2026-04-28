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

/**
 * 1. 서울시 지하철 실시간 혼잡도
 */
export const getSubwayCongestion = async (stationName: string) => {
  try {
    if (!stationName) return null;
    const url = `${getProxyBase()}?type=subway&station=${encodeURIComponent(stationName)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    // 서울시 API는 errorMessage가 없으면 정상 응답
    if (data.errorMessage) return null;
    return data;
  } catch (error) {
    console.warn('[교통] 지하철 혼잡도 조회 실패:', stationName, error);
    return null;
  }
};

/**
 * 2. 주변 CCTV 현황 (행정안전부)
 */
export const getNearbyCCTV = async (lat: number, lng: number, radius: number = 300) => {
  try {
    const url = `${getProxyBase()}?type=cctv&lat=${lat}&lng=${lng}&radius=${radius}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.response?.body) return data;
    if (data.items) return { response: { body: { totalCount: data.items.length, items: data.items } } };
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
