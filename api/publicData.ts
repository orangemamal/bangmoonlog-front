import type { VercelRequest, VercelResponse } from '@vercel/node';

const SERVICE_KEY = "2600358e2ef4b12a80188bfd469634c0e455b12bf4bc244ee4b701b98ec4826c";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, ...params } = req.query;

  try {
    let targetUrl = '';

    switch (type) {
      case 'transit': {
        // 국토교통부 대중교통 이용인원수
        const { ctpvCd, oprYm, mode } = params;
        const now = new Date();
        
        if (mode === 'annual') {
          // 연간 조회 (더 안정적)
          const year = (now.getFullYear() - 1).toString();
          targetUrl = `https://apis.data.go.kr/1613000/PublicTransportationPassengerCount/getAnnualPublicTransportationPassengerCount?serviceKey=${SERVICE_KEY}&pageNo=1&numOfRows=50&dataType=JSON&ctpv_cd=${ctpvCd || '11'}&opr_yr=${year}`;
        } else {
          // 월별 조회 (3개월 전 데이터 사용 - 집계 안정성)
          now.setMonth(now.getMonth() - 3);
          const defaultYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
          targetUrl = `https://apis.data.go.kr/1613000/PublicTransportationPassengerCount/getMonthlyPublicTransportationPassengerCount?serviceKey=${SERVICE_KEY}&pageNo=1&numOfRows=50&dataType=JSON&ctpv_cd=${ctpvCd || '11'}&opr_ym=${oprYm || defaultYm}`;
        }
        console.log('[transit proxy] URL:', targetUrl);
        break;
      }
      case 'cctv': {
        // CCTV 현황
        const { lat, lng, radius } = params;
        targetUrl = `https://apis.data.go.kr/1741000/cctv_info/getCCTVList?serviceKey=${SERVICE_KEY}&type=json&cctvType=1&pageNo=1&numOfRows=10&coord_x=${lng}&coord_y=${lat}&buffer=${radius || 300}`;
        break;
      }
      case 'accident': {
        // 교통사고 다발지역
        const { siDo, guGun } = params;
        targetUrl = `https://apis.data.go.kr/B552061/frequentzoneChild/getRestFrequentzoneChild?ServiceKey=${SERVICE_KEY}&searchYearCd=2023&siDo=${siDo || '11'}&guGun=${guGun || '680'}&type=json&numOfRows=10&pageNo=1`;
        break;
      }
      case 'barrier': {
        // 장애인 편의시설
        const name = params.name as string;
        targetUrl = `https://apis.data.go.kr/B554287/DisabledPersonConvenientFacility/getDisConvFaclList?serviceKey=${SERVICE_KEY}&type=json&faclNm=${encodeURIComponent(name)}&numOfRows=10&pageNo=1`;
        break;
      }
      case 'railway': {
        // 지하철역 정보
        const station = params.station as string;
        targetUrl = `https://apis.data.go.kr/1613000/SubwayInfoService/getKwrdSubwaySttnList?serviceKey=${SERVICE_KEY}&_type=json&subwayStationName=${encodeURIComponent(station)}`;
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid type parameter' });
    }

    const response = await fetch(targetUrl, {
      headers: { 'Accept': 'application/json' },
    });

    const text = await response.text();

    // JSON 파싱 시도, 실패하면 텍스트 그대로 반환
    try {
      const json = JSON.parse(text);
      return res.status(200).json(json);
    } catch {
      return res.status(200).json({ raw: text, status: response.status });
    }
  } catch (error: any) {
    console.error('[publicData proxy] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
