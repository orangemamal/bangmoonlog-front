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
  const clean = detail.replace(/[\[\]]/g, "");
  return `[${clean}]`;
};
