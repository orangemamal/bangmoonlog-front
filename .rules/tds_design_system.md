# TDS (Toss Design System) Usage Rules (TDS 사용 원칙)

이 문서는 Toss 디자인 시스템(TDS) 사용 원칙을 정의합니다.
(Rules for using the Toss Design System.)

## 🎨 Core Libraries (핵심 라이브러리)
- `@toss/tds-mobile` & `@toss/tds-mobile-ait`
- `@toss/tds-colors` (Color Tokens)

## 📏 UI Rules (UI 개발 규칙)
1. **TDS-First**: Use standard TDS components for all UI elements (Buttons, Lists, Inputs). (모든 UI 요소에 TDS 표준 컴포넌트 사용.)
2. **Design Parity**: Maintain consistency with Toss app aesthetics. (토스 앱의 스타일과 일관성 유지.)
3. **Color Tokens**: Never hardcode hex colors. Use `@toss/tds-colors`. (헥사 코드 금지. 컬러 토큰 사용.)
4. **Mobile Optimization**: Ensure layouts are touch-friendly and handle safe areas. (모바일 웹뷰 및 세이프 에어리 최적화.)

## 🧠 AI Agent Instruction (AI 주시 사항)
- Search existing code for TDS implementation examples before creating new ones. (새 컴포넌트 생성 전 기존 TDS 구현 사례를 검색하십시오.)
- Use `mock-tds.js` if present to understand the simulation environment. (`mock-tds.js`가 있다면 이를 통해 환경을 파악하십시오.)
