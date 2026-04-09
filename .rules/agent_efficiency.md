# AI Agent Efficiency & Resource Management (AI 효율성 지침)

이 문서는 AI 에이전트의 작업 효율성 및 토큰 절약 규칙을 정의합니다.
(Rules for AI efficiency and token saving.)

## ⚡ Work Principles: "Think, Observe, Act"
1. **Observation-First**: Always check current file state (`view_file`) before editing. (수정 전 반드시 파일 상태를 확인하십시오.)
2. **Minimal Diffs**: Use `replace_file_content` instead of `write_to_file` whenever possible to save tokens. (토큰 절약을 위해 최소 단위 수동 수정을 우선하십시오.)
3. **No Redundancy**: Search for existing utilities before creating new ones. (중복 구현을 방지하기 위해 기존 유틸리티를 먼저 검색하십시오.)

## 🗣️ Communication Style: "No Yapping"
- **Conciseness**: Avoid long intros/outros. Focus on results and logic. (결과와 논리 중심으로 간결하게 응답하십시오.)
- **Clarity**: Ask questions if the goal is ambiguous. Don't guess. (모호한 경우 추측하지 말고 질문하십시오.)
- **Bilingual Advantage**: Use technical terms in English for precision. (정밀도를 위해 기술 용어는 영어를 적극 활용하십시오.)

## 🧠 Memory Sync (컨텍스트 동기화)
- Always check `RULES.md` at the start of every session. (세션 시작 시 항상 `RULES.md`를 확인하십시오.)
- Document changes in `walkthrough.md`. (변경 사항은 `walkthrough.md`에 기록하십시오.)
