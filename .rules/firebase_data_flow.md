# Firebase Integration Guidelines (Firebase 연동 지침)

이 문서는 Firebase 연동 및 데이터 흐름 관리 규칙을 정의합니다.
(This document defines rules for Firebase integration and data management.)

## ⚙️ Config (구성)
- **SDK**: Firebase v10+ (Modular SDK)
- **Init**: `src/services/firebase.ts`

## 📊 Data Patterns (데이터 패턴)
1. **Modular SDK Only**: Use `getFirestore`, `collection`, `query`, etc. (이전 스타일 금지.)
2. **Async Handling**: Use `async/await` with `try-catch` for all Firebase calls. (모든 호출에 에러 핸들링 포함.)
3. **Typing**: Use Firestore `Converter` or strict TS interfaces for database records. (DB 레코드에 엄격한 TS 인터페이스 적용.)
4. **Efficiency**: Use `query`, `where`, and `limit` to minimize read costs. (읽기 비용 최소화를 위해 필터링 및 제한 사용.)

## 🧠 AI Agent Instruction (AI 주시 사항)
- Check `src/services/firebase.ts` before any DB action. (DB 작업 전 초기화 파일을 확인하십시오.)
- Verify `.env` for required Firebase keys. (필요한 Firebase 키가 `.env`에 있는지 확인하십시오.)
