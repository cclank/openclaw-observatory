# OpenClaw Observatory

[English](README.md) | 简体中文

[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/cclank/openclaw-observatory)](https://github.com/cclank/openclaw-observatory/commits/main)

OpenClaw Observatory 是一个面向 OpenClaw 的独立可观测性工具集。
它提供 Dashboard 可视化和适配机器人转发的命令摘要，覆盖请求量、Token 成本、延迟、以及 QMD/向量检索质量。

## 核心能力

- 请求监控（类 Copilot 请求视角）
  - 总请求、可计费请求、高级请求
  - 成功/失败/超时/取消拆分
  - `unknown` 来源细分（子代理、定时任务、直接 API/CLI、历史遗留、未分类）
- Token、成本与延迟监控
  - 按日趋势
  - 尾延迟（p95）
  - 模型、Provider、工具分布
  - 按模型差异化计费估算（元数据优先，定价映射回退）
  - 成本来源可解释（元数据占比 vs 估算占比）
- QMD/向量检索监控
  - `memory_search` 与向量检索调用量、错误率
  - QMD-backed 检索占比
  - 热门 query、collection、path 明细
  - `memory_get` 在 `qmd/...` 路径的使用情况
- 会话级诊断
  - 瀑布图时间线
  - 关键事件明细
  - 模型切换统计
- 双语 Dashboard
  - 支持中英文切换（zh-CN / en）
  - 首行筛选条冻结
  - 图表可交互（tooltip、缩放、点击聚焦）
- 关键文件访问监控
  - `AGENT.md`、`TOOLS.md`、`SOUL.md`、`Memory` 的每日访问趋势
  - 统计方法与置信度说明
- Telegram/Discord 命令摘要输出
  - `summary`、`quota`、`qmd`、`alerts`、`daily`、`weekly`

## 架构说明

```text
.
├─ collector.mjs      # 采集、聚合、异常、告警、命令摘要格式化
├─ server.mjs         # Dashboard 服务与 HTTP API
├─ bot-command.mjs    # 面向机器人集成的命令摘要 CLI
├─ public/            # Dashboard 前端
├─ package.json
├─ README.md
└─ README.zh-CN.md
```

## 设计原则

- 非侵入：仅读取 OpenClaw 现有状态文件
- 独立化：不修改 OpenClaw 核心运行路径
- 只读采集：本地文件系统扫描，不写入业务数据

## 零侵入保证

本项目不会修改上游 OpenClaw 的源码或运行行为。

- 不 patch OpenClaw 内部实现
- 不回写 OpenClaw 会话/状态文件
- 不注入 OpenClaw 运行时依赖路径
- 全部实现仅保留在本仓库内

它只读取本地产物做观测分析，并输出派生指标与视图。

## 运行要求

- Node.js `22+`
- OpenClaw 状态目录（默认 `~/.openclaw`）

## 快速开始

```bash
npm run start -- --port 3188
```

打开 Dashboard：

- `http://127.0.0.1:3188`

## 通过 SSH 端口转发远程访问

默认情况下服务监听在 `127.0.0.1`（仅本机回环），远程机器不能直接访问。

如果 OpenClaw Observatory 运行在远程主机，可在本地执行端口转发：

```bash
ssh -L 3188:127.0.0.1:3188 <user>@<remote-host>
```

然后在本地浏览器打开：

- `http://127.0.0.1:3188`

示例：

```bash
ssh -L 3188:127.0.0.1:3188 user@gateway-host
```

## CLI 用法

采集 JSON：

```bash
node collector.mjs --days 30 --pretty --out /tmp/openclaw-observability.json
```

输出命令摘要（纯文本）：

```bash
node collector.mjs --days 7 --command summary
node collector.mjs --days 7 --command qmd
node collector.mjs --days 7 --command alerts --max-items 10
node collector.mjs --days 7 --command weekly --lang zh
```

机器人命令入口：

```bash
node bot-command.mjs --cmd summary --days 7
```

## HTTP API

- `GET /api/health`：健康检查
- `GET /api/collect`：完整指标 JSON
- `GET /api/command`：命令摘要（JSON）
- `GET /command.txt`：命令摘要（纯文本，适合机器人直转发）

### 命令 API 示例

```text
/api/command?cmd=summary&days=7&lang=zh
```

支持的 `cmd`：

- `summary`
- `qmd`
- `alerts`
- `daily`
- `weekly`
- `help`

## Telegram / Discord 集成建议

推荐命令映射：

- `/oc summary` -> `cmd=summary`
- `/oc qmd` -> `cmd=qmd`
- `/oc alerts` -> `cmd=alerts`
- `/oc daily` -> `cmd=daily`
- `/oc weekly` -> `cmd=weekly`

示例地址：

```text
http://127.0.0.1:3188/command.txt?cmd=summary&days=7
```

## 关键参数

通用参数（`collector.mjs`、`bot-command.mjs`、API query）：

- `days`、`agent`、`channel`
- `sessionLimit`、`memoryLimit`、`timelineLimit`
- `lang`（`zh` 或 `en`，仅命令摘要输出）
- `maxItems`（命令摘要最大条目数）

## 环境变量

- `OPENCLAW_STATE_DIR`
- `OPENCLAW_WORKSPACE_DIR`
- `OPENCLAW_MODEL_PRICING_JSON`（可选，用于覆盖模型定价映射）

## 验证

```bash
npm run check
node collector.mjs --days 7 --command summary
node collector.mjs --days 7 --command qmd
node server.mjs --port 3188
```

## 许可证

MIT，见 [LICENSE](LICENSE)。

## 已知限制

- 会话解析为 best-effort，损坏行会被跳过
- 成本统计优先使用 transcript 元数据；缺失时回退到模型定价估算
- QMD/向量识别采用工具级启发式规则
- `unknown` 来源细分采用启发式规则，依赖会话元数据完整度
- 关键文件访问次数按路径访问事件统计，依赖工具调用中可见 path 字段
- 异常检测用于运维信号，不等价于严格 SLO 判定
