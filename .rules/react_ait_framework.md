# Toss AIT Framework & React Coding Standards (React & AIT 코딩 표준)

이 문서는 이 프로젝트의 React 및 Toss AIT(Apps In Toss) 프레임워크 사용 규칙을 정의합니다.
(This document defines the rules for React and Toss AIT framework.)

## 🛠️ Stack (기술 스택)
- **Framework**: `@apps-in-toss/web-framework`
- **Build/Dev**: `rsbuild` & `granite`
- **Routing**: `react-router-dom` v7+ (Granite Router Plugin)

## 📋 Development Rules (개발 규칙)
1. **Routing**: 모든 페이지는 `src/pages`에 위치하며 `granite.config.ts` 설정을 따릅니다. (All pages must be in `src/pages` and follow `granite.config.ts`.)
2. **Bridge API**: 상호작용 시 `@apps-in-toss/web-framework`의 내장 기능을 우선 사용하십시오. (Prioritize built-in functions from `@apps-in-toss/web-framework`.)
3. **TypeScript**:
   - `any` 사용 금지. (Strictly forbid `any`.)
   - Props/State는 항상 명확한 Type으로 정의. (Always define Props/State with clear interfaces.)
4. **Architecture**:
   - 로직 분리: 비즈니스 로직은 `hooks`로 분리. (Separate business logic into `hooks`.)
   - 재사용성: UI는 `components/`에 재사용 가능하게 구축. (Build reusable UI in `components/`.)

## 🧠 AI Agent Instruction (AI 주시 사항)
- Check `granite.config.ts` before modifying routes. (라우트 수정 전 설정을 확인하십시오.)
- Use `npm run dev` for local testing. (로컬 테스트 시 `npm run dev`를 사용하십시오.)
