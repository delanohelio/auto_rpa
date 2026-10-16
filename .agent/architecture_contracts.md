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

## 3. Database Models & Persistence Engine (SQLite WAL)

Engine: `better-sqlite3` embedded with `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;`.
File: `backend/data/database.sqlite`.

### Table Schemas
- `blocks`: `id TEXT PRIMARY KEY, name TEXT, description TEXT, category TEXT, steps TEXT, parameters TEXT, secrets TEXT, updated_at TEXT`
- `tasks`: `id TEXT PRIMARY KEY, name TEXT, description TEXT, blocks TEXT, execution_variables TEXT, anti_detection INTEGER, updated_at TEXT`
- `schedules`: `id TEXT PRIMARY KEY, task_id TEXT, cron_expression TEXT, enabled INTEGER, last_run TEXT, next_run TEXT, updated_at TEXT`
- `logs`: `id TEXT PRIMARY KEY, task_id TEXT, task_name TEXT, trigger TEXT, schedule_id TEXT, status TEXT, started_at TEXT, ended_at TEXT, duration REAL, current_block_id TEXT, current_block_name TEXT, current_step_index INTEGER, error TEXT, steps_executed TEXT, screenshot_path TEXT, headless INTEGER, live_view INTEGER, execution_vars TEXT, created_at TEXT`
- `settings`: `key TEXT PRIMARY KEY, value TEXT`

## 4. Variable Types & Execution Variables Contract

```typescript
type VariableType = 'text' | 'number' | 'date' | 'datetime' | 'select' | 'multiselect';

interface VariableDefinition {
  name: string;
  type: VariableType; // Default 'text'
  defaultValue: any; // 'now' for date/datetime defaults to current Brazilian timestamp
  description?: string;
  options?: string[]; // Defined via line-separated textarea for select and multiselect
}
```

### JS Eval Execution Contract
User writes only the body of the function. The engine wraps and evaluates with:
```javascript
(async ({ vars, executionVars, params, secrets, setVar, getVar }) => {
  // USER BODY
})
```
Updates made to `vars` or `executionVars` are automatically reflected back into the pipeline's execution state.

