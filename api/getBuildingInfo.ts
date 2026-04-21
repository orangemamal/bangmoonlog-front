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
  url.searchParams.append('ji', formatLot(ji));
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
     * 주거용 키워드: 아파트, 단독주택, 공동주택, 오피스텔, 다세대주택, 다가구주택 등
     */
    const residentialKeywords = ['아파트', '주택', '오피스텔', '다세대', '다가구', '기숙사'];
    
    const buildings = itemList.map((item: any) => ({
      name: item.bldNm,
      purpose: item.mainPurpsCdNm,
      isResidential: residentialKeywords.some(kw => item.mainPurpsCdNm?.includes(kw))
    }));

    // 하나라도 주거용이 있으면 주거용으로 판단 (상가주택 등 고려)
    const isResidential = buildings.some(b => b.isResidential);

    return res.status(200).json({
      isResidential,
      buildings,
      totalCount: data?.response?.body?.totalCount
    });

  } catch (error) {
    console.error('Building Registry API Error:', error);
    return res.status(500).json({ error: 'Failed to fetch building info', details: error instanceof Error ? error.message : String(error) });
  }
}
