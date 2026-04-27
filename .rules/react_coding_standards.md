# React Coding Standards (React 코딩 표준)

이 문서는 이 프로젝트의 React 및 전반적인 프런트엔드 개발 규칙을 정의합니다.
(This document defines the rules for React and general frontend development.)

## 🛠️ Stack (기술 스택)
- **Framework**: React 18
- **Build Tool**: Rsbuild
- **Routing**: `react-router-dom` v7+
- **Styling**: SCSS (Sass)

## 📋 Development Rules (개발 규칙)
1. **Routing**: 모든 페이지는 `src/pages`에 위치합니다. (All pages must be in `src/pages`.)
2. **TypeScript**:
   - `any` 사용 금지. (Strictly forbid `any`.)
   - Props/State는 항상 명확한 Type으로 정의. (Always define Props/State with clear interfaces.)
3. **Architecture**:
   - 로직 분리: 비즈니스 로직은 `hooks`로 분리. (Separate business logic into `hooks`.)
   - 재사용성: UI는 `components/`에 재사용 가능하게 구축. (Build reusable UI in `components/`.)
   - **컴포넌트화 필수**: 새로운 화면이나 복잡한 모달, 팝업, 독립적인 기능을 추가할 때는 `pages/` 파일이 비대해지지 않도록 반드시 `components/` 하위의 별도 파일로 컴포넌트화(Componentize)하여 부모 요소에 연결하십시오. (When adding new screens, complex modals, or independent features, **ALWAYS** extract them into separate component files under `components/` to prevent page file bloating.)

## 🧠 AI Agent Instruction (AI 주시 사항)
- Use `npm run dev` for local testing. (로컬 테스트 시 `npm run dev`를 사용하십시오.)
- Always follow the componentization rule to keep the codebase maintainable. (코드 유지보수성을 위해 항상 컴포넌트화 규칙을 준수하십시오.)
