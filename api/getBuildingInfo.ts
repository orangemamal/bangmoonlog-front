import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { sigunguCd, bjdongCd, bun, ji } = req.query;

  if (!sigunguCd || !bjdongCd) {
    return res.status(400).json({ error: 'Missing required parameters (sigunguCd, bjdongCd)' });
  }

  const serviceKey = process.env.PUBLIC_DATA_PORTAL_KEY;
  
  if (!serviceKey) {
    return res.status(500).json({ error: 'Missing API Service Key in environment' });
  }

  // 4자리 숫자로 포맷팅 (0001 등)
  const formatLot = (val: any) => {
    if (!val) return '0000';
    return String(val).padStart(4, '0');
  };

  const url = new URL('https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo');
  url.searchParams.append('serviceKey', serviceKey);
  url.searchParams.append('sigunguCd', sigunguCd as string);
  url.searchParams.append('bjdongCd', bjdongCd as string);
  url.searchParams.append('bun', formatLot(bun));
  if (ji && ji !== '0' && ji !== '0000') {
    url.searchParams.append('ji', formatLot(ji));
  }
  url.searchParams.append('_type', 'json');
  url.searchParams.append('numOfRows', '10');

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    const items = data?.response?.body?.items?.item;
    
    if (!items) {
      return res.status(200).json({ isResidential: null, message: 'No building info found', raw: data });
    }

    // 결과가 배열일 수도 있고 단일 객체일 수도 있음
    const itemList = Array.isArray(items) ? items : [items];
    
    /**
     * 주용도코드명(mainPurpsCdNm) 확인
     * [유도리 개편] 최대한 많은 주거 가능 건물을 허용함
     */
    const residentialKeywords = [
      '아파트', '주택', '단독', '연립', '다세대', '다가구', '오피스텔', '기숙사', 
      '근린생활', // 상가주택 포함
      '업무시설', // 오피스텔이 업무시설로 분류됨
      '노유자',   // 실버타운 등
      '교정 및 군사' // 군관사 등
    ];
    
    const buildings = itemList.map((item: any) => {
      const passengerElev = parseInt(item.rideUseElvtCnt || '0', 10);
      const emergencyElev = parseInt(item.emgnUseElvtCnt || '0', 10);
      const otherElev = parseInt(item.othElvtCnt || '0', 10);
      return {
        name: item.bldNm,
        purpose: item.mainPurpsCdNm,
        isResidential: residentialKeywords.some(kw => item.mainPurpsCdNm?.includes(kw)),
        totalFloors: parseInt(item.grndFlrCnt || '0', 10),
        underFloors: parseInt(item.ugrndFlrCnt || '0', 10),
        elevatorCount: passengerElev + emergencyElev + otherElev,
        builtYear: item.useAprDay ? item.useAprDay.substring(0, 4) : '',
        structure: item.strctCdNm || '',
      };
    });

    // 하나라도 주거용 키워드가 포함되어 있으면 주거용으로 판단
    const isResidential = buildings.some(b => b.isResidential);

    // [개선] 모든 항목의 승강기 수를 합산 (대형 빌딩은 여러 레코드에 분산될 수 있음)
    const totalElevCount = buildings.reduce((sum, b) => sum + b.elevatorCount, 0);
    
    // [개선] 가장 층수가 높거나 정보가 많은 항목을 메인으로 선택
    const main = buildings.sort((a, b) => {
      // 1순위: 층수가 높은 것
      if (b.totalFloors !== a.totalFloors) return b.totalFloors - a.totalFloors;
      // 2순위: 이름이 있는 것
      const aHasName = a.name && a.name.trim().length > 0;
      const bHasName = b.name && b.name.trim().length > 0;
      if (aHasName && !bHasName) return -1;
      if (!aHasName && bHasName) return 1;
      return 0;
    })[0];

    return res.status(200).json({
      isResidential,
      buildings,
      totalCount: data?.response?.body?.totalCount,
      // 메인 건물 요약 (승강기는 합산값 사용)
      totalFloors: main?.totalFloors || 0,
      underFloors: main?.underFloors || 0,
      elevatorCount: Math.max(main?.elevatorCount || 0, totalElevCount), // 개별 항목 중 최대값 또는 합산값 중 큰 것
      builtYear: main?.builtYear || '',
      structure: main?.structure || '',
      fullRaw: data
    });

  } catch (error) {
    console.error('Building Registry API Error:', error);
    return res.status(500).json({ error: 'Failed to fetch building info', details: error instanceof Error ? error.message : String(error) });
  }
}
