# OpenClaw Observatory

Standalone observability project for OpenClaw with rich dashboards, command-style summaries, and non-invasive local data collection.

## Highlights

- Request-centric observability (GitHub Copilot-style count mindset):
  - total/billable/premium requests
  - success/failure/timeout/cancelled breakdown
  - quota usage and near-limit alerts
- Token/cost/latency monitoring:
  - total and daily trends
  - p95 latency and jitter detection
  - model/provider and tool distribution
- QMD/vector retrieval monitoring:
  - `memory_search` / vector call volume
  - QMD-backed ratio, retrieval error rate
  - result count, latency, top queries/collections/paths
  - `memory_get` qmd-path usage
- Session deep inspection:
  - session-level waterfall timeline
  - recent timeline events
  - model switching details
- Bot-command output for Telegram/Discord:
  - `summary`, `quota`, `qmd`, `alerts`, `daily`
  - available via CLI and HTTP endpoint

## Design Principles

- Non-invasive: reads OpenClaw state files, does not patch OpenClaw runtime
- Standalone: all code under this repo root
- Read-only analytics: local filesystem scan only

## Project Layout

```text
.
├─ collector.mjs          # collector + aggregation + anomaly/alert rules + command formatter
├─ server.mjs             # dashboard server + APIs
├─ bot-command.mjs        # CLI command-summary entrypoint for bot usage
├─ package.json
├─ public/
│  ├─ index.html          # dashboard UI
│  ├─ app.js              # dashboard rendering + command preview
│  └─ styles.css
└─ README.md
```

## Requirements

- Node.js `22+`
- OpenClaw runtime data directory (default resolves to `~/.openclaw`)

## Quick Start

```bash
npm run start -- --port 3188
```

Open dashboard:

- `http://127.0.0.1:3188`

## Scripts

- `npm run start` - launch server
- `npm run dev` - launch server with shorter cache TTL
- `npm run collect -- ...` - run collector snapshot
- `npm run command -- ...` - output compact bot command summary
- `npm run check` - syntax checks

## Collector Usage

JSON snapshot:

```bash
node collector.mjs --days 30 --pretty --out /tmp/openclaw-observability.json
```

Command summary text:

```bash
node collector.mjs --days 7 --command summary
node collector.mjs --days 7 --command qmd
node collector.mjs --days 7 --command alerts --max-items 10
```

Dedicated bot command entry:

```bash
node bot-command.mjs --cmd summary --days 7
```

## CLI Options

Common (`collector.mjs` and `bot-command.mjs`):

- `--days <n|all>`: window, default `30`
- `--agent <id>`: filter by agent
- `--channel <name>`: filter by channel
- `--session-limit <n>`: session cap, default `250`
- `--memory-limit <n>`: memory file cap, default `100`
- `--timeline-limit <n>`: timeline/waterfall cap per session, default `240`
- `--state-dir <path>`: OpenClaw state directory
- `--workspace-dir <path>`: workspace directory
- `--request-quota <n>`: total request quota (for usage tracking/alerts)
- `--premium-quota <n>`: premium request quota
- `--premium-model-pattern <regex>`: override premium-model detection
- `--command <summary|quota|qmd|alerts|daily|help>`: output compact command text
- `--max-items <n>`: max rows in command output
- `--out <file>`: write output to file
- `--pretty`: pretty JSON (collector JSON mode)

Server (`server.mjs`):

- `--host <ip>`: bind host, default `127.0.0.1`
- `--port <n>`: bind port, default `3188`
- `--cache-ms <n>`: collection cache TTL, default `15000`
- `--state-dir <path>`
- `--workspace-dir <path>`
- `--request-quota <n>`
- `--premium-quota <n>`
- `--premium-model-pattern <regex>`

## HTTP APIs

### `GET /api/health`

Health check.

### `GET /api/collect`

Returns full dashboard JSON payload.

Query params:

- `days`, `agent`, `channel`
- `sessionLimit`, `memoryLimit`, `timelineLimit`
- `requestQuota`, `premiumQuota`, `premiumModelPattern`

### `GET /api/command`

Returns JSON command summary:

```json
{
  "ok": true,
  "command": "summary",
  "text": "..."
}
```

Query params:

- `cmd`: `summary|quota|qmd|alerts|daily|help`
- same filters/quota params as `/api/collect`
- `maxItems`

### `GET /command.txt`

Returns plain-text command output for direct bot forwarding.

## Telegram / Discord Command Integration

Use `command.txt` for a minimal integration layer.

Examples:

```text
http://127.0.0.1:3188/command.txt?cmd=summary&days=7
http://127.0.0.1:3188/command.txt?cmd=qmd&days=7&agent=main
http://127.0.0.1:3188/command.txt?cmd=quota&days=30&requestQuota=2000&premiumQuota=300
```

Recommended command mapping:

- `/oc summary` -> `cmd=summary`
- `/oc quota` -> `cmd=quota`
- `/oc qmd` -> `cmd=qmd`
- `/oc alerts` -> `cmd=alerts`
- `/oc daily` -> `cmd=daily`

## Dashboard Coverage

- KPI cards for requests/tokens/cost/latency/quota
- Daily token/cost trend
- Daily request and request-health trend
- Quota panel + vector/QMD panel
- Top models/tools + request-by-model/request-by-channel
- Session table + waterfall + timeline inspector
- Memory footprint panel
- Anomaly radar + operational alerts
- Built-in command preview (same output as bot command endpoint)

## Metric Semantics

- Request:
  - one assistant response attempt is treated as one request
  - billable requests are inferred from usage/model/provider metadata
  - premium requests are model-name heuristic based (or regex override)
- Latency:
  - prefers `durationMs`
  - fallback to `assistant_ts - previous_user_ts` when possible
- QMD/vector:
  - retrieval calls inferred from tool usage (`memory_search` and vector-like tool names)
  - QMD-backed detection from provider and `qmd/...` result paths
- Cost:
  - from transcript usage/cost metadata
  - missing cost entries are counted

## Environment Variables

- `OPENCLAW_STATE_DIR`
- `OPENCLAW_WORKSPACE_DIR`
- `OPENCLAW_REQUEST_QUOTA`
- `OPENCLAW_PREMIUM_REQUEST_QUOTA`
- `OPENCLAW_PREMIUM_MODEL_PATTERN`

## Validation

```bash
npm run check
node collector.mjs --days 7 --command summary
node collector.mjs --days 7 --command qmd
node server.mjs --port 3188
```

## Known Limits

- Transcript parsing is best-effort; malformed lines are skipped
- Metrics depend on transcript metadata completeness
- QMD/vector detection is heuristic for generic tool ecosystems
- Anomaly rules are signal-oriented heuristics, not hard SLO guarantees
