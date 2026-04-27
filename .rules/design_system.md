# Design System & Styling Rules (디자인 시스템 및 스타일링 규칙)

이 프로젝트는 사용자에게 프리미엄하고 일관된 경험을 제공하기 위해 자체 디자인 시스템 가이드를 따릅니다.
(This project follows its own design system guidelines to provide a premium and consistent experience.)

## 🎨 Design Philosophy (디자인 철학)
1. **Premium Aesthetics**: 단순히 기능적인 UI가 아닌, 감각적이고 고급스러운 디자인을 지향합니다. (Aim for sensory and luxurious design, not just functional UI.)
2. **Interactive UX**: 부드러운 애니메이션(`framer-motion`)과 즉각적인 피드백을 중시합니다. (Emphasize smooth animations and instant feedback.)

## 🛠️ Styling Tech Stack (스타일링 기술 스택)
- **SCSS (Sass)**: 구조적인 스타일링을 위해 SCSS를 사용합니다.
- **Global Variables**: `src/styles/variables.scss` 또는 유사한 위치에 정의된 브랜드 컬러와 토큰을 사용하십시오.

## 📋 Specific Rules (세부 규칙)
1. **Color Tokens**: 하드코딩된 색상값 대신 정의된 변수를 사용하십시오. (Use defined variables instead of hardcoded hex codes.)
2. **Typography**: 가독성이 높은 폰트와 일관된 계층(Hierarchy)을 유지하십시오.
3. **Icons**: `lucide-react`를 기본 아이콘 라이브러리로 사용합니다.

## 🧠 AI Agent Instruction (AI 주시 사항)
- 새로운 컴포넌트 생성 시 기존 디자인 패턴(둥근 모서리, 부드러운 그림자, 토스 스타일의 깔끔한 배경 등)을 참고하십시오. (Refer to existing design patterns when creating new components.)
- 모든 인터랙티브 요소에는 `hover` 및 `active` 상태를 정의하십시오. (Define hover and active states for all interactive elements.)
