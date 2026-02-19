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
  - `unknown` source breakdown (sub-agent, scheduled task, direct API/CLI, gateway unlabeled, metadata partial/missing, legacy)
- Token, cost, and latency observability
  - daily trends and tail latency (p95)
  - model/provider and tool distributions
  - model-aware cost estimation (metadata-first, pricing fallback)
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
  - sticky top filter bar
  - interactive charts (tooltip, zoom, drag/inspect)
- Key-file access analytics
  - daily access counts for `AGENT.md`, `TOOLS.md`, `SOUL.md`, and `Memory`
  - method and confidence explanation panel
- Chat-command output for Telegram/Discord
  - `summary`, `qmd`, `alerts`, `daily`, `weekly`

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
- `GET /api/memory-file`: fetch full content for a memory file
- `GET /command.txt`: plain-text command summary (bot relay friendly)

### Command API Example

```text
/api/command?cmd=summary&days=7&lang=zh
```

Supported `cmd` values:

- `summary`
- `qmd`
- `alerts`
- `daily`
- `weekly`
- `help`

## Telegram / Discord Integration Pattern

Recommended mapping:

- `/oc summary` -> `cmd=summary`
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
- `lang` (`zh` or `en`, command output only)
- `maxItems` (command output)

## Environment Variables

- `OPENCLAW_STATE_DIR`
- `OPENCLAW_WORKSPACE_DIR`
- `OPENCLAW_MODEL_PRICING_JSON` (optional JSON override for model pricing map)

## Cost Accounting and Model Pricing Map

Current pricing profile version:

- `v2-openrouter-snapshot-2026-02-19`

Pricing source:

- OpenRouter model pricing snapshot from `2026-02-19` (`/api/v1/models`)

Accounting priority (collector runtime):

1. Use transcript metadata cost first (`usage.cost.total`, with input/output/cache breakdown if present).
2. Fallback to raw total fields (`costTotal` / `cost.total` variants).
3. If still missing, estimate by model profile and token usage.
4. If model is not matchable, keep as `missingCostEntries` (no forced guess).

Estimation formula:

- `estimated_total = input_tokens/1e6 * input_per_million + output_tokens/1e6 * output_per_million + cache_read_tokens/1e6 * cache_read_per_million + cache_write_tokens/1e6 * cache_write_per_million`

Default pricing profiles (USD per 1M tokens):

- `anthropic-sonnet-4.5-4.6`: input `3`, output `15`, cache read `0.3`, cache write `3.75`
- `anthropic-opus-4.5-4.6`: input `5`, output `25`, cache read `0.5`, cache write `6.25`
- `openai-gpt-5.2-series`: input `1.75`, output `14`, cache read `0.175`
- `openai-gpt-5.2-pro`: input `21`, output `168`
- `openai-gpt-5.3-codex`: input `1.75`, output `14`, cache read `0.175`
- `openai-gpt-5-default`: input `1.25`, output `10`, cache read `0.125`
- `google-gemini-3-pro`: input `2`, output `12`, cache read `0.2`, cache write `0.375`
- `google-gemini-3-flash`: input `0.5`, output `3`, cache read `0.05`, cache write `0.0833333333`
- `zai-glm-5`: input `0.3`, output `2.55`
- `moonshot-kimi-k2.5`: input `0.23`, output `3`
- `minimax-m2.5`: input `0.3`, output `1.1`, cache read `0.15`
- `minimax-m2.1`: input `0.27`, output `0.95`, cache read `0.03`
- `qwen3-max`: input `1.2`, output `6`, cache read `0.24`
- `qwen3.5-plus`: input `0.4`, output `2.4`
- `qwen3.5-397b`: input `0.15`, output `1`, cache read `0.15`
- `deepseek-chat`: input `0.32`, output `0.89`
- `deepseek-reasoner`: input `0.7`, output `2.5`
- `debug-local`: input/output/cache `0`

Provider aliases covered by regex mapping:

- `aigocode_*`, `anthropic/*`, `openrouter/anthropic/*`, `zenmux/anthropic/*`, `google-antigravity/claude-*`
- `openai-codex/*`, `aigocode_openai/*`, `zenmux/openai/*`
- `google/*`, `opencode/gemini-*`, `google-antigravity/gemini-*`, `openrouter/google/*`
- `aliyun-bailian/*`, `streamlake/*`, `minimax-portal/*`, `openrouter/qwen/*`, `deepseek/*`

Special handling:

- `openrouter/auto` is intentionally not force-estimated because the routed backend model is unknown.
- You can always override the entire catalog via `OPENCLAW_MODEL_PRICING_JSON`.

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
- Cost quality depends on transcript metadata completeness; missing entries use model-pricing fallback
- QMD/vector detection uses tool-level heuristics across generic ecosystems
- `unknown` source breakdown is heuristic and depends on session metadata completeness
- Key-file access counts are path-event based and depend on available tool path fields
- Anomaly rules are operational signals, not strict SLO guarantees
