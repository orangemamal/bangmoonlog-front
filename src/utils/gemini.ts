/**
 * Gemini AI를 이용한 리뷰 콘텐츠 검열 유틸리티
 */

// Firebase Cloud Function URL (실제 배포된 Cloud Run 엔드포인트)
const MODERATE_FUNCTION_URL = "https://moderatecontent-pgxt2tqsrq-du.a.run.app";

export type CleansingType = "PASS" | "REJECT" | "ERROR";

export interface CleansingResult {
  isPassed: boolean;
  type: CleansingType;
  reason?: string;
}

/**
 * 리뷰 텍스트를 AI로 분석하여 부적절한 내용이 있는지 판별합니다.
 * 이제 멍청한 키워드 필터링이 아닌, 백엔드 AI의 지능형 문맥 분석에 전적으로 의지합니다.
 */
export const analyzeReviewWithAI = async (content: string): Promise<CleansingResult> => {
  console.log("[AI 검열] 지능형 문맥 분석 시작:", content);

  try {
    const response = await fetch(MODERATE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ [AI 검열] 서버 에러:", errorData);
      return { 
        isPassed: false, 
        type: "ERROR",
        reason: "AI 시스템이 잠시 휴식 중이에요. 잠시 후 다시 시도해주세요!" 
      };
    }

    const data = await response.json();
    console.log("🤖 [AI 검열] 서버 판단 결과:", data);

    return {
      isPassed: data.isPassed,
      type: data.isPassed ? "PASS" : "REJECT",
      reason: data.reason
    };
  } catch (error) {
    console.error("❌ [AI 검열] 시스템 오류:", error);
    return { 
      isPassed: false, 
      type: "ERROR",
      reason: "네트워크 연결이 불안정합니다. 연결 상태를 확인해주세요." 
    };
  }
};
