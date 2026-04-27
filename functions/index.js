const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

// 글로벌 설정 (리전 설정)
setGlobalOptions({ region: "asia-northeast3" });

admin.initializeApp();

exports.naverAuth = onRequest(async (req, res) => {
  return cors(req, res, async () => {
    // OPTIONS 요청 명시적 대응 (CORS)
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
      // 1. 네이버 API를 통해 사용자 정보 가져오기
      const naverResponse = await axios.get("https://openapi.naver.com/v1/nid/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const naverUser = naverResponse.data.response;

      if (!naverUser || !naverUser.id) {
        throw new Error("Could not parse Naver User Info");
      }

      // 2. Firebase 사용자 정보 동기화 (UserRecord 업데이트)
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

      // 3. 토큰 반환
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
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  });
});

/**
 * Gemini AI를 이용한 콘텐츠 모더레이션 함수 (Vertex AI 방식)
 */
exports.moderateContent = onRequest(async (req, res) => {
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

    if (!content) {
      return res.status(400).json({ isPassed: false, reason: "내용이 없습니다." });
    }

    try {
      const { GoogleGenerativeAI } = require("@google/generative-ai");

      // 최신 모델인 gemini-2.5-flash 사용 (1.5 버전은 지원 종료)
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        당신은 부동산 리뷰 플랫폼 '방문Log'의 아주 쿨하고 유도리 있는 전문 검수관입니다. 
        사용자들이 자유롭고 활기차게 소통할 수 있도록, 웬만한 건 다 'PASS' 시키는 것이 당신의 철학입니다.

        [너그러운 허용 기준 - 묻지도 따지지도 말고 PASS]
        1. 웃음소리: 'ㅋㅋㅋ', 'ㅎㅎㅎ', '!!!' 등 한국인의 흥겨운 추임새가 아무리 길어도 무조건 PASS.
        2. 거친 극찬: '개좋음', '존맛', '미친 뷰', '대박' 등 단어는 거칠어도 내용을 극찬하는 경우 무조건 PASS.
        3. 솔직한 비판: "방음 쓰레기임", "주인 진짜 불친절함", "곰팡이 쩔음" 등 단순 불평이나 비판은 서비스의 본질이므로 무조건 PASS.
        4. 짧은 인사: "굿", "좋아요", "추천" 등 짧은 내용도 사용자의 의사표시이므로 PASS.

        [엄격한 차단 기준 - 이것만 REJECT 하세요]
        1. 범죄적 발언: 패드립, 심각한 인격 모독, 살해 협박, 특정인 비하.
        2. 성적 금기: 구체적이고 불쾌한 성적 묘사, 성희롱, 음란성 문구.
        3. 불법 광고: 부동산과 전혀 상관없는 도박, 마약, 불법 대출, 스팸 광고.
        4. 무의미한 도배: "ㅁㅁㅁ", "...", "ㄱㄴㄷ" 처럼 의미 있는 단어나 문장 없이 특수문자/자음만 나열된 경우 '내용이 너무 짧거나 의미가 불분명'으로 REJECT 하세요.

        [응답 형식 - 필수 지시]
        - 결과는 반드시 JSON 형식으로만 응답하세요: { "isPassed": boolean, "reason": "string" }
        - 이 JSON 외에 다른 설명은 절대 하지 마세요.

        [분석할 리뷰 내용]
        "${content}"
      `;

      const result = await model.generateContent(prompt);
      const aiResponseText = result.response.text().trim() || "{}";

      // JSON 형식만 추출
      const jsonMatch = aiResponseText.match(/\{.*\}/s);
      const finalJson = jsonMatch ? jsonMatch[0] : "{}";

      try {
        const aiData = JSON.parse(finalJson);
        return res.status(200).json({
          isPassed: aiData.isPassed ?? true,
          reason: aiData.reason || ""
        });
      } catch (e) {
        // 파싱 실패 시에도 유도리 있게 텍스트 키워드 기반으로 최종 판단
        const isLikelyPass = aiResponseText.toUpperCase().includes("PASS") || aiResponseText === "{}";
        return res.status(200).json({
          isPassed: isLikelyPass,
          reason: isLikelyPass ? "" : "부적절한 내용이 감지되었습니다."
        });
      }
    } catch (error) {
      console.error("Gemini SDK Error:", error.message);
      return res.status(500).json({ isPassed: false, reason: "AI 분석 중 오류가 발생했습니다." });
    }
  });
});
