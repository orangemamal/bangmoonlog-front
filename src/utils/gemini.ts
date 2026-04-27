import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini AI를 이용한 리뷰 콘텐츠 검열 및 AI 에이전트 유틸리티
 */

// Firebase Cloud Function URL (리뷰 검열용)
const MODERATE_FUNCTION_URL = "https://moderatecontent-pgxt2tqsrq-du.a.run.app";

// Gemini API Key 로드 로직 강화 (Rsbuild/Vite 호환)
const GEMINI_API_KEY =
  (import.meta as any).env?.PUBLIC_GEMINI_API_KEY ||
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  "";

console.log("🔑 [Gemini] API Key Check:", GEMINI_API_KEY ? "SUCCESS (Loaded)" : "FAILED (Empty)");

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export type CleansingType = "PASS" | "REJECT" | "ERROR";

export interface CleansingResult {
  isPassed: boolean;
  type: CleansingType;
  reason?: string;
}

/**
 * 리뷰 텍스트를 AI로 분석하여 부적절한 내용이 있는지 판별합니다.
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

/**
 * 리뷰 검열 외에 일반적인 AI 질문(검색 에이전트 등)을 처리하는 함수입니다.
 * 프록시 서버(검열 전용) 대신 Google Generative AI SDK를 직접 사용하여 정확한 응답을 생성합니다.
 */
export const askGemini = async (prompt: string): Promise<string> => {
  console.log("✨ [AI Agent] 질문 요청 (Direct SDK):", prompt);

  if (!genAI) {
    console.warn("⚠️ Gemini API Key가 설정되지 않았습니다. 프록시 서버를 시도합니다.");
    return fallbackAskGemini(prompt);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log("🤖 [AI Agent] SDK 응답:", text);
    return text;
  } catch (error) {
    console.error("❌ [AI Agent] SDK 오류:", error);
    return fallbackAskGemini(prompt);
  }
};

/**
 * SDK 실패 시 또는 API Key 부재 시 사용하는 폴백 함수
 */
async function fallbackAskGemini(prompt: string): Promise<string> {
  try {
    const response = await fetch(MODERATE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: prompt })
    });

    if (!response.ok) throw new Error("AI 서버 응답 실패");

    const data = await response.json();
    // 만약 프록시가 검열 결과만 반환한다면, JSON 형식이 아닐 수 있으므로 주의가 필요함
    return data.reason || (typeof data === 'string' ? data : JSON.stringify(data));
  } catch (error) {
    console.error("❌ [AI Agent] 폴백 오류:", error);
    throw error;
  }
}
