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
        당신은 부동산 리뷰 플랫폼 '방문Log'의 지능적이고 공정한 전문 검수관입니다. 
        단순한 키워드 필터링이 아니라, 인간처럼 문맥을 이해하고 이 내용이 '실제 부동산/주거/지역 리뷰로서 가치가 있는지'를 판단하는 것이 당신의 핵심 임무입니다.

        [PASS 기준 - 유연하게 허용]
        1. 정보성 비판: "방음 개쓰레기", "주인 진짜 깐깐함", "곰팡이 쩔음" 등 거친 표현이라도 주거 환경에 대한 구체적 정보를 담고 있다면 무조건 PASS.
        2. 인터넷 신조어/슬랑: "개좋음", "존맛(주변 맛집)", "미친 뷰", "혜자급 매물" 등 긍정적/부정적 감정을 실감나게 표현하는 신조어는 자연스럽게 이해하고 PASS.
        3. 짧지만 확실한 의사표시: "추천합니다", "절대 오지 마세요", "살기 좋아요" 등 주거 경험을 요약한 짧은 문장도 PASS.
        4. 감정 섞인 후기: "여기서 살다 암 걸릴 뻔", "천국이 따로 없음" 등 비유적 표현도 문맥상 주거 경험을 뜻한다면 PASS.

        [REJECT 기준 - 인간의 감각으로 차단]
        1. 무의미한 나열 및 도배: "바보바보바보", "하하하하하", "가나다라마바사", "ㅁㅁㅁㅁㅁ", "........" 등 단어의 나열일 뿐 주거 경험과 아무런 상관이 없는 의미 없는 내용은 REJECT.
        2. 맥락 없는 비난/욕설: 주거 환경에 대한 설명 없이 "야 이 XX야", "바보 자식들" 등 특정 대상이나 불특정 다수를 향한 단순 욕설 및 비하 발언은 REJECT.
        3. 주제와 무관한 뻘글: "오늘 점심 뭐 먹지?", "코인 떡상 가즈아" 등 부동산/지역 정보와 전혀 상관없는 개인적인 잡담이나 일기 형태는 REJECT.
        4. 범죄/혐오/광고: 패드립, 성희롱, 살해 협박, 불법 도박/대출 광고 등은 즉시 REJECT.

        [핵심 지시]
        - 당신은 AI가 아니라 '노련한 커뮤니티 매니저'입니다. 
        - 리뷰가 비록 짧거나 거칠어도 '정보로서의 가치'가 있다면 통과시키고, 
        - 겉보기에 멀쩡한 단어라도 '무의미한 반복'이나 '주제 이탈'이라면 과감히 거르세요.

        [응답 형식]
        - 반드시 JSON으로만 응답하세요: { "isPassed": boolean, "reason": "거절 시에만 사유 작성 (사용자에게 부드럽게 안내)" }
        - JSON 외에 어떤 텍스트도 포함하지 마세요.

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
