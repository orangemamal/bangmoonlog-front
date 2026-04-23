const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors")({ origin: true });

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
      const axios = require("axios");
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
 * Gemini AI를 이용한 콘텐츠 모더레이션 함수 (공식 SDK 방식 - 모델명 정밀 타격)
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
    let apiKey = process.env.GEMINI_API_KEY;

    if (!content) return res.status(400).json({ isPassed: false, reason: "내용이 없습니다." });
    if (!apiKey) return res.status(500).json({ isPassed: false, reason: "서버 설정 오류 (API Key 없음)" });

    // API 키 세척
    apiKey = apiKey.replace(/[^\x20-\x7E]/g, "").trim();

    try {
      const prompt = `
        너는 부동산 리뷰 플랫폼의 '절대 타협하지 않는 아주 엄격한 보안관 AI'야.
        다음 [리뷰 내용]에 아주 미세한 욕설, 비하, 불쾌감을 주는 표현이 하나라도 있으면 무조건 REJECT 해야 해.

        [검열 기준]
        1. 욕설 및 비속어: 직접/변형/영어 욕설 모두 포함.
        2. 혐오 및 비하: 지역/성별/나이/직업 비하.
        3. 불쾌한 표현: 성적 암시, 폭력적 묘사, 공격적 말투.
        4. 광고 및 도배: 홍보성 문구, 무의미한 반복.

        [응답 형식]
        - 적절한 내용: 'PASS'
        - 부적절한 내용: 'REJECT: [짧은 이유]'
        - 결과 외에 다른 설명은 절대 하지 마.

        [분석할 내용]
        "${content}"
      `;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }]
        },
        {
          headers: { "Content-Type": "application/json" }
        }
      );
      
      const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      
      console.log("🤖 [AI 분석 성공]:", aiResponse);

      if (aiResponse.toUpperCase().includes("PASS")) {
        return res.status(200).json({ isPassed: true });
      } else {
        const reason = aiResponse.includes("REJECT") 
          ? aiResponse.split(":")[1]?.trim() || "부적절한 내용 감지"
          : "부적절한 표현이 포함되어 있습니다.";
        return res.status(200).json({ isPassed: false, reason });
      }
    } catch (error) {
      console.error("❌ [Gemini SDK Error]:", error.message);
      return res.status(500).json({ 
        isPassed: false, 
        reason: `AI 분석 최종 호출 실패: ${error.message}. API 키의 모델 권한을 확인해주세요.`
      });
    }
  });
});
