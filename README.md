# OpenClaw Observatory

English | [简体中文](README.zh-CN.md)

OpenClaw Observatory is a standalone observability toolkit for OpenClaw.
It provides dashboard analytics and bot-friendly command summaries for request usage, token cost, latency, and QMD/vector retrieval quality.

## Core Capabilities

- Request analytics (Copilot-style usage perspective)
  - total, billable, premium requests
  - success/failure/timeout/cancelled breakdown
  - quota tracking and near-limit alerts
- Token, cost, and latency observability
  - daily trends and tail latency (p95)
  - model/provider and tool distributions
- QMD/vector retrieval observability
  - `memory_search` and vector call volume/error rate
  - QMD-backed retrieval ratio
  - top queries, collections, and paths
  - `memory_get` usage over `qmd/...` paths
- Session diagnostics
  - per-session waterfall timeline
  - timeline events and model switching details
- Chat-command output for Telegram/Discord
  - `summary`, `quota`, `qmd`, `alerts`, `daily`

## Architecture

```text
.
├─ collector.mjs      # collection, aggregation, anomalies, alerting, command formatter
├─ server.mjs         # dashboard server and HTTP APIs
├─ bot-command.mjs    # command summary CLI for bot integrations
├─ public/            # dashboard frontend
├─ package.json
├─ README.md
└─ README.zh-CN.md
```

## Design Principles

- Non-invasive: reads existing OpenClaw state files only
- Standalone: no runtime patching in OpenClaw core
- Read-only collection: local filesystem scan only

## Requirements

- Node.js `22+`
- OpenClaw state directory (default: `~/.openclaw`)

## Quick Start

```bash
npm run start -- --port 3188
```

Dashboard URL:

- `http://127.0.0.1:3188`

## CLI Usage

Run collector (JSON):

```bash
node collector.mjs --days 30 --pretty --out /tmp/openclaw-observability.json
```

Run command summary (text):

```bash
node collector.mjs --days 7 --command summary
node collector.mjs --days 7 --command qmd
node collector.mjs --days 7 --command alerts --max-items 10
```

Bot-oriented command entry:

```bash
node bot-command.mjs --cmd summary --days 7
```

## HTTP APIs

- `GET /api/health`: health check
- `GET /api/collect`: full dashboard payload
- `GET /api/command`: JSON command summary
- `GET /command.txt`: plain-text command summary (bot relay friendly)

### Command API Example

```text
/api/command?cmd=summary&days=7&requestQuota=2000&premiumQuota=300
```

Supported `cmd` values:

- `summary`
- `quota`
- `qmd`
- `alerts`
- `daily`
- `help`

## Telegram / Discord Integration Pattern

Recommended mapping:

- `/oc summary` -> `cmd=summary`
- `/oc quota` -> `cmd=quota`
- `/oc qmd` -> `cmd=qmd`
- `/oc alerts` -> `cmd=alerts`
- `/oc daily` -> `cmd=daily`

Example endpoint:

```text
http://127.0.0.1:3188/command.txt?cmd=summary&days=7
```

## Key Options

Common options (`collector.mjs`, `bot-command.mjs`, and API query):

- `days`, `agent`, `channel`
- `sessionLimit`, `memoryLimit`, `timelineLimit`
- `requestQuota`, `premiumQuota`
- `premiumModelPattern`
- `maxItems` (command output)

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

## Limitations

- Transcript parsing is best-effort; malformed lines are skipped
- Cost quality depends on transcript metadata completeness
- QMD/vector detection uses tool-level heuristics across generic ecosystems
- Anomaly rules are operational signals, not strict SLO guarantees
