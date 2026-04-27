# 🏠 방문Log (Bangmoon Log)

![Mobile App](https://img.shields.io/badge/App-Mobile--WebView-blue)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange)
![React](https://img.shields.io/badge/React-18.3-61DAFB)
![Vercel](https://img.shields.io/badge/Deployment-Vercel-black)

**방문Log**는 주소지에 기반한 생생한 거주/방문 후기를 공유하는 서비스입니다. 
인증된 사용자를 통한 신뢰할 수 있는 익명 커뮤니티를 지향하며, 지도 기반으로 집을 구하기 전 필수 정보를 확인하고 서로의 경험을 나눌 수 있습니다.

## ✨ 주요 기능

- **📍 지도 기반 실시간 리뷰 조회**: 네이버 지도를 통해 특정 지역/주소의 리뷰 개수와 평점을 실시간으로 확인 가능합니다. (onSnapshot 동기화)
- **📝 인증된 방문록 작성**: 간편 로그인을 기반으로 인증된 사용자만 방문록을 작성할 수 있어 데이터의 신뢰도를 높였습니다.
- **🔒 권한 기반 열람 시스템 (Give & Take)**: 
  - 방문록을 1회 작성하면 1년간 전체 리뷰 열람 권한 부여
  - 비로그인/미작성 시에도 간단한 광고 시청(Mock) 후 열람 가능
- **🤖 AI 클린 모니터링**: Gemini AI를 통해 부적절한 게시물을 실시간으로 필터링하여 쾌적한 커뮤니티 환경을 유지합니다.
- **🏷️ 상세 환경 평가**: 채광, 소음, 수압 등 거주 환경에 대한 정량적 평가와 맞춤형 해시태그 지원.

## 🚀 시작하기

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **환경 변수 설정**
   `.env` 파일을 생성하고 Firebase 및 Gemini API 설정값을 입력하세요.
   ```env
   PUBLIC_FIREBASE_API_KEY=...
   PUBLIC_FIREBASE_PROJECT_ID=...
   PUBLIC_GEMINI_API_KEY=...
   # ... 기타 설정
   ```

3. **개발 서버 실행**
   ```bash
   npm run dev
   ```

## 🛠️ 기술 스택

- **Frontend**: React 18, TypeScript, Rsbuild
- **Styling**: Vanilla CSS (Premium Custom Design)
- **Backend**: Firebase Firestore, Cloud Functions
- **AI**: Google Gemini (Moderation)
- **Maps**: Naver Maps API v3
- **Deployment**: Vercel (Frontend), GitHub Actions (Functions)

## 📱 모바일 UX 최적화
- **Hybrid WebView 지원**: 실 모바일 디바이스 환경을 고려한 상단/하단 네비게이션 및 인터랙션 최적화.
- **뒤로가기 제어**: 홈 화면에서 뒤로가기 버튼을 두 번 누를 시 앱이 종료되는 안드로이드 표준 인터랙션 구현.
- **PWA 지향**: 웹 환경에서도 앱과 같은 부드러운 전환과 모바일 퍼스트 디자인 제공.
