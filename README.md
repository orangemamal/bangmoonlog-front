# 🏠 방문LOG (Bangmoon Log)

![Toss App](https://img.shields.io/badge/Toss-Mini%20App-blue)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange)
![React](https://img.shields.io/badge/React-18.3-61DAFB)

**방문LOG**는 주소지에 기반한 실생생한 방문 후기를 공유하는 서비스입니다. 
토스 인증을 통한 신뢰할 수 있는 익명 커뮤니티를 지향하며, 지도 기반으로 집을 구하기 전 필수 정보를 확인하고 서로의 경험을 나눌 수 있습니다.

## ✨ 주요 기능

- **📍 지도 기반 리뷰 조회**: 네이버 지도를 통해 특정 지역/주소의 리뷰 개수와 평점을 한눈에 확인 가능합니다.
- **📝 토스 인증 방문록 작성**: 토스 로그인을 기반으로 인증된 사용자만 방문록을 작성할 수 있어 신뢰도를 높였습니다.
- **🔒 열람 권한 시스템**: 
  - 비로그인 시 1회 무료 열람 가능
  - 추가 열람 시 간단한 광고 시청(Mock) 후 제한 해제
- **🏷️ 태그 및 평가 시스템**: 채광, 소음, 수압 등 거주 환경에 대한 정량적 평가와 맞춤형 해시태그 지원.

## 🚀 시작하기

1. **의존성 설치**
   ```bash
   yarn install
   ```

2. **환경 변수 설정**
   `.env` 파일을 생성하고 Firebase 설정값을 입력하세요.
   ```env
   PUBLIC_FIREBASE_API_KEY=...
   PUBLIC_FIREBASE_PROJECT_ID=...
   # ... 기타 Firebase 관련 설정
   ```

3. **개발 서버 실행**
   ```bash
   npm run dev
   ```

## 🛠️ 기술 스택

- **Frontend**: React, TypeScript, Rsbuild
- **UI Framework**: @toss/tds-mobile-ait (Toss Design System)
- **Backend**: Firebase Firestore
- **Maps**: Naver Maps API v3
- **Deployment**: Vercel

## 📌 참고사항
이 프로젝트는 **Apps in Toss (AIT)** 환경에서 구동되도록 설계되었으며, 외부 환경(일반 브라우저/Vercel)에서도 원활한 확인을 위해 환경 우회 모킹 스크립트가 포함되어 있습니다.
