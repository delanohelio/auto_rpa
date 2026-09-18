# Architecture Contracts & Shared Specifications

## 1. Design Tokens & Syntax Theming
- **Theme**: Cyberpunk Dark Theme (Tailored HSL / OKLCH)
- **Primary Glow**: `hsl(250, 85%, 65%)` / `hsl(250, 85%, 72%)`
- **Secondary Cyan**: `hsl(195, 90%, 55%)`
- **Surface**: `hsl(224, 25%, 6%)` (app), `hsl(224, 28%, 9%)` (sidebar), `hsla(224, 25%, 11%, 0.7)` (card)
- **Code Tokens**:
  - Background: `hsl(224, 30%, 8%)`
  - Border: `hsla(220, 20%, 25%, 0.6)`
  - Keyword / Builtin: `hsl(280, 85%, 70%)`
  - Function: `hsl(195, 90%, 65%)`
  - String: `hsl(145, 75%, 60%)`
  - Number / Boolean: `hsl(38, 92%, 60%)`
  - Comment: `hsl(215, 15%, 50%)`
  - Operator / Punctuation: `hsl(210, 30%, 80%)`

## 2. Shared API Contracts

### GET `/api/system/stats`
Returns aggregated system health and execution metrics.
```typescript
interface SystemStatsResponse {
  totalRuns: number;
  successCount: number;
  failureCount: number;
  runningCount: number;
  successRate: number; // 0 to 100 percentage
  totalTasks: number;
  totalBlocks: number;
  activeSchedules: number;
  averageDurationSeconds: number;
}
```

### GET `/api/runs/active`
Lightweight polling endpoint for active pipeline runs and sessions.
```typescript
interface ActiveRunItem {
  runId: string;
  taskId: string;
  taskName: string;
  status: 'running';
  startedAt: string;
  stepIndex: number;
  waitingForPrompt: boolean;
  waitingForAgent: boolean;
  promptTitle?: string;
}

type ActiveRunsResponse = ActiveRunItem[];
```

### GET `/api/logs`
Filterable and paginated logs list.
```typescript
// Query params: ?page=1&limit=20&status=success|failure|running&trigger=manual|schedule&search=name&summary=true
interface PaginatedLogsResponse {
  logs: Array<{
    id: string;
    taskId: string;
    taskName: string;
    status: 'success' | 'failure' | 'running';
    startedAt: string;
    endedAt: string | null;
    duration: number;
    trigger: 'manual' | 'schedule';
    scheduleId?: string;
    error?: string;
    screenshotPath?: string;
    stepsExecutedCount?: number;
    // stepsExecuted included ONLY if summary !== true
    stepsExecuted?: Array<any>;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### GET `/api/logs/:id`
Deep execution report containing complete steps execution trace and extracted data.
