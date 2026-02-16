# OpenClaw Observatory

OpenClaw Observatory is a standalone observability project for OpenClaw.
It reads local runtime artifacts and renders a rich dashboard for:

- token consumption and cost
- response latency and tail behavior
- model and tool usage mix
- session-level waterfall timeline
- memory footprint and memory file details
- anomaly detection (token spike, latency jitter, model switching)

## Design Goals

- Non-invasive: no patching of OpenClaw runtime code paths
- Portable: fully contained under `tools/openclaw-observatory`
- Fast iteration: plain Node.js ESM scripts, no framework lock-in
- Read-only data collection from local state directories

## Project Layout

```text
tools/openclaw-observatory/
├─ collector.mjs         # data collector + aggregation + anomaly rules
├─ server.mjs            # lightweight HTTP server and /api/collect endpoint
├─ package.json          # standalone scripts for this project
├─ public/
│  ├─ index.html         # dashboard shell
│  ├─ app.js             # dashboard rendering logic
│  └─ styles.css         # visual theme and responsive layout
└─ README.md
```

## Requirements

- Node.js `22+`
- Local OpenClaw runtime artifacts, usually:
  - `~/.openclaw/agents/*/sessions/*.jsonl`
  - `~/.openclaw/agents/*/sessions/sessions.json`
  - `~/.openclaw/workspace/memory/**/*.md` (or custom workspace dir)

## Quick Start

From repository root:

```bash
node tools/openclaw-observatory/server.mjs --port 3188
```

Open:

- `http://127.0.0.1:3188`

Or run via local project scripts:

```bash
cd tools/openclaw-observatory
npm run start -- --port 3188
```

## Run Collector Only (JSON Snapshot)

```bash
node tools/openclaw-observatory/collector.mjs \
  --days 30 \
  --pretty \
  --out /tmp/openclaw-observability.json
```

## CLI Options

Collector (`collector.mjs`):

- `--days <n|all>`: time window, default `30`
- `--agent <id>`: filter by agent ID
- `--channel <name>`: filter by channel/provider
- `--session-limit <n>`: max sessions returned, default `250`
- `--memory-limit <n>`: max memory files returned, default `100`
- `--timeline-limit <n>`: max timeline/waterfall events per session, default `240`
- `--state-dir <path>`: OpenClaw state dir
- `--workspace-dir <path>`: workspace dir for memory scanning
- `--out <file>`: write JSON output to file
- `--pretty`: pretty-print JSON

Server (`server.mjs`):

- `--host <ip>`: bind host, default `127.0.0.1`
- `--port <n>`: bind port, default `3188`
- `--cache-ms <n>`: cache TTL for collection payload, default `15000`
- `--state-dir <path>`: fixed state dir
- `--workspace-dir <path>`: fixed workspace dir

## Dashboard Features

- KPI cards: sessions/tokens/cost/error-rate/cache-share
- Daily trends: token and cost evolution
- Latency panel: average and p95 response time
- Distribution panels: top models and top tools
- Session table + inspector:
  - per-session summary
  - waterfall spans (user to assistant latency bars)
  - recent timeline events (tools, errors, usage snippets)
- Memory panels:
  - total files/bytes/recency
  - keyword hotspots
  - latest memory file list
- Anomaly radar:
  - token spike vs rolling baseline
  - latency jitter (coefficient of variation + p95/avg tail ratio)
  - model switching sessions
- Operational alert list:
  - high token volume
  - error rate and latency warnings
  - anomaly-derived alerts

## API

### Health

- `GET /api/health`

Example response:

```json
{ "ok": true, "now": 1739726400000 }
```

### Metrics Collection

- `GET /api/collect`

Query parameters:

- `days` (`1`, `7`, `30`, `90`, `all`)
- `agent` (optional)
- `channel` (optional)
- `sessionLimit` (optional)
- `memoryLimit` (optional)
- `timelineLimit` (optional)

Example:

```text
/api/collect?days=30&sessionLimit=250&memoryLimit=100&timelineLimit=240
```

Response shape (high-level):

```json
{
  "ok": true,
  "data": {
    "generatedAt": 0,
    "stateDir": "",
    "workspaceDir": "",
    "range": { "days": 30, "startIso": "", "endIso": "" },
    "filters": { "selected": {}, "options": {} },
    "summary": {},
    "totals": {},
    "messages": {},
    "latency": {},
    "aggregates": {},
    "sessions": [],
    "memory": {},
    "anomalies": {},
    "alerts": []
  }
}
```

## Metric Semantics

- Token fields:
  - `input`, `output`, `cacheRead`, `cacheWrite`, `totalTokens`
- Cost fields:
  - `totalCost`, plus optional cost breakdown fields when available
  - if transcript cost is unavailable, collector increments `missingCostEntries`
- Latency:
  - uses explicit `durationMs` when present
  - fallback: `assistant_timestamp - previous_user_timestamp`
- Error classification:
  - from stop reasons (`error`, `aborted`, `cancelled`, `timeout`) and tool result flags

## Environment Variables

When CLI args are not provided:

- `OPENCLAW_STATE_DIR`
- `OPENCLAW_WORKSPACE_DIR`

Defaults:

- `stateDir`: `~/.openclaw`
- `workspaceDir`: `<stateDir>/workspace`

## Troubleshooting

- Empty dashboard data:
  - verify OpenClaw state exists under the selected `stateDir`
  - verify session files are `*.jsonl`
- Memory panels empty:
  - verify `workspace/memory` exists
  - pass `--workspace-dir` explicitly
- Slow initial refresh:
  - expected for large state trees; increase `--cache-ms`
- Port conflict:
  - run server with a different `--port`

## Security and Privacy Notes

- Collector reads local files only and does not transmit data externally.
- Dashboard serves local HTTP on configured host/port.
- Avoid exposing the server on public interfaces unless intentionally secured.

## Development

```bash
cd tools/openclaw-observatory
npm run check
npm run collect -- --days 7 --pretty
npm run start -- --port 3188
```

## Known Limits

- Session parsing is best-effort: malformed files are skipped.
- Cost analytics depend on provider usage metadata completeness.
- Anomaly rules are heuristics and should be interpreted as guidance.
