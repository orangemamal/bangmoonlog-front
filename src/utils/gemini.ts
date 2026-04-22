/**
 * Gemini AI를 이용한 리뷰 콘텐츠 검열 유틸리티
 */

// Firebase Cloud Function URL (API 키 보안을 위해 서버 측 처리)
const MODERATE_FUNCTION_URL = "https://asia-northeast3-bangmoonlog-bdf9a.cloudfunctions.net/moderateContent";

export interface CleansingResult {
  isPassed: boolean;
  reason?: string;
}

/**
 * 리뷰 텍스트를 AI로 분석하여 부적절한 내용이 있는지 판별합니다.
 */
export const analyzeReviewWithAI = async (content: string): Promise<CleansingResult> => {
  console.log("[AI 검열] 분석 시작:", content);

  // 1. 기본적인 Regex 기반 사전 필터링 (AI 호출 전 1차 차단)
  const swearRegex = /(씨발|시발|ㅅㅂ|ㅆㅂ|병신|좆|존나|ㅈㄴ|개새끼|지랄|fuck|shit|asshole|fucker)/i;
  if (swearRegex.test(content)) {
    console.warn("🚫 [AI 검열] 1차 필터(Regex)에서 부적절한 언어가 감지되었습니다.");
    return { isPassed: false, reason: "비속어가 포함되어 있습니다." };
  }

  try {
    // 2. Firebase Cloud Function 호출 (서버에서 Gemini API 호출)
    // 이제 프론트엔드에는 API 키가 전혀 노출되지 않습니다.
    const response = await fetch(MODERATE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ [AI 검열] 서버 에러:", errorData);
      return { isPassed: false, reason: "시스템 분석 오류 (잠시 후 다시 시도해주세요)" };
    }

    const data = await response.json();
    console.log("🤖 [AI 검열] 서버 판단 결과:", data);

    return {
      isPassed: data.isPassed,
      reason: data.reason
    };
  } catch (error) {
    console.error("❌ [AI 검열] 시스템 오류:", error);
    return { isPassed: false, reason: "검열 시스템 통신 오류" };
  }
};
