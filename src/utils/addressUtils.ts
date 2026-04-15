/**
 * 상세주소(동·호수/층) 정규화 유틸리티
 * 데이터 중복 체크 및 일관된 표시를 위해 사용자가 입력한 상세주소를 정제합니다.
 */

export const normalizeAddressDetail = (detail: string): string => {
  if (!detail) return "";

  // 1. 양끝 공백 제거
  let normalized = detail.trim();

  // 2. 중간 공백 모두 제거 (동/호수 구분 시 오타 방지)
  normalized = normalized.replace(/\s+/g, "");

  // 3. 소문자 변환 (F -> f 등)
  normalized = normalized.toLowerCase();

  return normalized;
};

/**
 * 표시용 상세주소 포맷팅
 * 정규화된 주소를 UI에서 읽기 좋게 배지 텍스트 등으로 변환합니다.
 */
export const formatAddressDetail = (detail: string): string => {
  if (!detail) return "";
  
  // 정규화된 상태라면 그대로 반환하되, 앞에 '[' 뒤에 ']'를 붙여 배지 형태로 활용하기 좋게 함
  // 사용자가 이미 []를 썼다면 중복 방지
  const clean = detail.replace(/[[\]]/g, "");
  return `[${clean}]`;
};

/**
 * 기본 주소(도로명/지번) 정규화 유틸리티
 * '서울특별시' -> '서울', '경기도' -> '경기' 등 행정구역 명칭을 약어로 통일하여 
 * 찜하기 등 데이터 키값의 일관성을 보장합니다.
 */
export const normalizeBaseAddress = (address: string): string => {
  if (!address) return "";

  let normalized = address.trim();

  // 1. 행정구역 약어 변환
  const cityProvinceMap: { [key: string]: string } = {
    "서울특별시": "서울",
    "인천광역시": "인천",
    "대전광역시": "대전",
    "광주광역시": "광주",
    "대구광역시": "대구",
    "울산광역시": "울산",
    "부산광역시": "부산",
    "세종특별자치시": "세종",
    "세종시": "세종",
    "경기도": "경기",
    "강원도": "강원",
    "강원특별자치도": "강원",
    "충청북도": "충북",
    "충청남도": "충남",
    "전라북도": "전북",
    "전북특별자치도": "전북",
    "전라남도": "전남",
    "경상북도": "경북",
    "경상남도": "경남",
    "제주특별자치도": "제주",
    "제주도": "제주"
  };

  // 문장 시작 부분의 행정구역 명칭 치환
  for (const [full, short] of Object.entries(cityProvinceMap)) {
    if (normalized.startsWith(full)) {
      normalized = normalized.replace(full, short);
      break;
    }
  }

  // 2. 연속된 공백을 단일 공백으로 치환
  normalized = normalized.replace(/\s+/g, " ");

  return normalized;
};
