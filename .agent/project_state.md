# Project State & Execution Pipeline

- **Project Name**: AutoRPA (Web Automation & RPA Orchestrator)
- **Technology Stack**:
  - Frontend: `React (Vite) + Vanilla CSS + Lucide Icons + PrismJS`
  - Backend: `Node.js / Express (ES Modules)`
  - Automation Engine: `Playwright (Headless/Headed Chromium)`
  - Database: `JSON Database (Atomic Writes)`
  - Design: `Cyberpunk Dark Theme + Glassmorphism + Modal System 2.0`
- **Current Phase**: `COMPLETE`
- **Active Persona**: `web-dev-orchestrator`
- **Last Updated**: 2026-09-18 16:25

## 🎯 Project Goals & Scope
- **Goal 1 (UX & Navigation 2.0)**: Decompose monolithic 2,979-line `App.jsx` into focused, high-performance modular components. Introduce Command Palette (⌘K), browser history URL synchronization, breadcrumbs, non-blocking toast notifications, and fluid micro-transitions.
- **Goal 2 (Data Management)**: Optimize network usage and server responsiveness with dedicated aggregate stats (`/api/system/stats`), low-overhead active run monitoring (`/api/runs/active`), and paginated/summarized logs (`/api/logs?summary=true`).
- **Goal 3 (Code Presentation & Validation)**: Rich syntax highlighting and client-side code validation (JS syntax check, JSON verification, XPath linting) across all automation steps (`eval`, `dynamic_script`, HTML inspect, JSON data).
- **Goal 4 (Modal System 2.0 & Block Editing)**:
  - Eliminated inner scroll trap conflicts and breaking elements inside modals by introducing Modal System 2.0 (`.modal-header`, `.modal-body` as single scroll container, `.modal-footer` fixed).
  - Added full inline editing capabilities for block parameters (name, defaultValue, description).
  - Added full inline editing and renaming capabilities for block secrets (AES-256 encrypted), including preserving existing credentials when renaming keys.
- **Goal 5 (Pipeline Live View & Headless/Headed Toggle)**:
  - Allow user to observe browser executions in real time via low-latency CDP screencast and MJPEG streaming (`/api/runs/:runId/stream`).
  - Added Headless vs Headed selector and Live View toggle in `TaskRunModal`.
  - Added live browser screen player in `LogDetailsModal` during active runs.
- **Goal 6 (Interactive Live Sandbox Studio)**:
  - Fullscreen 2-column testing studio (`SandboxView.jsx`).
  - Left column: Action sequencing, configuration, individual "Executar Ação" (`Play`) with real-time feedback, "Executar Todas", and "Salvar Bloco de Ação".
  - Right column: Real-time browser screencast, address bar with direct navigation, and dedicated "Resetar Navegador" button (`RotateCcw`) to reset to `about:blank`.
  - Integrated into Sidebar, Command Palette (⌘K), and BlocksView ("Testar no Sandbox").

## 📋 Phase Progress Tracker
- [x] **Phase 1: Discovery & Scope**
  - Scope defined and tech stack aligned with user requirements.
  - `.agent/` coordination directory initialized.
- [x] **Phase 2: Product Design & Design System**
  - [x] CSS tokens refined for code components, glassmorphism, and command palette.
  - [x] Layout specifications for responsive sidebar, header, and drawers.
  - [x] Modal System 2.0 layout and clean 2-column grid (`.step-col-full`).
  - [x] 2-column Live Sandbox Studio layout and screencast styles.
- [x] **Phase 3: Architecture & Contracts**
  - [x] Shared API contracts documented in `.agent/architecture_contracts.md`.
  - [x] Backend routes and DB helpers implemented (`/api/system/stats`, `/api/runs/active`, paginated logs, `secretKeyRenames` in `POST /api/blocks`).
  - [x] Live screencast endpoints (`/api/runs/:runId/stream` and `/api/sandbox/stream`).
  - [x] Sandbox session manager (`SandboxManager`) with CDP screencast, step execution, and session reset.
- [x] **Phase 4: Phased Implementation**
  - [x] Frontend context layer (`AuthContext`, `ToastContext`, `DataContext`).
  - [x] Code presentation and validation components (`CodeViewer`, `CodeEditor`, `JsonViewer`, `HtmlViewerModal`).
  - [x] Layout and navigation components (`AppLayout`, `Sidebar`, `Header`, `CommandPalette`, `ToastContainer`).
  - [x] View modules (`DashboardView`, `BlocksView`, `TasksView`, `SchedulerView`, `LogsView`, `SystemView`, `SandboxView`).
  - [x] Refactored lightweight `App.jsx`.
  - [x] `BlockEditorModal`, `TaskEditorModal`, `ScheduleEditorModal`, `TaskRunModal` refactored with Modal System 2.0.
  - [x] Inline parameter and secret editors implemented in `BlockEditorModal`.
  - [x] Live stream screencast player embedded in `LogDetailsModal`.
  - [x] Full-featured `SandboxView` with individual action runner, live browser screencast, reset button, and block persistence.
- [x] **Phase 5: Quality Gate & Code Review**
  - [x] Production build verified (`npm run build`).
  - [x] Endpoints and DB persistence tests verified.
  - [x] SandboxManager lifecycle verified (`test_sandbox.js`).
  - [x] Pipeline LiveView execution & stream cleanup verified (`test_pipeline_liveview.js`).
