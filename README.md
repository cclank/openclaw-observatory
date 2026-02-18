# OpenClaw Observatory

English | [简体中文](README.zh-CN.md)

[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/cclank/openclaw-observatory)](https://github.com/cclank/openclaw-observatory/commits/main)

OpenClaw Observatory is a standalone observability toolkit for OpenClaw.
It provides dashboard analytics and bot-friendly command summaries for request usage, token cost, latency, and QMD/vector retrieval quality.

## Core Capabilities

- Request analytics (Copilot-style usage perspective)
  - total, billable, premium requests
  - success/failure/timeout/cancelled breakdown
  - quota tracking and near-limit alerts
  - `unknown` source breakdown (sub-agent, scheduled task, direct API/CLI, legacy, uncategorized)
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
- Bilingual dashboard UI
  - zh-CN / en language toggle
- Key-file access analytics
  - daily access counts for `AGENT.md`, `TOOLS.md`, `SOUL.md`, and `Memory`
- Chat-command output for Telegram/Discord
  - `summary`, `quota`, `qmd`, `alerts`, `daily`, `weekly`

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

## Non-Invasive Guarantee

This project does not modify upstream OpenClaw source code or runtime behavior.

- No patching of OpenClaw internals
- No write-back to OpenClaw session/state files
- No dependency injection into OpenClaw runtime paths
- All implementation remains isolated in this repository

It only reads local artifacts for observability and presents derived metrics.

## Requirements

- Node.js `22+`
- OpenClaw state directory (default: `~/.openclaw`)

## Quick Start

```bash
npm run start -- --port 3188
```

Dashboard URL:

- `http://127.0.0.1:3188`

## Remote Access via SSH Port Forwarding

By default, the server binds to loopback (`127.0.0.1`), so it is not directly reachable from remote machines.

If OpenClaw Observatory runs on a remote host, forward the port locally:

```bash
ssh -L 3188:127.0.0.1:3188 <user>@<remote-host>
```

Then open locally:

- `http://127.0.0.1:3188`

Example:

```bash
ssh -L 3188:127.0.0.1:3188 user@gateway-host
```

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
node collector.mjs --days 7 --command weekly --lang zh
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
- `weekly`
- `help`

## Telegram / Discord Integration Pattern

Recommended mapping:

- `/oc summary` -> `cmd=summary`
- `/oc quota` -> `cmd=quota`
- `/oc qmd` -> `cmd=qmd`
- `/oc alerts` -> `cmd=alerts`
- `/oc daily` -> `cmd=daily`
- `/oc weekly` -> `cmd=weekly`

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
- `lang` (`zh` or `en`, command output only)
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

## License

MIT. See [LICENSE](LICENSE).

## Limitations

- Transcript parsing is best-effort; malformed lines are skipped
- Cost quality depends on transcript metadata completeness
- QMD/vector detection uses tool-level heuristics across generic ecosystems
- `unknown` source breakdown is heuristic and depends on session metadata completeness
- Anomaly rules are operational signals, not strict SLO guarantees
