const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 글로벌 설정 (리전 설정)
setGlobalOptions({ region: "asia-northeast3" });

admin.initializeApp();

exports.naverAuth = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).send("Missing access token");
    }

    try {
      const naverResponse = await axios.get("https://openapi.naver.com/v1/nid/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const naverUser = naverResponse.data.response;
      if (!naverUser || !naverUser.id) throw new Error("Could not parse Naver User Info");

      const uid = `naver:${naverUser.id}`;
      try {
        await admin.auth().updateUser(uid, {
          email: naverUser.email,
          displayName: naverUser.name || naverUser.nickname,
          photoURL: naverUser.profile_image,
          emailVerified: true
        });
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          await admin.auth().createUser({
            uid: uid,
            email: naverUser.email,
            displayName: naverUser.name || naverUser.nickname,
            photoURL: naverUser.profile_image,
            emailVerified: true
          });
        } else {
          throw error;
        }
      }

      const customToken = await admin.auth().createCustomToken(uid);
      return res.status(200).json({
        firebaseToken: customToken,
        user: {
          id: uid,
          email: naverUser.email,
          name: naverUser.name || naverUser.nickname,
          picture: naverUser.profile_image,
        },
      });
    } catch (error) {
      console.error("Naver Auth Error:", error);
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  });
});

/**
 * Gemini AI를 이용한 콘텐츠 모더레이션 함수 (Google AI SDK 방식 - 프론트엔드와 동일 로직)
 */
exports.moderateContent = onRequest({ secrets: ["GEMINI_API_KEY"] }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const { content } = req.body;
    // [개선] Secret Manager와 환경 변수 모두에서 키를 찾도록 이중화 처리
    let apiKey = process.env.GEMINI_API_KEY || admin.remoteConfig()?.parameters?.GEMINI_API_KEY?.defaultValue;

    if (!content) return res.status(400).json({ isPassed: false, reason: "내용이 없습니다." });
    
    // 만약 여전히 키가 없다면, 하드코딩된 위치나 다른 설정에서라도 가져오기 시도 (배포 안정성 확보)
    if (!apiKey) {
      console.error("⚠️ [AI 분석] GEMINI_API_KEY를 찾을 수 없습니다. 설정 확인이 필요합니다.");
      return res.status(500).json({ isPassed: false, reason: "서버 설정 오류 (API Key 누락). Firebase Console에서 Secret 설정을 확인해주세요." });
    }

    // [중요] 혹시라도 섞여있을 수 있는 공백이나 보이지 않는 문자(BOM) 강제 제거
    apiKey = apiKey.replace(/[^\x20-\x7E]/g, "").trim();

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      // 사용자 프로젝트에서 지원하는 최신 모델명으로 교체
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        당신은 '방문LOG'라는 부동산 리뷰 플랫폼의 전문 검수관입니다. 
        단순한 단어 필터링이 아니라, 문장의 '의도'와 '맥락'을 심층적으로 파악하세요.

        [검열 및 허용 가이드라인]
        1. 비속어가 포함되어 있더라도, 맛이나 시설을 극찬하는 감탄사(예: '개좋음', '미친', '존맛')로 쓰였다면 허용(PASS)하세요.
        2. 반대로 긍정적인 단어나 웃음소리(ㅋㅋㅋ)가 섞여 있더라도, 타인을 조롱하거나 성적인 수치심을 유발하고 혐오를 조장하는 문맥이라면 즉시 거절(REJECT)하세요.
        3. 'ㅋㅋㅋ', 'ㅎㅎㅎ', '!!!', 'ㅠㅠ' 등 한국어 특유의 감정 표현을 위한 반복적인 자음이나 문장 부호는 '무의미한 도배'가 아닌 '강조된 감정 표현'으로 간주하여 너그럽게 허용하세요.
        4. 방문 후기와 전혀 상관없는 광고, 의미 없는 단어의 단순 나열(예: '가나다 가나다')은 제외하세요.
        5. 거주 환경과 관계없는 성적 묘사나 불쾌감을 주는 은유적 표현은 단어가 평범하더라도 문맥을 파악해 차단하세요.

        [응답 형식]
        - 결과는 반드시 JSON 형식으로만 응답하세요: { "isPassed": boolean, "reason": "string" }
        - 이 형식 외에 다른 설명은 절대 하지 마세요.

        [분석할 리뷰 내용]
        "${content}"
      `;

      const result = await model.generateContent(prompt);
      const aiResponseText = result.response.text().trim() || "{}";

      // JSON 형식만 추출 (혹시 모를 마크다운 태그 등 제거)
      const jsonMatch = aiResponseText.match(/\{.*\}/s);
      const finalJson = jsonMatch ? jsonMatch[0] : "{}";
      const aiData = JSON.parse(finalJson);

      console.log("🤖 [AI 분석 성공]:", aiData);

      return res.status(200).json({
        isPassed: aiData.isPassed ?? false,
        reason: aiData.reason || (aiData.isPassed ? "" : "부적절한 표현이 감지되었습니다.")
      });
    } catch (error) {
      console.error("Gemini SDK Error:", error.message);

      // 만약 여전히 404가 나면, API 키가 정말로 이 프로젝트용인지 재확인 필요
      return res.status(500).json({
        isPassed: false,
        reason: "AI 분석 호출 실패. 프론트엔드에서 썼던 키와 동일한지 확인이 필요합니다."
      });
    }
  });
});
