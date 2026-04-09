# 🏗️ BangmoonLog: AI Agent Master Index (RULES.md)

이 파일은 이 프로젝트의 모든 AI 규칙의 최상위 관리 포인트입니다.
**Antigravity를 포함한 모든 AI 에이전트는 작업을 시작하기 전 반드시 이 파일을 먼저 정독하고 컨텍스트를 동기화해야 합니다.**
(This is the master rule for all AI agents. Read this first to sync context before any action.)

---

## 🚀 프로젝트 개요 (Project Overview)
- **Name**: 방문로그 (bangmoonlog) - Apps In Toss (AIT)
- **Purpose**: Micro-app service running inside the Toss app.
- **Tech Stack**: React + AIT Framework + Firebase + TDS

## 🧠 AI 에이전트 핵심 지침 (Core Agent Instructions)

### 1. 행동 강령 (Code of Conduct)
- **Observation-First**: 모든 작업은 현재 상태 확인(`view_file`, `list_dir`)에서 시작합니다. (Start every task by observing the current state.)
- **Efficiency**: 사용자 자원 절약을 위해 정밀 수동 수정(`replace_file_content`)을 우선합니다. (Prioritize precise edits to save token credits.)
- **No Yapping**: 불필요한 설명을 배제하고 핵심 논리 중심으로 소통하십시오. (Communicate concisely, focusing on core logic.)

### 2. 세부 지침 모듈 (Context-specific Rule Modules)
상황에 맞는 아래 규칙들을 참조하여 작업을 수행하십시오. (Refer to the modules below based on the context.)

| Scope (범위) | Rule File (지침 파일) | Key Content (핵심 내용) |
| :--- | :--- | :--- |
| **AIT & React** | [.rules/react_ait_framework.md](file:///.rules/react_ait_framework.md) | Routing, Bridge API, Strict TS |
| **Firebase** | [.rules/firebase_data_flow.md](file:///.rules/firebase_data_flow.md) | v10+ Modular SDK, Data Flow |
| **Design System** | [.rules/tds_design_system.md](file:///.rules/tds_design_system.md) | @toss/tds-mobile, Color Tokens |
| **Agent Efficiency** | [.rules/agent_efficiency.md](file:///.rules/agent_efficiency.md) | Token Saving, Observation Rules |

---

## 🛠️ 작업 도구 (Tools & Commands)
- **Run Dev**: `npm run dev`
- **Build**: `npm run build`
- **Deploy**: `npm run deploy`

---

> [!TIP]
> **"Work Smart, Not Hard."** 
> 위 지침에 어긋나는 제안은 자원 낭비로 간주됩니다. 항상 최적의 경로를 제안하십시오. (Any proposal violating these rules is considered resource waste. Always suggest the optimal path.)
