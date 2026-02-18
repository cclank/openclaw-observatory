#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
const STOP_REASON_ERRORS = new Set(["error", "aborted", "cancelled", "timeout"]);
const STOP_REASON_TIMEOUTS = new Set(["timeout"]);
const STOP_REASON_CANCELLED = new Set(["aborted", "cancelled"]);
const WORD_BLACKLIST = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "your",
  "about",
  "session",
  "memory",
  "agent",
  "openclaw",
  "file",
  "note",
  "notes",
]);
const PREMIUM_MODEL_HINTS = [
  "gpt-5",
  "gpt-4.1",
  "o1",
  "o3",
  "claude-3.7",
  "claude-3-7",
  "claude-sonnet-4",
  "claude-opus",
  "gemini-2.5",
  "grok-3",
  "deepseek-r1",
  "qwen-max",
  "sonnet-4",
  "opus",
  "70b",
  "405b",
];
const TOOL_CALL_TYPES = new Set([
  "tool_use",
  "toolcall",
  "tool_call",
  "tooluse",
  "tool-use",
  "function_call",
  "functioncall",
  "function-call",
]);
const TOOL_RESULT_TYPES = new Set([
  "tool_result",
  "tool_result_error",
  "toolresult",
  "tool-result",
  "function_result",
  "functionresult",
  "function-result",
]);
const VECTOR_TOOL_HINTS = ["memory_search", "qmd", "vector", "semantic", "embedding"];
const MODEL_PRICING_VERSION = "v1-default-estimate";
const DEFAULT_MODEL_PRICING = [
  {
    id: "openai-gpt5",
    patterns: [/gpt-5/i],
    inputPerMillion: 1.25,
    outputPerMillion: 10,
    cacheReadPerMillion: 0.125,
    cacheWritePerMillion: 1.25,
  },
  {
    id: "openai-gpt41",
    patterns: [/gpt-4\.1/i],
    inputPerMillion: 2,
    outputPerMillion: 8,
    cacheReadPerMillion: 0.2,
    cacheWritePerMillion: 2,
  },
  {
    id: "openai-reasoning",
    patterns: [/\bo1\b/i, /\bo3\b/i],
    inputPerMillion: 15,
    outputPerMillion: 60,
    cacheReadPerMillion: 1.5,
    cacheWritePerMillion: 15,
  },
  {
    id: "anthropic-sonnet",
    patterns: [/claude[-_.\s]?sonnet|sonnet[-_.\s]?4/i],
    inputPerMillion: 3,
    outputPerMillion: 15,
    cacheReadPerMillion: 0.3,
    cacheWritePerMillion: 3,
  },
  {
    id: "anthropic-opus",
    patterns: [/claude[-_.\s]?opus|opus[-_.\s]?4/i],
    inputPerMillion: 15,
    outputPerMillion: 75,
    cacheReadPerMillion: 1.5,
    cacheWritePerMillion: 15,
  },
  {
    id: "google-gemini",
    patterns: [/gemini[-_.\s]?2\.5|gemini[-_.\s]?pro/i],
    inputPerMillion: 3.5,
    outputPerMillion: 10.5,
    cacheReadPerMillion: 0.35,
    cacheWritePerMillion: 3.5,
  },
  {
    id: "deepseek-r1",
    patterns: [/deepseek[-_.\s]?r1/i],
    inputPerMillion: 0.55,
    outputPerMillion: 2.19,
    cacheReadPerMillion: 0.055,
    cacheWritePerMillion: 0.55,
  },
  {
    id: "qwen-max",
    patterns: [/qwen[-_.\s]?max/i],
    inputPerMillion: 1.6,
    outputPerMillion: 6.4,
    cacheReadPerMillion: 0.16,
    cacheWritePerMillion: 1.6,
  },
];
const KEY_FILE_DEFINITIONS = [
  {
    key: "agentMd",
    label: "AGENT.md",
    patterns: [/agent\.md/gi],
  },
  {
    key: "toolsMd",
    label: "TOOLS.md",
    patterns: [/tools\.md/gi],
  },
  {
    key: "soulMd",
    label: "SOUL.md",
    patterns: [/soul\.md/gi],
  },
  {
    key: "memory",
    label: "Memory",
    patterns: [/(?:^|[\\/\s'"])memory[\\/][^\s'"]+/gi, /\bmemory\.(?:md|mdx|txt)\b/gi],
  },
];
const UNKNOWN_SOURCE_LABELS = {
  sub_agent: { en: "Sub-agent Chain", zh: "子代理链路" },
  scheduled_task: { en: "Scheduled Task", zh: "定时任务" },
  direct_api_cli: { en: "Direct API/CLI", zh: "直接 API/CLI 调用" },
  legacy_or_migrated: { en: "Legacy/Migrated", zh: "历史遗留/迁移会话" },
  uncategorized: { en: "Uncategorized", zh: "未分类" },
};
const SUB_AGENT_HINTS = [
  "sessions_spawn",
  "session_spawn",
  "spawn_agent",
  "subagent",
  "sub-agent",
  "child session",
];
const SCHEDULE_HINTS = [
  "cron",
  "scheduled",
  "schedule",
  "timer",
  "periodic",
  "daily report",
  "weekly report",
  "digest",
  "auto run",
  "automation",
];
const DIRECT_HINTS = [
  "cli",
  "terminal",
  "shell",
  "command line",
  "api",
  "webhook",
  "http",
  "rpc",
  "sdk",
];
const LEGACY_DAYS_THRESHOLD = 90;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function toPerMillionPrice(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return n;
}

function parsePricingOverrideEntry(entryRaw) {
  const entry = asRecord(entryRaw);
  if (!entry) {
    return null;
  }
  const patterns = [];
  if (typeof entry.pattern === "string" && entry.pattern.trim()) {
    patterns.push(new RegExp(entry.pattern, "i"));
  }
  if (Array.isArray(entry.patterns)) {
    for (const patternValue of entry.patterns) {
      if (typeof patternValue === "string" && patternValue.trim()) {
        patterns.push(new RegExp(patternValue, "i"));
      }
    }
  }
  if (!patterns.length) {
    return null;
  }
  return {
    id: typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : "custom",
    patterns,
    inputPerMillion: toPerMillionPrice(entry.inputPerMillion, 0),
    outputPerMillion: toPerMillionPrice(entry.outputPerMillion, 0),
    cacheReadPerMillion: toPerMillionPrice(entry.cacheReadPerMillion, 0),
    cacheWritePerMillion: toPerMillionPrice(entry.cacheWritePerMillion, 0),
  };
}

function loadPricingCatalog() {
  const raw = process.env.OPENCLAW_MODEL_PRICING_JSON;
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return DEFAULT_MODEL_PRICING;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_MODEL_PRICING;
    }
    const overrides = parsed.map(parsePricingOverrideEntry).filter(Boolean);
    return overrides.length ? overrides : DEFAULT_MODEL_PRICING;
  } catch {
    return DEFAULT_MODEL_PRICING;
  }
}

const MODEL_PRICING_CATALOG = loadPricingCatalog();

function resolveModelPricing(provider, model) {
  const key = `${provider ?? ""} ${model ?? ""}`.toLowerCase().trim();
  if (!key) {
    return null;
  }
  for (const profile of MODEL_PRICING_CATALOG) {
    if (profile.patterns.some((pattern) => pattern.test(key))) {
      return profile;
    }
  }
  return null;
}

function estimateCostFromUsage({ usage, provider, model }) {
  const pricing = resolveModelPricing(provider, model);
  if (!usage || !pricing) {
    return null;
  }
  const input = ((usage.input ?? 0) / 1_000_000) * pricing.inputPerMillion;
  const output = ((usage.output ?? 0) / 1_000_000) * pricing.outputPerMillion;
  const cacheRead = ((usage.cacheRead ?? 0) / 1_000_000) * pricing.cacheReadPerMillion;
  const cacheWrite = ((usage.cacheWrite ?? 0) / 1_000_000) * pricing.cacheWritePerMillion;
  const total = input + output + cacheRead + cacheWrite;
  if (!Number.isFinite(total) || total < 0) {
    return null;
  }
  return {
    source: "estimated",
    pricingId: pricing.id,
    total,
    input,
    output,
    cacheRead,
    cacheWrite,
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function includesAnyHint(text, hints) {
  if (!text) {
    return false;
  }
  return hints.some((hint) => text.includes(hint));
}

function hasSubAgentToolUsage(toolUsage) {
  const tools = Array.isArray(toolUsage?.tools) ? toolUsage.tools : [];
  for (const row of tools) {
    const name = normalizeText(row?.name);
    if (includesAnyHint(name, SUB_AGENT_HINTS)) {
      return true;
    }
  }
  return false;
}

function guessUnknownSourceType(session) {
  const now = Date.now();
  const updatedAt = typeof session?.updatedAt === "number" ? session.updatedAt : null;
  const chatType = normalizeText(session?.chatType);
  const trigger = normalizeText(session?.trigger);
  const mode = normalizeText(session?.mode);
  const originProvider = normalizeText(session?.origin?.provider);
  const originSource = normalizeText(session?.origin?.source);
  const originType = normalizeText(session?.origin?.type);
  const text = [chatType, trigger, mode, originProvider, originSource, originType]
    .filter(Boolean)
    .join(" ");

  const hasParent =
    (typeof session?.parentSessionId === "string" && session.parentSessionId.trim()) ||
    (typeof session?.origin?.parentSessionId === "string" && session.origin.parentSessionId.trim());
  if (hasParent || includesAnyHint(text, SUB_AGENT_HINTS) || hasSubAgentToolUsage(session?.toolUsage)) {
    return "sub_agent";
  }
  if (includesAnyHint(text, SCHEDULE_HINTS)) {
    return "scheduled_task";
  }
  if (includesAnyHint(text, DIRECT_HINTS)) {
    return "direct_api_cli";
  }
  if (updatedAt && now - updatedAt > LEGACY_DAYS_THRESHOLD * DAY_MS) {
    return "legacy_or_migrated";
  }
  return "uncategorized";
}

function createUnknownBreakdownRow(type) {
  const labels = UNKNOWN_SOURCE_LABELS[type] ?? UNKNOWN_SOURCE_LABELS.uncategorized;
  return {
    type,
    label: labels.en,
    labelZh: labels.zh,
    sessions: 0,
    total: 0,
    billable: 0,
    premium: 0,
    failed: 0,
  };
}

function toFinite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function emptyKeyFileCounts() {
  const counts = {};
  for (const item of KEY_FILE_DEFINITIONS) {
    counts[item.key] = 0;
  }
  return counts;
}

function mergeKeyFileCounts(target, source) {
  for (const item of KEY_FILE_DEFINITIONS) {
    const key = item.key;
    target[key] = (target[key] ?? 0) + (source?.[key] ?? 0);
  }
}

function countMatches(text, pattern) {
  const matches = text.match(pattern);
  return Array.isArray(matches) ? matches.length : 0;
}

function collectKeyFileHits(text) {
  const counts = emptyKeyFileCounts();
  if (typeof text !== "string" || !text) {
    return counts;
  }
  for (const item of KEY_FILE_DEFINITIONS) {
    const matched = item.patterns.some((pattern) => countMatches(text, pattern) > 0);
    if (matched) {
      counts[item.key] += 1;
    }
  }
  return counts;
}

function hasKeyFileHits(counts) {
  return KEY_FILE_DEFINITIONS.some((item) => (counts[item.key] ?? 0) > 0);
}

function addKeyFileHitsToDailyMap(dailyMap, dayKey, counts) {
  if (!dayKey) {
    return;
  }
  const current = dailyMap.get(dayKey) ?? emptyKeyFileCounts();
  mergeKeyFileCounts(current, counts);
  dailyMap.set(dayKey, current);
}

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value;
}

function parseTimestampMs(entry, message) {
  if (typeof entry?.timestamp === "string") {
    const ts = Date.parse(entry.timestamp);
    if (!Number.isNaN(ts)) {
      return ts;
    }
  }
  const msgTs = toFinite(message?.timestamp);
  if (msgTs !== undefined) {
    return msgTs;
  }
  return undefined;
}

function dayKeyFromMs(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeUsage(raw) {
  const record = asRecord(raw);
  if (!record) {
    return undefined;
  }

  const input =
    toFinite(record.input) ??
    toFinite(record.inputTokens) ??
    toFinite(record.prompt_tokens) ??
    toFinite(record.promptTokens) ??
    0;
  const output =
    toFinite(record.output) ??
    toFinite(record.outputTokens) ??
    toFinite(record.completion_tokens) ??
    toFinite(record.completionTokens) ??
    0;
  const cacheRead =
    toFinite(record.cacheRead) ??
    toFinite(record.cache_read_input_tokens) ??
    toFinite(record.cacheReadInputTokens) ??
    0;
  const cacheWrite =
    toFinite(record.cacheWrite) ??
    toFinite(record.cache_creation_input_tokens) ??
    toFinite(record.cacheWriteInputTokens) ??
    0;

  const total =
    toFinite(record.total) ??
    toFinite(record.totalTokens) ??
    toFinite(record.total_tokens) ??
    input + output + cacheRead + cacheWrite;

  if (total <= 0 && input <= 0 && output <= 0 && cacheRead <= 0 && cacheWrite <= 0) {
    return undefined;
  }

  return {
    input: Math.max(0, input),
    output: Math.max(0, output),
    cacheRead: Math.max(0, cacheRead),
    cacheWrite: Math.max(0, cacheWrite),
    total: Math.max(0, total),
  };
}

function extractCostBreakdown(usageRaw) {
  const usage = asRecord(usageRaw);
  const cost = asRecord(usage?.cost);
  if (!cost) {
    return undefined;
  }
  const total = toFinite(cost.total);
  if (total === undefined || total < 0) {
    return undefined;
  }
  return {
    total,
    input: toFinite(cost.input),
    output: toFinite(cost.output),
    cacheRead: toFinite(cost.cacheRead),
    cacheWrite: toFinite(cost.cacheWrite),
  };
}

function extractToolNameFromRecord(value) {
  const row = asRecord(value);
  if (!row) {
    return "";
  }
  return (
    (typeof row.name === "string" && row.name.trim()) ||
    (typeof row.toolName === "string" && row.toolName.trim()) ||
    (typeof row.function === "string" && row.function.trim()) ||
    (typeof row.tool === "string" && row.tool.trim()) ||
    ""
  );
}

function collectToolNamesFromList(list, names) {
  if (!Array.isArray(list)) {
    return;
  }
  for (const value of list) {
    const name = extractToolNameFromRecord(value);
    if (name) {
      names.push(name);
    }
  }
}

function extractToolDetails(message, record) {
  const names = [];
  let results = 0;
  let errors = 0;

  const content = message?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      const block = asRecord(part);
      if (!block) {
        continue;
      }
      const type = normalizeType(block.type);
      if (TOOL_CALL_TYPES.has(type)) {
        const name = typeof block.name === "string" ? block.name.trim() : "";
        if (name) {
          names.push(name);
        }
      }
      if (TOOL_RESULT_TYPES.has(type)) {
        results += 1;
        if (block.is_error === true) {
          errors += 1;
        }
      }
    }
  }

  collectToolNamesFromList(message?.toolCalls, names);
  collectToolNamesFromList(message?.tools, names);
  collectToolNamesFromList(record?.toolCalls, names);
  collectToolNamesFromList(record?.tools, names);

  if (message?.role === "tool") {
    const name =
      typeof message.toolName === "string"
        ? message.toolName
        : typeof message.name === "string"
          ? message.name
          : "tool";
    names.push(name);
  }
  if (message?.role === "toolResult") {
    results += 1;
  }

  return { names, results, errors };
}

function normalizeType(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_")
    : "";
}

function normalizeToolName(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isVectorSearchToolName(name) {
  const lower = normalizeToolName(name);
  if (!lower) {
    return false;
  }
  return VECTOR_TOOL_HINTS.some((hint) => lower.includes(hint));
}

function isMemorySearchToolName(name) {
  const lower = normalizeToolName(name);
  return lower === "memory_search" || lower.endsWith(".memory_search");
}

function isMemoryGetToolName(name) {
  const lower = normalizeToolName(name);
  return lower === "memory_get" || lower.endsWith(".memory_get");
}

function extractResultBlockText(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (!Array.isArray(value)) {
    return "";
  }
  const chunks = [];
  for (const part of value) {
    if (typeof part === "string") {
      if (part.trim()) {
        chunks.push(part.trim());
      }
      continue;
    }
    const block = asRecord(part);
    if (!block) {
      continue;
    }
    if (typeof block.text === "string" && block.text.trim()) {
      chunks.push(block.text.trim());
    }
  }
  return chunks.join("\n").trim();
}

function extractToolBlocks(message, record) {
  const uses = [];
  const results = [];
  const content = Array.isArray(message?.content) ? message.content : [];

  for (const part of content) {
    const block = asRecord(part);
    if (!block) {
      continue;
    }
    const type = normalizeType(block.type);
    if (TOOL_CALL_TYPES.has(type)) {
      uses.push({
        id:
          typeof block.id === "string" && block.id.trim()
            ? block.id
            : typeof block.tool_use_id === "string" && block.tool_use_id.trim()
              ? block.tool_use_id
              : null,
        name: typeof block.name === "string" ? block.name : null,
        input: asRecord(block.input) ?? null,
      });
      continue;
    }
    if (TOOL_RESULT_TYPES.has(type)) {
      results.push({
        id:
          typeof block.tool_use_id === "string" && block.tool_use_id.trim()
            ? block.tool_use_id
            : typeof block.id === "string" && block.id.trim()
              ? block.id
              : null,
        isError: block.is_error === true || type === "tool_result_error",
        text: extractResultBlockText(block.content),
      });
    }
  }

  const inlineToolCalls = [
    ...(Array.isArray(message?.toolCalls) ? message.toolCalls : []),
    ...(Array.isArray(message?.tools) ? message.tools : []),
    ...(Array.isArray(record?.toolCalls) ? record.toolCalls : []),
    ...(Array.isArray(record?.tools) ? record.tools : []),
  ];
  for (const row of inlineToolCalls) {
    const name = extractToolNameFromRecord(row);
    if (!name) {
      continue;
    }
    const parsed = asRecord(row);
    uses.push({
      id:
        typeof parsed?.id === "string" && parsed.id.trim()
          ? parsed.id
          : typeof parsed?.tool_use_id === "string" && parsed.tool_use_id.trim()
            ? parsed.tool_use_id
            : null,
      name,
      input: asRecord(parsed?.input) ?? null,
    });
  }

  return { uses, results };
}

function parseJsonLoose(text) {
  if (!text || typeof text !== "string") {
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    // Best-effort parse for wrapped logs/code blocks.
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function mapTopEntries(map, limit = 20) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function extractQmdCollection(pathValue) {
  if (typeof pathValue !== "string") {
    return null;
  }
  const normalized = pathValue.trim();
  if (!normalized.toLowerCase().startsWith("qmd/")) {
    return null;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length < 2) {
    return "unknown";
  }
  return parts[1];
}

function extractText(content) {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }

  const chunks = [];
  for (const part of content) {
    if (typeof part === "string") {
      if (part.trim()) {
        chunks.push(part.trim());
      }
      continue;
    }
    const block = asRecord(part);
    if (!block) {
      continue;
    }
    const type = normalizeType(block.type);
    if (type === "text" && typeof block.text === "string") {
      const text = block.text.trim();
      if (text) {
        chunks.push(text);
      }
      continue;
    }
    if (TOOL_CALL_TYPES.has(type)) {
      const name = typeof block.name === "string" ? block.name : "tool";
      chunks.push(`[tool:${name}]`);
      continue;
    }
    if (TOOL_RESULT_TYPES.has(type)) {
      chunks.push("[tool_result]");
    }
  }
  return chunks.join(" ").trim();
}

function trimSnippet(value, max = 180) {
  if (!value) {
    return "";
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

function createTotals() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    totalCost: 0,
    inputCost: 0,
    outputCost: 0,
    cacheReadCost: 0,
    cacheWriteCost: 0,
    metadataCostEntries: 0,
    estimatedCostEntries: 0,
    metadataCostTotal: 0,
    estimatedCostTotal: 0,
    missingCostEntries: 0,
  };
}

function createRequestCounts() {
  return {
    total: 0,
    billable: 0,
    success: 0,
    failed: 0,
    timeout: 0,
    cancelled: 0,
    premium: 0,
    standard: 0,
    withCost: 0,
    withoutCost: 0,
  };
}

function mergeRequestCounts(target, source) {
  target.total += source.total;
  target.billable += source.billable;
  target.success += source.success;
  target.failed += source.failed;
  target.timeout += source.timeout;
  target.cancelled += source.cancelled;
  target.premium += source.premium;
  target.standard += source.standard;
  target.withCost += source.withCost;
  target.withoutCost += source.withoutCost;
}

function asPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return Math.floor(n);
}

function makeRequestModelKey(provider, model) {
  return `${provider ?? "unknown"}::${model ?? "unknown"}`;
}

function classifyRequestTier({ provider, model, premiumPattern }) {
  const value = `${provider ?? ""} ${model ?? ""}`.toLowerCase();
  if (!value.trim()) {
    return "standard";
  }
  if (premiumPattern && premiumPattern.test(value)) {
    return "premium";
  }
  for (const hint of PREMIUM_MODEL_HINTS) {
    if (value.includes(hint)) {
      return "premium";
    }
  }
  return "standard";
}

function createRequestUsageRow(provider, model) {
  return {
    provider: provider ?? "unknown",
    model: model ?? "unknown",
    total: 0,
    billable: 0,
    success: 0,
    failed: 0,
    timeout: 0,
    cancelled: 0,
    premium: 0,
    standard: 0,
    withCost: 0,
    withoutCost: 0,
    tokens: 0,
    cost: 0,
  };
}

function mergeRequestUsageRow(target, source) {
  target.total += source.total;
  target.billable += source.billable;
  target.success += source.success;
  target.failed += source.failed;
  target.timeout += source.timeout;
  target.cancelled += source.cancelled;
  target.premium += source.premium;
  target.standard += source.standard;
  target.withCost += source.withCost;
  target.withoutCost += source.withoutCost;
  target.tokens += source.tokens;
  target.cost += source.cost;
}

function createRequestDimensionRow(seed = {}) {
  return {
    ...seed,
    sessions: 0,
    total: 0,
    billable: 0,
    success: 0,
    failed: 0,
    timeout: 0,
    cancelled: 0,
    premium: 0,
    standard: 0,
    withCost: 0,
    withoutCost: 0,
    tokens: 0,
    cost: 0,
  };
}

function applyRequestCountsToDimension(target, source, extras = {}) {
  target.total += source.total ?? 0;
  target.billable += source.billable ?? 0;
  target.success += source.success ?? 0;
  target.failed += source.failed ?? 0;
  target.timeout += source.timeout ?? 0;
  target.cancelled += source.cancelled ?? 0;
  target.premium += source.premium ?? 0;
  target.standard += source.standard ?? 0;
  target.withCost += source.withCost ?? 0;
  target.withoutCost += source.withoutCost ?? 0;
  target.tokens += extras.tokens ?? 0;
  target.cost += extras.cost ?? 0;
}

function createVectorStats() {
  return {
    searchCalls: 0,
    searchSuccess: 0,
    searchErrors: 0,
    emptySearches: 0,
    nonEmptySearches: 0,
    qmdBackedSearches: 0,
    fallbackSearches: 0,
    totalResults: 0,
    memoryGetCalls: 0,
    qmdMemoryGetCalls: 0,
    topQueryMap: new Map(),
    topPathMap: new Map(),
    topCollectionMap: new Map(),
    providerModelMap: new Map(),
    latencyValues: [],
  };
}

function mergeTotals(target, source) {
  target.input += source.input;
  target.output += source.output;
  target.cacheRead += source.cacheRead;
  target.cacheWrite += source.cacheWrite;
  target.totalTokens += source.totalTokens;
  target.totalCost += source.totalCost;
  target.inputCost += source.inputCost;
  target.outputCost += source.outputCost;
  target.cacheReadCost += source.cacheReadCost;
  target.cacheWriteCost += source.cacheWriteCost;
  target.metadataCostEntries += source.metadataCostEntries;
  target.estimatedCostEntries += source.estimatedCostEntries;
  target.metadataCostTotal += source.metadataCostTotal;
  target.estimatedCostTotal += source.estimatedCostTotal;
  target.missingCostEntries += source.missingCostEntries;
}

function applyUsageTotals(totals, usage) {
  totals.input += usage.input;
  totals.output += usage.output;
  totals.cacheRead += usage.cacheRead;
  totals.cacheWrite += usage.cacheWrite;
  totals.totalTokens += usage.total;
}

function applyCostBreakdown(totals, breakdown) {
  totals.totalCost += breakdown.total;
  totals.metadataCostEntries += 1;
  totals.metadataCostTotal += breakdown.total;
  if (breakdown.input !== undefined) {
    totals.inputCost += breakdown.input;
  }
  if (breakdown.output !== undefined) {
    totals.outputCost += breakdown.output;
  }
  if (breakdown.cacheRead !== undefined) {
    totals.cacheReadCost += breakdown.cacheRead;
  }
  if (breakdown.cacheWrite !== undefined) {
    totals.cacheWriteCost += breakdown.cacheWrite;
  }
}

function applyCostTotal(totals, total) {
  if (typeof total === "number" && Number.isFinite(total) && total >= 0) {
    totals.totalCost += total;
    totals.metadataCostEntries += 1;
    totals.metadataCostTotal += total;
    return;
  }
  totals.missingCostEntries += 1;
}

function applyEstimatedCost(totals, estimate) {
  const total = typeof estimate?.total === "number" ? estimate.total : NaN;
  if (!Number.isFinite(total) || total < 0) {
    totals.missingCostEntries += 1;
    return;
  }
  totals.totalCost += total;
  totals.estimatedCostEntries += 1;
  totals.estimatedCostTotal += total;
  totals.inputCost += estimate.input ?? 0;
  totals.outputCost += estimate.output ?? 0;
  totals.cacheReadCost += estimate.cacheRead ?? 0;
  totals.cacheWriteCost += estimate.cacheWrite ?? 0;
}

function computeLatencyStats(values) {
  if (!values.length) {
    return undefined;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return {
    count,
    avgMs: sum / count,
    p95Ms: sorted[p95Index],
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
  };
}

function readJsonFileIfExists(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeSessionIdFromFileName(fileName) {
  const stem = fileName.endsWith(".jsonl") ? fileName.slice(0, -6) : fileName;
  const sessionId = stem.replace(/-topic-.+$/u, "");
  return { stem, sessionId };
}

function buildStoreIndex(agentSessionsDir) {
  const storePath = path.join(agentSessionsDir, "sessions.json");
  const store = readJsonFileIfExists(storePath, {});
  const byFileName = new Map();
  const bySessionId = new Map();

  for (const [key, entry] of Object.entries(store)) {
    const record = asRecord(entry);
    if (!record) {
      continue;
    }
    if (typeof record.sessionFile === "string" && record.sessionFile.trim()) {
      byFileName.set(path.basename(record.sessionFile), { key, entry: record });
    }
    if (typeof record.sessionId === "string" && record.sessionId.trim()) {
      if (!bySessionId.has(record.sessionId)) {
        bySessionId.set(record.sessionId, []);
      }
      bySessionId.get(record.sessionId).push({ key, entry: record });
    }
  }

  return { storePath, byFileName, bySessionId };
}

function resolveSessionMeta(fileName, derivedSessionId, storeIndex) {
  const direct = storeIndex.byFileName.get(fileName);
  if (direct) {
    return direct;
  }
  const byId = storeIndex.bySessionId.get(derivedSessionId);
  if (Array.isArray(byId) && byId.length > 0) {
    return byId[0];
  }
  return { key: null, entry: null };
}

function sortByCostThenTokens(a, b) {
  const cost = b.totals.totalCost - a.totals.totalCost;
  if (cost !== 0) {
    return cost;
  }
  return b.totals.totalTokens - a.totals.totalTokens;
}

async function parseSessionFile(params) {
  const {
    filePath,
    fileName,
    agentId,
    storeIndex,
    range,
    timelineLimit = 240,
    premiumPattern = null,
  } = params;
  const stat = await fsp.stat(filePath);
  const { stem, sessionId } = normalizeSessionIdFromFileName(fileName);
  const meta = resolveSessionMeta(fileName, sessionId, storeIndex);
  const entry = meta.entry;
  const sessionKey = meta.key ?? `agent:${agentId}:${stem}`;

  const totals = createTotals();
  const messageCounts = {
    total: 0,
    user: 0,
    assistant: 0,
    toolCalls: 0,
    toolResults: 0,
    errors: 0,
  };
  const requestCounts = createRequestCounts();
  const vectorStats = createVectorStats();

  const toolMap = new Map();
  const modelMap = new Map();
  const requestModelMap = new Map();
  const pendingToolCalls = new Map();
  const dailyMap = new Map();
  const dailyLatencies = new Map();
  const latencyValues = [];
  const preview = [];
  const timeline = [];
  const waterfall = [];
  const activityDates = new Set();
  const keyFileTotals = emptyKeyFileCounts();
  const keyFileDailyMap = new Map();

  let firstActivity;
  let lastActivity;
  let lastUserTs;
  let previousAssistantModelKey = null;
  let modelSwitches = 0;

  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const record = asRecord(parsed);
    if (!record) {
      continue;
    }
    const message = asRecord(record.message) ?? {};
    const rawText = extractText(message.content);
    const role =
      typeof message.role === "string" &&
      ["user", "assistant", "tool", "toolResult"].includes(message.role)
        ? message.role
        : undefined;
    const timestampMs = parseTimestampMs(record, message);

    const inRange =
      timestampMs === undefined ||
      (timestampMs >= range.startMs && timestampMs <= range.endMs);
    if (!inRange) {
      continue;
    }

    if (timestampMs !== undefined) {
      firstActivity = firstActivity === undefined ? timestampMs : Math.min(firstActivity, timestampMs);
      lastActivity = lastActivity === undefined ? timestampMs : Math.max(lastActivity, timestampMs);
      activityDates.add(dayKeyFromMs(timestampMs));
    }

    const dayKey = timestampMs !== undefined ? dayKeyFromMs(timestampMs) : null;
    const dayBucket =
      dayKey &&
      (dailyMap.get(dayKey) ?? {
        date: dayKey,
        tokens: 0,
        cost: 0,
        messages: 0,
        requests: 0,
        premiumRequests: 0,
        requestErrors: 0,
        requestTimeouts: 0,
        requestCancelled: 0,
        vectorSearches: 0,
        vectorSearchErrors: 0,
        vectorResults: 0,
        qmdBackedSearches: 0,
        memoryGetCalls: 0,
        qmdMemoryGetCalls: 0,
        toolCalls: 0,
        errors: 0,
      });

    if (role === "user" || role === "assistant") {
      messageCounts.total += 1;
      if (role === "user") {
        messageCounts.user += 1;
      }
      if (role === "assistant") {
        messageCounts.assistant += 1;
      }
      if (dayBucket) {
        dayBucket.messages += 1;
      }
    }

    if (role === "user" && timestampMs !== undefined) {
      lastUserTs = timestampMs;
    }

    const tools = extractToolDetails(message, record);
    const toolBlocks = extractToolBlocks(message, record);
    const explicitToolName =
      typeof message.toolName === "string"
        ? message.toolName
        : typeof message.name === "string"
          ? message.name
          : null;

    for (const use of toolBlocks.uses) {
      const useName = typeof use.name === "string" ? use.name : null;
      if (!useName) {
        continue;
      }
      const usePath = typeof use.input?.path === "string" ? use.input.path.trim() : "";
      if (use.id) {
        pendingToolCalls.set(use.id, {
          name: useName,
          query: typeof use.input?.query === "string" ? use.input.query.trim() : null,
          path: usePath || null,
        });
      }
      if (usePath) {
        const pathHits = collectKeyFileHits(usePath);
        if (hasKeyFileHits(pathHits)) {
          mergeKeyFileCounts(keyFileTotals, pathHits);
          addKeyFileHitsToDailyMap(keyFileDailyMap, dayKey, pathHits);
        }
      }

      if (isMemorySearchToolName(useName) || isVectorSearchToolName(useName)) {
        vectorStats.searchCalls += 1;
        if (dayBucket) {
          dayBucket.vectorSearches += 1;
        }
        const query = typeof use.input?.query === "string" ? use.input.query.trim() : "";
        if (query) {
          vectorStats.topQueryMap.set(query, (vectorStats.topQueryMap.get(query) ?? 0) + 1);
        }
      }

      if (isMemoryGetToolName(useName)) {
        vectorStats.memoryGetCalls += 1;
        if (dayBucket) {
          dayBucket.memoryGetCalls += 1;
        }
        const memoryPath = usePath;
        if (memoryPath.toLowerCase().startsWith("qmd/")) {
          vectorStats.qmdMemoryGetCalls += 1;
          if (dayBucket) {
            dayBucket.qmdMemoryGetCalls += 1;
          }
        }
      }
    }

    if (role === "tool" && explicitToolName) {
      if ((isMemorySearchToolName(explicitToolName) || isVectorSearchToolName(explicitToolName)) && !toolBlocks.uses.length) {
        vectorStats.searchCalls += 1;
        if (dayBucket) {
          dayBucket.vectorSearches += 1;
        }
      }
      if (isMemoryGetToolName(explicitToolName) && !toolBlocks.uses.length) {
        vectorStats.memoryGetCalls += 1;
        if (dayBucket) {
          dayBucket.memoryGetCalls += 1;
        }
      }
    }

    if (tools.names.length > 0) {
      messageCounts.toolCalls += tools.names.length;
      if (dayBucket) {
        dayBucket.toolCalls += tools.names.length;
      }
      for (const name of tools.names) {
        toolMap.set(name, (toolMap.get(name) ?? 0) + 1);
      }
    }

    if (tools.results > 0) {
      messageCounts.toolResults += tools.results;
      messageCounts.errors += tools.errors;
      if (dayBucket) {
        dayBucket.errors += tools.errors;
      }
    }

    const stopReason =
      typeof message.stopReason === "string"
        ? message.stopReason
        : typeof record.stopReason === "string"
          ? record.stopReason
          : undefined;
    const stopReasonLower = stopReason ? stopReason.toLowerCase() : null;
    if (stopReason && STOP_REASON_ERRORS.has(stopReason.toLowerCase())) {
      messageCounts.errors += 1;
      if (dayBucket) {
        dayBucket.errors += 1;
      }
    }

    const usageRaw = message.usage ?? record.usage;
    const usage = normalizeUsage(usageRaw);
    const provider =
      typeof message.provider === "string"
        ? message.provider
        : typeof record.provider === "string"
          ? record.provider
          : undefined;
    const model =
      typeof message.model === "string"
        ? message.model
        : typeof record.model === "string"
          ? record.model
          : undefined;
    const assistantModelKey = `${provider ?? "unknown"}::${model ?? "unknown"}`;
    let entryCostTotal;
    let entryCostSource = "missing";
    let entryPricingProfile = null;

    if (usage) {
      applyUsageTotals(totals, usage);
      if (dayBucket) {
        dayBucket.tokens += usage.total;
      }

      const modelKey = `${provider ?? "unknown"}::${model ?? "unknown"}`;
      const modelBucket =
        modelMap.get(modelKey) ?? { provider, model, count: 0, totals: createTotals() };
      modelBucket.count += 1;
      applyUsageTotals(modelBucket.totals, usage);

      const breakdown = extractCostBreakdown(usageRaw);
      if (breakdown) {
        applyCostBreakdown(totals, breakdown);
        applyCostBreakdown(modelBucket.totals, breakdown);
        if (dayBucket) {
          dayBucket.cost += breakdown.total;
        }
        entryCostTotal = breakdown.total;
        entryCostSource = "metadata";
      } else {
        const rawCostTotal =
          toFinite(record.costTotal) ??
          toFinite(message.costTotal) ??
          toFinite(asRecord(record.cost)?.total) ??
          toFinite(asRecord(message.cost)?.total);
        if (typeof rawCostTotal === "number" && Number.isFinite(rawCostTotal) && rawCostTotal >= 0) {
          applyCostTotal(totals, rawCostTotal);
          applyCostTotal(modelBucket.totals, rawCostTotal);
          if (dayBucket) {
            dayBucket.cost += rawCostTotal;
          }
          entryCostTotal = rawCostTotal;
          entryCostSource = "metadata";
        } else {
          const estimate = estimateCostFromUsage({ usage, provider, model });
          if (estimate) {
            applyEstimatedCost(totals, estimate);
            applyEstimatedCost(modelBucket.totals, estimate);
            if (dayBucket) {
              dayBucket.cost += estimate.total;
            }
            entryCostTotal = estimate.total;
            entryCostSource = "estimated";
            entryPricingProfile = estimate.pricingId ?? null;
          } else {
            totals.missingCostEntries += 1;
            modelBucket.totals.missingCostEntries += 1;
          }
        }
      }

      modelMap.set(modelKey, modelBucket);
    }

    let durationMs = toFinite(record.durationMs) ?? toFinite(message.durationMs);
    if (durationMs === undefined && role === "assistant" && timestampMs !== undefined && lastUserTs) {
      durationMs = Math.max(0, timestampMs - lastUserTs);
    }
    if (role === "assistant" && typeof durationMs === "number") {
      latencyValues.push(durationMs);
      if (dayKey) {
        if (!dailyLatencies.has(dayKey)) {
          dailyLatencies.set(dayKey, []);
        }
        dailyLatencies.get(dayKey).push(durationMs);
      }
    }

    const resultBlocks = [...toolBlocks.results];
    if (role === "toolResult" && resultBlocks.length === 0 && explicitToolName) {
      resultBlocks.push({
        id: null,
        isError: false,
        text: rawText,
      });
    }

    for (const resultBlock of resultBlocks) {
      const pending =
        resultBlock.id && pendingToolCalls.has(resultBlock.id)
          ? pendingToolCalls.get(resultBlock.id)
          : null;
      if (resultBlock.id && pending) {
        pendingToolCalls.delete(resultBlock.id);
      }
      const resolvedToolName = pending?.name ?? explicitToolName;
      if (!resolvedToolName) {
        continue;
      }

      const vectorSearchTool =
        isMemorySearchToolName(resolvedToolName) || isVectorSearchToolName(resolvedToolName);
      if (vectorSearchTool) {
        if (!pending) {
          vectorStats.searchCalls += 1;
          if (dayBucket) {
            dayBucket.vectorSearches += 1;
          }
        }

        const payload = parseJsonLoose(resultBlock.text);
        const payloadRecord = asRecord(payload);
        const payloadError =
          typeof payloadRecord?.error === "string" ? payloadRecord.error.trim() : null;
        const payloadResults = Array.isArray(payloadRecord?.results)
          ? payloadRecord.results.map((item) => asRecord(item)).filter(Boolean)
          : [];
        const disabled = payloadRecord?.disabled === true;
        const hasError = resultBlock.isError || Boolean(payloadError) || disabled;

        if (hasError) {
          vectorStats.searchErrors += 1;
          if (dayBucket) {
            dayBucket.vectorSearchErrors += 1;
          }
        } else {
          vectorStats.searchSuccess += 1;
        }

        const resultCount = payloadResults.length;
        vectorStats.totalResults += resultCount;
        if (dayBucket) {
          dayBucket.vectorResults += resultCount;
        }
        if (resultCount > 0) {
          vectorStats.nonEmptySearches += 1;
        } else {
          vectorStats.emptySearches += 1;
        }

        let qmdBacked = false;
        const provider =
          typeof payloadRecord?.provider === "string" ? payloadRecord.provider.trim() : null;
        const model =
          typeof payloadRecord?.model === "string" ? payloadRecord.model.trim() : null;
        if (provider && provider.toLowerCase().includes("qmd")) {
          qmdBacked = true;
        }
        if (provider || model) {
          const providerModelKey = `${provider ?? "unknown"} / ${model ?? "unknown"}`;
          vectorStats.providerModelMap.set(
            providerModelKey,
            (vectorStats.providerModelMap.get(providerModelKey) ?? 0) + 1,
          );
        }
        if (payloadRecord?.fallback) {
          vectorStats.fallbackSearches += 1;
        }
        for (const row of payloadResults) {
          const pathValue = typeof row.path === "string" ? row.path.trim() : "";
          if (!pathValue) {
            continue;
          }
          vectorStats.topPathMap.set(pathValue, (vectorStats.topPathMap.get(pathValue) ?? 0) + 1);
          const collection = extractQmdCollection(pathValue);
          if (collection) {
            qmdBacked = true;
            vectorStats.topCollectionMap.set(
              collection,
              (vectorStats.topCollectionMap.get(collection) ?? 0) + 1,
            );
          }
        }
        if (qmdBacked) {
          vectorStats.qmdBackedSearches += 1;
          if (dayBucket) {
            dayBucket.qmdBackedSearches += 1;
          }
        }
        if (typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0) {
          vectorStats.latencyValues.push(durationMs);
        }
      }

      if (isMemoryGetToolName(resolvedToolName) && !pending) {
        vectorStats.memoryGetCalls += 1;
        if (dayBucket) {
          dayBucket.memoryGetCalls += 1;
        }
      }

      if (isMemoryGetToolName(resolvedToolName)) {
        const pendingPath = typeof pending?.path === "string" ? pending.path.trim() : "";
        let pathCandidate = null;
        const payload = parseJsonLoose(resultBlock.text);
        const payloadRecord = asRecord(payload);
        if (typeof payloadRecord?.path === "string" && payloadRecord.path.trim()) {
          pathCandidate = payloadRecord.path.trim();
        } else if (pendingPath) {
          pathCandidate = pendingPath;
        }
        if (pathCandidate) {
          const sameAsPending =
            pendingPath && pathCandidate.toLowerCase() === pendingPath.toLowerCase();
          if (!sameAsPending) {
            const pathHits = collectKeyFileHits(pathCandidate);
            if (hasKeyFileHits(pathHits)) {
              mergeKeyFileCounts(keyFileTotals, pathHits);
              addKeyFileHitsToDailyMap(keyFileDailyMap, dayKey, pathHits);
            }
          }
        }
        if (!pendingPath && pathCandidate && pathCandidate.toLowerCase().startsWith("qmd/")) {
          vectorStats.qmdMemoryGetCalls += 1;
          if (dayBucket) {
            dayBucket.qmdMemoryGetCalls += 1;
          }
        }
      }
    }

    if (
      role === "assistant" &&
      previousAssistantModelKey &&
      assistantModelKey !== "unknown::unknown" &&
      assistantModelKey !== previousAssistantModelKey
    ) {
      modelSwitches += 1;
    }
    if (role === "assistant" && assistantModelKey !== "unknown::unknown") {
      previousAssistantModelKey = assistantModelKey;
    }

    const entryIsError = tools.errors > 0 || (stopReasonLower ? STOP_REASON_ERRORS.has(stopReasonLower) : false);
    if (role === "assistant") {
      const tier = classifyRequestTier({ provider, model, premiumPattern });
      const isBillable = Boolean(usage) || Boolean(provider) || Boolean(model);
      const isTimeout = Boolean(stopReasonLower && STOP_REASON_TIMEOUTS.has(stopReasonLower));
      const isCancelled = Boolean(stopReasonLower && STOP_REASON_CANCELLED.has(stopReasonLower));

      requestCounts.total += 1;
      if (isBillable) {
        requestCounts.billable += 1;
      }
      if (entryIsError) {
        requestCounts.failed += 1;
      } else {
        requestCounts.success += 1;
      }
      if (isTimeout) {
        requestCounts.timeout += 1;
      }
      if (isCancelled) {
        requestCounts.cancelled += 1;
      }
      if (tier === "premium") {
        requestCounts.premium += 1;
      } else {
        requestCounts.standard += 1;
      }
      if (typeof entryCostTotal === "number") {
        requestCounts.withCost += 1;
      } else {
        requestCounts.withoutCost += 1;
      }

      const requestModelKey = makeRequestModelKey(provider, model);
      const requestRow =
        requestModelMap.get(requestModelKey) ?? createRequestUsageRow(provider, model);
      requestRow.total += 1;
      if (isBillable) {
        requestRow.billable += 1;
      }
      if (entryIsError) {
        requestRow.failed += 1;
      } else {
        requestRow.success += 1;
      }
      if (isTimeout) {
        requestRow.timeout += 1;
      }
      if (isCancelled) {
        requestRow.cancelled += 1;
      }
      if (tier === "premium") {
        requestRow.premium += 1;
      } else {
        requestRow.standard += 1;
      }
      if (typeof entryCostTotal === "number") {
        requestRow.withCost += 1;
        requestRow.cost += entryCostTotal;
      } else {
        requestRow.withoutCost += 1;
      }
      requestRow.tokens += usage?.total ?? 0;
      requestModelMap.set(requestModelKey, requestRow);

      if (dayBucket) {
        dayBucket.requests += 1;
        if (tier === "premium") {
          dayBucket.premiumRequests += 1;
        }
        if (entryIsError) {
          dayBucket.requestErrors += 1;
        }
        if (isTimeout) {
          dayBucket.requestTimeouts += 1;
        }
        if (isCancelled) {
          dayBucket.requestCancelled += 1;
        }
      }
    }

    if (timestampMs !== undefined && role) {
      timeline.push({
        timestamp: timestampMs,
        role,
        provider: provider ?? null,
        model: model ?? null,
        tokens: usage?.total ?? 0,
        inputTokens: usage?.input ?? 0,
        outputTokens: usage?.output ?? 0,
        cost: typeof entryCostTotal === "number" ? entryCostTotal : null,
        costSource: entryCostSource,
        pricingProfile: entryPricingProfile,
        durationMs: typeof durationMs === "number" ? durationMs : null,
        toolCalls: tools.names.length,
        toolResults: tools.results,
        isError: entryIsError,
        stopReason: stopReason ?? null,
        text: trimSnippet(rawText, 140),
      });
    }

    if (role === "assistant" && timestampMs !== undefined && lastUserTs !== undefined) {
      waterfall.push({
        startTs: Math.min(lastUserTs, timestampMs),
        endTs: timestampMs,
        latencyMs: Math.max(0, timestampMs - lastUserTs),
        provider: provider ?? null,
        model: model ?? null,
        tokens: usage?.total ?? 0,
        cost: typeof entryCostTotal === "number" ? entryCostTotal : null,
        costSource: entryCostSource,
        error: entryIsError,
      });
    }

    if (dayBucket) {
      dailyMap.set(dayBucket.date, dayBucket);
    }

    if (role) {
      const text = trimSnippet(rawText);
      if (text) {
        preview.push({
          timestamp: timestampMs,
          role,
          text,
        });
        if (preview.length > 8) {
          preview.shift();
        }
      }
    }
  }

  const daily = Array.from(dailyMap.values())
    .map((day) => {
      const lat = computeLatencyStats(dailyLatencies.get(day.date) ?? []);
      return {
        ...day,
        latency: lat,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const toolUsage = {
    totalCalls: Array.from(toolMap.values()).reduce((sum, count) => sum + count, 0),
    uniqueTools: toolMap.size,
    tools: Array.from(toolMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };

  const modelUsage = Array.from(modelMap.values()).sort(sortByCostThenTokens);
  const requestUsage = Array.from(requestModelMap.values()).sort(
    (a, b) => b.total - a.total || b.cost - a.cost || b.tokens - a.tokens,
  );
  const vectorLatency = computeLatencyStats(vectorStats.latencyValues);
  const vector = {
    searchCalls: vectorStats.searchCalls,
    searchSuccess: vectorStats.searchSuccess,
    searchErrors: vectorStats.searchErrors,
    emptySearches: vectorStats.emptySearches,
    nonEmptySearches: vectorStats.nonEmptySearches,
    qmdBackedSearches: vectorStats.qmdBackedSearches,
    fallbackSearches: vectorStats.fallbackSearches,
    totalResults: vectorStats.totalResults,
    memoryGetCalls: vectorStats.memoryGetCalls,
    qmdMemoryGetCalls: vectorStats.qmdMemoryGetCalls,
    avgResultsPerSearch:
      vectorStats.searchCalls > 0 ? vectorStats.totalResults / vectorStats.searchCalls : 0,
    qmdBackedRatePct:
      vectorStats.searchCalls > 0 ? (vectorStats.qmdBackedSearches / vectorStats.searchCalls) * 100 : 0,
    searchErrorRatePct:
      vectorStats.searchCalls > 0 ? (vectorStats.searchErrors / vectorStats.searchCalls) * 100 : 0,
    searchSuccessRatePct:
      vectorStats.searchCalls > 0 ? (vectorStats.searchSuccess / vectorStats.searchCalls) * 100 : 0,
    latency: vectorLatency ?? null,
    topQueries: mapTopEntries(vectorStats.topQueryMap, 16).map((item) => ({
      query: item.key,
      count: item.count,
    })),
    topPaths: mapTopEntries(vectorStats.topPathMap, 20).map((item) => ({
      path: item.key,
      count: item.count,
    })),
    topCollections: mapTopEntries(vectorStats.topCollectionMap, 16).map((item) => ({
      collection: item.key,
      count: item.count,
    })),
    providerModels: mapTopEntries(vectorStats.providerModelMap, 16).map((item) => ({
      providerModel: item.key,
      count: item.count,
    })),
  };
  const latency = computeLatencyStats(latencyValues);
  const sortedTimeline = timeline.sort((a, b) => a.timestamp - b.timestamp);
  const sortedWaterfall = waterfall.sort((a, b) => a.startTs - b.startTs);
  const timelineTail =
    sortedTimeline.length > timelineLimit
      ? sortedTimeline.slice(sortedTimeline.length - timelineLimit)
      : sortedTimeline;
  const waterfallTail =
    sortedWaterfall.length > timelineLimit
      ? sortedWaterfall.slice(sortedWaterfall.length - timelineLimit)
      : sortedWaterfall;
  const uniqueModelKeys = new Set(
    modelUsage.map((m) => `${m.provider ?? "unknown"}::${m.model ?? "unknown"}`),
  );

  const contextWeight = asRecord(entry?.systemPromptReport)
    ? {
        source: entry.systemPromptReport.source,
        generatedAt: entry.systemPromptReport.generatedAt,
        systemPrompt: entry.systemPromptReport.systemPrompt,
        skills: entry.systemPromptReport.skills,
        tools: entry.systemPromptReport.tools,
      }
    : null;
  const keyFilesDaily = Array.from(keyFileDailyMap.entries())
    .map(([date, counts]) => ({
      date,
      counts,
      total: KEY_FILE_DEFINITIONS.reduce((sum, item) => sum + (counts[item.key] ?? 0), 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const keyFilesTotals = KEY_FILE_DEFINITIONS.map((item) => ({
    key: item.key,
    label: item.label,
    count: keyFileTotals[item.key] ?? 0,
  }));

  return {
    id: `${agentId}:${stem}`,
    key: sessionKey,
    agentId,
    sessionId,
    fileName,
    filePath,
    label: typeof entry?.label === "string" ? entry.label : undefined,
    channel:
      typeof entry?.channel === "string"
        ? entry.channel
        : typeof entry?.origin?.provider === "string"
          ? entry.origin.provider
          : undefined,
    chatType:
      typeof entry?.chatType === "string"
        ? entry.chatType
        : typeof entry?.origin?.chatType === "string"
          ? entry.origin.chatType
          : undefined,
    updatedAt: toFinite(entry?.updatedAt) ?? stat.mtimeMs,
    firstActivity,
    lastActivity,
    durationMs:
      firstActivity !== undefined && lastActivity !== undefined
        ? Math.max(0, lastActivity - firstActivity)
        : undefined,
    totals,
    messageCounts,
    requestCounts,
    toolUsage,
    modelUsage,
    requestUsage,
    vector,
    latency,
    daily,
    contextWeight,
    systemPromptReport: entry?.systemPromptReport ?? null,
    memoryFlushAt: toFinite(entry?.memoryFlushAt),
    memoryFlushCompactionCount: toFinite(entry?.memoryFlushCompactionCount),
    parentSessionId:
      typeof entry?.parentSessionId === "string"
        ? entry.parentSessionId
        : typeof entry?.origin?.parentSessionId === "string"
          ? entry.origin.parentSessionId
          : undefined,
    trigger: typeof entry?.trigger === "string" ? entry.trigger : undefined,
    mode: typeof entry?.mode === "string" ? entry.mode : undefined,
    origin: asRecord(entry?.origin)
      ? {
          provider:
            typeof entry.origin.provider === "string" ? entry.origin.provider : undefined,
          source: typeof entry.origin.source === "string" ? entry.origin.source : undefined,
          type: typeof entry.origin.type === "string" ? entry.origin.type : undefined,
          parentSessionId:
            typeof entry.origin.parentSessionId === "string"
              ? entry.origin.parentSessionId
              : undefined,
        }
      : undefined,
    modelOverride: typeof entry?.modelOverride === "string" ? entry.modelOverride : undefined,
    providerOverride:
      typeof entry?.providerOverride === "string" ? entry.providerOverride : undefined,
    preview,
    timeline: timelineTail,
    waterfall: waterfallTail,
    modelSwitches,
    uniqueModels: uniqueModelKeys.size,
    activityDates: Array.from(activityDates).sort((a, b) => a.localeCompare(b)),
    keyFiles: {
      totals: keyFilesTotals,
      daily: keyFilesDaily,
      totalHits: keyFilesTotals.reduce((sum, item) => sum + item.count, 0),
    },
  };
}

async function walkFilesRecursive(rootDir, result, maxDepth = 4, depth = 0) {
  if (depth > maxDepth) {
    return;
  }
  let entries = [];
  try {
    entries = await fsp.readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      await walkFilesRecursive(fullPath, result, maxDepth, depth + 1);
      continue;
    }
    if (entry.isFile()) {
      result.push(fullPath);
    }
  }
}

function tokenizeWords(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !WORD_BLACKLIST.has(w));
}

function calcMean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function calcStdDev(values, mean) {
  if (values.length < 2) {
    return 0;
  }
  const variance =
    values.reduce((sum, n) => sum + (n - mean) * (n - mean), 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

async function collectMemoryStats({ workspaceDir, memoryLimit = 80 }) {
  const memoryDir = path.join(workspaceDir, "memory");
  const exists = fs.existsSync(memoryDir);
  if (!exists) {
    return {
      workspaceDir,
      memoryDir,
      exists: false,
      fileCount: 0,
      totalBytes: 0,
      newestMs: null,
      oldestMs: null,
      byDay: [],
      files: [],
      keywords: [],
    };
  }

  const filePaths = [];
  await walkFilesRecursive(memoryDir, filePaths, 6);
  const markdownFiles = filePaths.filter((filePath) => /\.(md|mdx|txt)$/iu.test(filePath));

  const byDayMap = new Map();
  const keywordMap = new Map();
  const fileRows = [];

  let totalBytes = 0;
  let newestMs = null;
  let oldestMs = null;

  for (const filePath of markdownFiles) {
    let stat;
    try {
      stat = await fsp.stat(filePath);
    } catch {
      continue;
    }

    totalBytes += stat.size;
    newestMs = newestMs === null ? stat.mtimeMs : Math.max(newestMs, stat.mtimeMs);
    oldestMs = oldestMs === null ? stat.mtimeMs : Math.min(oldestMs, stat.mtimeMs);

    const day = dayKeyFromMs(stat.mtimeMs);
    const byDay = byDayMap.get(day) ?? { date: day, files: 0, bytes: 0 };
    byDay.files += 1;
    byDay.bytes += stat.size;
    byDayMap.set(day, byDay);

    let content = "";
    try {
      content = await fsp.readFile(filePath, "utf8");
    } catch {
      content = "";
    }

    const titleLine =
      content
        .split(/\r?\n/u)
        .find((line) => line.trim().startsWith("#"))
        ?.replace(/^#+\s*/u, "")
        .trim() ?? "";
    const title = titleLine || path.basename(filePath);
    const snippet = trimSnippet(
      content
        .replace(/\s+/g, " ")
        .replace(/#+\s*/g, "")
        .trim(),
      220,
    );

    for (const token of tokenizeWords(`${title} ${snippet}`)) {
      keywordMap.set(token, (keywordMap.get(token) ?? 0) + 1);
    }

    fileRows.push({
      path: filePath,
      relativePath: path.relative(workspaceDir, filePath),
      title,
      snippet,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    });
  }

  fileRows.sort((a, b) => b.mtimeMs - a.mtimeMs);

  return {
    workspaceDir,
    memoryDir,
    exists: true,
    fileCount: fileRows.length,
    totalBytes,
    newestMs,
    oldestMs,
    byDay: Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    files: fileRows.slice(0, Math.max(10, memoryLimit)),
    keywords: Array.from(keywordMap.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24),
  };
}

function buildAnomalies({ daily, sessions, latency, requests, vector }) {
  const tokenSpikes = [];
  if (daily.length >= 4) {
    const ordered = [...daily].sort((a, b) => a.date.localeCompare(b.date));
    const last = ordered[ordered.length - 1];
    const previous = ordered.slice(0, -1).map((d) => d.tokens).filter((n) => n > 0);
    if (previous.length >= 3) {
      const baseline = calcMean(previous);
      const ratio = baseline > 0 ? last.tokens / baseline : 0;
      if (last.tokens > 5000 && ratio >= 2.3) {
        tokenSpikes.push({
          date: last.date,
          tokens: last.tokens,
          baselineTokens: baseline,
          ratio,
        });
      }
    }
  }

  let latencyJitter = null;
  const dailyLatency = daily
    .map((d) => ({ date: d.date, avgMs: d.latency?.avgMs ?? null, p95Ms: d.latency?.p95Ms ?? null }))
    .filter((d) => typeof d.avgMs === "number");
  if (dailyLatency.length >= 4) {
    const avgs = dailyLatency.map((d) => d.avgMs);
    const mean = calcMean(avgs);
    const std = calcStdDev(avgs, mean);
    const cv = mean > 0 ? std / mean : 0;
    const globalP95Ratio =
      latency && latency.avgMs > 0 && latency.p95Ms > 0 ? latency.p95Ms / latency.avgMs : 0;
    if (cv >= 0.45 || globalP95Ratio >= 2.2) {
      latencyJitter = {
        coefficientOfVariation: cv,
        globalP95ToAvgRatio: globalP95Ratio,
        days: dailyLatency,
      };
    }
  }

  const modelSwitching = sessions
    .filter((session) => session.uniqueModels > 1 || session.modelSwitches > 0)
    .map((session) => ({
      sessionId: session.sessionId,
      key: session.key,
      agentId: session.agentId,
      label: session.label ?? null,
      switches: session.modelSwitches,
      uniqueModels: session.uniqueModels,
      models: session.modelUsage.slice(0, 8).map((m) => ({
        provider: m.provider ?? "unknown",
        model: m.model ?? "unknown",
        tokens: m.totals.totalTokens,
        cost: m.totals.totalCost,
      })),
      updatedAt: session.updatedAt ?? null,
    }))
    .sort((a, b) => b.switches - a.switches || b.uniqueModels - a.uniqueModels);

  const requestSpikes = [];
  if (daily.length >= 4) {
    const ordered = [...daily].sort((a, b) => a.date.localeCompare(b.date));
    const last = ordered[ordered.length - 1];
    const previous = ordered.slice(0, -1).map((d) => d.requests ?? 0).filter((n) => n > 0);
    if (previous.length >= 3) {
      const baseline = calcMean(previous);
      const ratio = baseline > 0 ? (last.requests ?? 0) / baseline : 0;
      if ((last.requests ?? 0) >= 20 && ratio >= 2.1) {
        requestSpikes.push({
          date: last.date,
          requests: last.requests ?? 0,
          baselineRequests: baseline,
          ratio,
        });
      }
    }
  }

  const requestFailureSpikes = [];
  if (daily.length >= 5) {
    const ordered = [...daily]
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((d) => (d.requests ?? 0) > 0);
    if (ordered.length >= 4) {
      const last = ordered[ordered.length - 1];
      const prevRates = ordered
        .slice(0, -1)
        .map((d) => ((d.requestErrors ?? 0) / Math.max(1, d.requests ?? 0)) * 100);
      if (prevRates.length >= 3) {
        const baseline = calcMean(prevRates);
        const lastRate = ((last.requestErrors ?? 0) / Math.max(1, last.requests ?? 0)) * 100;
        const ratio = baseline > 0 ? lastRate / baseline : 0;
        if (lastRate >= 8 && ratio >= 1.8) {
          requestFailureSpikes.push({
            date: last.date,
            ratePct: lastRate,
            baselineRatePct: baseline,
            ratio,
            requests: last.requests ?? 0,
          });
        }
      }
    }
  }

  let qmdCoverageDrop = null;
  if ((vector?.searchCalls ?? 0) >= 8) {
    const qmdRate = vector?.qmdBackedRatePct ?? 0;
    if (qmdRate < 35) {
      qmdCoverageDrop = {
        qmdBackedRatePct: qmdRate,
        searchCalls: vector.searchCalls,
        qmdBackedSearches: vector.qmdBackedSearches,
      };
    }
  }

  let requestFailureHigh = null;
  if ((requests?.total ?? 0) >= 20) {
    const failureRatePct = requests.failureRatePct ?? 0;
    if (failureRatePct >= 10) {
      requestFailureHigh = {
        failureRatePct,
        failed: requests.failed,
        total: requests.total,
      };
    }
  }

  return {
    tokenSpikes,
    latencyJitter,
    modelSwitching,
    requestSpikes,
    requestFailureSpikes,
    qmdCoverageDrop,
    requestFailureHigh,
  };
}

function buildAlerts({ totals, messages, requests, vector, sessions, memory, anomalies, quota }) {
  const alerts = [];

  const errorRate = messages.total > 0 ? (messages.errors / messages.total) * 100 : 0;
  if (errorRate >= 5) {
    alerts.push({
      level: "warn",
      title: "Error Rate Elevated",
      message: `Current error rate is ${errorRate.toFixed(1)}%, above 5%.`,
    });
  }

  const cacheRate = totals.totalTokens > 0 ? (totals.cacheRead / totals.totalTokens) * 100 : 0;
  if (cacheRate < 5 && totals.totalTokens > 5000) {
    alerts.push({
      level: "info",
      title: "Low Cache Read Share",
      message: `Cache read share is ${cacheRate.toFixed(1)}%; prompt reuse opportunities may exist.`,
    });
  }

  if ((requests?.total ?? 0) >= 20 && (requests?.failureRatePct ?? 0) >= 8) {
    alerts.push({
      level: "warn",
      title: "Request Failure Rate Elevated",
      message: `Request failure rate is ${(requests.failureRatePct ?? 0).toFixed(1)}% (${requests.failed}/${requests.total}).`,
    });
  }

  if ((vector?.searchCalls ?? 0) >= 10 && (vector?.searchErrorRatePct ?? 0) >= 10) {
    alerts.push({
      level: "warn",
      title: "Vector Retrieval Errors Elevated",
      message: `Vector search error rate is ${(vector.searchErrorRatePct ?? 0).toFixed(1)}% across ${vector.searchCalls} searches.`,
    });
  }

  if ((vector?.searchCalls ?? 0) >= 10 && (vector?.qmdBackedRatePct ?? 0) < 40) {
    alerts.push({
      level: "info",
      title: "Low QMD Coverage",
      message: `Only ${(vector.qmdBackedRatePct ?? 0).toFixed(1)}% of vector searches were QMD-backed.`,
    });
  }

  if (quota?.totalLimit && quota.totalUsagePct >= 90) {
    alerts.push({
      level: "warn",
      title: "Request Quota Near Limit",
      message: `Request quota usage ${(quota.totalUsagePct ?? 0).toFixed(1)}% (${quota.totalUsed}/${quota.totalLimit}).`,
    });
  }

  if (quota?.premiumLimit && quota.premiumUsagePct >= 90) {
    alerts.push({
      level: "warn",
      title: "Premium Quota Near Limit",
      message: `Premium quota usage ${(quota.premiumUsagePct ?? 0).toFixed(1)}% (${quota.premiumUsed}/${quota.premiumLimit}).`,
    });
  }

  const staleSessions = sessions.filter((s) => {
    const ts = s.updatedAt ?? s.lastActivity;
    if (!ts) {
      return false;
    }
    return Date.now() - ts > 14 * DAY_MS;
  }).length;
  if (staleSessions > 0) {
    alerts.push({
      level: "info",
      title: "Stale Sessions Present",
      message: `${staleSessions} sessions have not been updated in 14+ days.`,
    });
  }

  if (memory.exists && memory.fileCount > 1000) {
    alerts.push({
      level: "warn",
      title: "Large Memory Corpus",
      message: `Memory directory has ${memory.fileCount} files; indexing/search may slow down.`,
    });
  }

  for (const spike of anomalies.tokenSpikes) {
    alerts.push({
      level: "warn",
      title: "Token Spike Detected",
      message: `${spike.date}: ${Math.round(spike.tokens).toLocaleString()} tokens (${spike.ratio.toFixed(2)}x baseline).`,
    });
  }

  if (anomalies.latencyJitter) {
    alerts.push({
      level: "warn",
      title: "Latency Jitter Detected",
      message: `Latency variability high (CV ${(anomalies.latencyJitter.coefficientOfVariation * 100).toFixed(1)}%, p95/avg ${anomalies.latencyJitter.globalP95ToAvgRatio.toFixed(2)}x).`,
    });
  }

  if (anomalies.modelSwitching.length > 0) {
    const count = anomalies.modelSwitching.length;
    alerts.push({
      level: "info",
      title: "Model Switching Sessions",
      message: `${count} session${count === 1 ? "" : "s"} switched model/provider in the current window.`,
    });
  }

  for (const spike of anomalies.requestSpikes ?? []) {
    alerts.push({
      level: "warn",
      title: "Request Spike Detected",
      message: `${spike.date}: ${Math.round(spike.requests).toLocaleString()} requests (${spike.ratio.toFixed(2)}x baseline).`,
    });
  }

  for (const spike of anomalies.requestFailureSpikes ?? []) {
    alerts.push({
      level: "warn",
      title: "Request Failure Spike",
      message: `${spike.date}: failure ${spike.ratePct.toFixed(1)}% (${spike.ratio.toFixed(2)}x baseline).`,
    });
  }

  if (anomalies.qmdCoverageDrop) {
    alerts.push({
      level: "info",
      title: "QMD Retrieval Coverage Low",
      message: `QMD-backed retrieval ${(anomalies.qmdCoverageDrop.qmdBackedRatePct ?? 0).toFixed(1)}% (${anomalies.qmdCoverageDrop.qmdBackedSearches}/${anomalies.qmdCoverageDrop.searchCalls}).`,
    });
  }

  return alerts;
}

function aggregateSessions({ sessions, filter }) {
  const filtered = sessions.filter((session) => {
    if (filter.agent && session.agentId !== filter.agent) {
      return false;
    }
    if (filter.channel && (session.channel ?? "") !== filter.channel) {
      return false;
    }
    return true;
  });

  const totals = createTotals();
  const messages = {
    total: 0,
    user: 0,
    assistant: 0,
    toolCalls: 0,
    toolResults: 0,
    errors: 0,
  };
  const requests = createRequestCounts();
  const vector = createVectorStats();

  const toolsMap = new Map();
  const byModelMap = new Map();
  const byProviderMap = new Map();
  const byAgentMap = new Map();
  const byChannelMap = new Map();
  const byRequestModelMap = new Map();
  const byRequestProviderMap = new Map();
  const byRequestAgentMap = new Map();
  const byRequestChannelMap = new Map();
  const unknownChannelBreakdownMap = new Map();
  const dailyMap = new Map();
  const keyFileDailyMap = new Map();
  const keyFileTotals = emptyKeyFileCounts();
  const contextRows = [];

  const latency = {
    count: 0,
    sum: 0,
    min: Number.POSITIVE_INFINITY,
    max: 0,
    p95Max: 0,
  };
  const vectorLatency = {
    count: 0,
    sum: 0,
    min: Number.POSITIVE_INFINITY,
    max: 0,
    p95Max: 0,
  };

  for (const session of filtered) {
    mergeTotals(totals, session.totals);

    messages.total += session.messageCounts.total;
    messages.user += session.messageCounts.user;
    messages.assistant += session.messageCounts.assistant;
    messages.toolCalls += session.messageCounts.toolCalls;
    messages.toolResults += session.messageCounts.toolResults;
    messages.errors += session.messageCounts.errors;
    mergeRequestCounts(requests, session.requestCounts);
    vector.searchCalls += session.vector?.searchCalls ?? 0;
    vector.searchSuccess += session.vector?.searchSuccess ?? 0;
    vector.searchErrors += session.vector?.searchErrors ?? 0;
    vector.emptySearches += session.vector?.emptySearches ?? 0;
    vector.nonEmptySearches += session.vector?.nonEmptySearches ?? 0;
    vector.qmdBackedSearches += session.vector?.qmdBackedSearches ?? 0;
    vector.fallbackSearches += session.vector?.fallbackSearches ?? 0;
    vector.totalResults += session.vector?.totalResults ?? 0;
    vector.memoryGetCalls += session.vector?.memoryGetCalls ?? 0;
    vector.qmdMemoryGetCalls += session.vector?.qmdMemoryGetCalls ?? 0;
    for (const item of session.vector?.topQueries ?? []) {
      vector.topQueryMap.set(item.query, (vector.topQueryMap.get(item.query) ?? 0) + item.count);
    }
    for (const item of session.vector?.topPaths ?? []) {
      vector.topPathMap.set(item.path, (vector.topPathMap.get(item.path) ?? 0) + item.count);
    }
    for (const item of session.vector?.topCollections ?? []) {
      vector.topCollectionMap.set(
        item.collection,
        (vector.topCollectionMap.get(item.collection) ?? 0) + item.count,
      );
    }
    for (const item of session.vector?.providerModels ?? []) {
      vector.providerModelMap.set(
        item.providerModel,
        (vector.providerModelMap.get(item.providerModel) ?? 0) + item.count,
      );
    }
    if (session.vector?.latency?.count) {
      vectorLatency.count += session.vector.latency.count;
      vectorLatency.sum += session.vector.latency.avgMs * session.vector.latency.count;
      vectorLatency.min = Math.min(vectorLatency.min, session.vector.latency.minMs);
      vectorLatency.max = Math.max(vectorLatency.max, session.vector.latency.maxMs);
      vectorLatency.p95Max = Math.max(vectorLatency.p95Max, session.vector.latency.p95Ms);
    }

    if (session.latency?.count) {
      latency.count += session.latency.count;
      latency.sum += session.latency.avgMs * session.latency.count;
      latency.min = Math.min(latency.min, session.latency.minMs);
      latency.max = Math.max(latency.max, session.latency.maxMs);
      latency.p95Max = Math.max(latency.p95Max, session.latency.p95Ms);
    }

    for (const tool of session.toolUsage.tools) {
      toolsMap.set(tool.name, (toolsMap.get(tool.name) ?? 0) + tool.count);
    }

    for (const model of session.modelUsage) {
      const modelKey = `${model.provider ?? "unknown"}::${model.model ?? "unknown"}`;
      const modelRow =
        byModelMap.get(modelKey) ?? {
          provider: model.provider,
          model: model.model,
          count: 0,
          sessions: 0,
          totals: createTotals(),
        };
      modelRow.count += model.count;
      modelRow.sessions += 1;
      mergeTotals(modelRow.totals, model.totals);
      byModelMap.set(modelKey, modelRow);

      const providerKey = model.provider ?? "unknown";
      const providerRow =
        byProviderMap.get(providerKey) ?? {
          provider: model.provider,
          count: 0,
          sessions: 0,
          totals: createTotals(),
        };
      providerRow.count += model.count;
      providerRow.sessions += 1;
      mergeTotals(providerRow.totals, model.totals);
      byProviderMap.set(providerKey, providerRow);
    }

    const agentRow = byAgentMap.get(session.agentId) ?? {
      agentId: session.agentId,
      sessions: 0,
      totals: createTotals(),
    };
    agentRow.sessions += 1;
    mergeTotals(agentRow.totals, session.totals);
    byAgentMap.set(session.agentId, agentRow);

    const channelKey = session.channel ?? "unknown";
    const channelRow = byChannelMap.get(channelKey) ?? {
      channel: channelKey,
      sessions: 0,
      totals: createTotals(),
    };
    channelRow.sessions += 1;
    mergeTotals(channelRow.totals, session.totals);
    byChannelMap.set(channelKey, channelRow);

    const requestAgentRow =
      byRequestAgentMap.get(session.agentId) ??
      createRequestDimensionRow({ agentId: session.agentId });
    requestAgentRow.sessions += 1;
    applyRequestCountsToDimension(requestAgentRow, session.requestCounts, {
      tokens: session.totals.totalTokens,
      cost: session.totals.totalCost,
    });
    byRequestAgentMap.set(session.agentId, requestAgentRow);

    const requestChannelRow =
      byRequestChannelMap.get(channelKey) ??
      createRequestDimensionRow({ channel: channelKey });
    requestChannelRow.sessions += 1;
    applyRequestCountsToDimension(requestChannelRow, session.requestCounts, {
      tokens: session.totals.totalTokens,
      cost: session.totals.totalCost,
    });
    byRequestChannelMap.set(channelKey, requestChannelRow);
    if (!session.channel) {
      const type = guessUnknownSourceType(session);
      const unknownRow =
        unknownChannelBreakdownMap.get(type) ?? createUnknownBreakdownRow(type);
      unknownRow.sessions += 1;
      unknownRow.total += session.requestCounts?.total ?? 0;
      unknownRow.billable += session.requestCounts?.billable ?? 0;
      unknownRow.premium += session.requestCounts?.premium ?? 0;
      unknownRow.failed += session.requestCounts?.failed ?? 0;
      unknownChannelBreakdownMap.set(type, unknownRow);
    }

    for (const requestRow of session.requestUsage ?? []) {
      const modelKey = makeRequestModelKey(requestRow.provider, requestRow.model);
      const modelAgg =
        byRequestModelMap.get(modelKey) ??
        createRequestDimensionRow({
          provider: requestRow.provider ?? "unknown",
          model: requestRow.model ?? "unknown",
        });
      modelAgg.sessions += 1;
      applyRequestCountsToDimension(modelAgg, requestRow, {
        tokens: requestRow.tokens ?? 0,
        cost: requestRow.cost ?? 0,
      });
      byRequestModelMap.set(modelKey, modelAgg);

      const providerKey = requestRow.provider ?? "unknown";
      const providerAgg =
        byRequestProviderMap.get(providerKey) ??
        createRequestDimensionRow({
          provider: requestRow.provider ?? "unknown",
        });
      providerAgg.sessions += 1;
      applyRequestCountsToDimension(providerAgg, requestRow, {
        tokens: requestRow.tokens ?? 0,
        cost: requestRow.cost ?? 0,
      });
      byRequestProviderMap.set(providerKey, providerAgg);
    }

    for (const day of session.daily) {
      const daily =
        dailyMap.get(day.date) ?? {
          date: day.date,
          tokens: 0,
          cost: 0,
          messages: 0,
          requests: 0,
          premiumRequests: 0,
          requestErrors: 0,
          requestTimeouts: 0,
          requestCancelled: 0,
          vectorSearches: 0,
          vectorSearchErrors: 0,
          vectorResults: 0,
          qmdBackedSearches: 0,
          memoryGetCalls: 0,
          qmdMemoryGetCalls: 0,
          toolCalls: 0,
          errors: 0,
          latencyCount: 0,
          latencySum: 0,
          latencyMin: Number.POSITIVE_INFINITY,
          latencyMax: 0,
          latencyP95: 0,
        };
      daily.tokens += day.tokens;
      daily.cost += day.cost;
      daily.messages += day.messages;
      daily.requests += day.requests ?? 0;
      daily.premiumRequests += day.premiumRequests ?? 0;
      daily.requestErrors += day.requestErrors ?? 0;
      daily.requestTimeouts += day.requestTimeouts ?? 0;
      daily.requestCancelled += day.requestCancelled ?? 0;
      daily.vectorSearches += day.vectorSearches ?? 0;
      daily.vectorSearchErrors += day.vectorSearchErrors ?? 0;
      daily.vectorResults += day.vectorResults ?? 0;
      daily.qmdBackedSearches += day.qmdBackedSearches ?? 0;
      daily.memoryGetCalls += day.memoryGetCalls ?? 0;
      daily.qmdMemoryGetCalls += day.qmdMemoryGetCalls ?? 0;
      daily.toolCalls += day.toolCalls;
      daily.errors += day.errors;
      if (day.latency?.count) {
        daily.latencyCount += day.latency.count;
        daily.latencySum += day.latency.avgMs * day.latency.count;
        daily.latencyMin = Math.min(daily.latencyMin, day.latency.minMs);
        daily.latencyMax = Math.max(daily.latencyMax, day.latency.maxMs);
        daily.latencyP95 = Math.max(daily.latencyP95, day.latency.p95Ms);
      }
      dailyMap.set(day.date, daily);
    }

    for (const row of session.keyFiles?.daily ?? []) {
      const current = keyFileDailyMap.get(row.date) ?? emptyKeyFileCounts();
      mergeKeyFileCounts(current, row.counts);
      keyFileDailyMap.set(row.date, current);
    }
    for (const item of session.keyFiles?.totals ?? []) {
      if (!item?.key) {
        continue;
      }
      keyFileTotals[item.key] = (keyFileTotals[item.key] ?? 0) + (item.count ?? 0);
    }

    if (session.contextWeight?.systemPrompt?.chars) {
      contextRows.push({
        id: session.id,
        key: session.key,
        label: session.label,
        agentId: session.agentId,
        updatedAt: session.updatedAt,
        chars: session.contextWeight.systemPrompt.chars,
        projectChars: session.contextWeight.systemPrompt.projectContextChars,
        nonProjectChars: session.contextWeight.systemPrompt.nonProjectContextChars,
        skillsChars: session.contextWeight.skills?.promptChars ?? 0,
        toolsListChars: session.contextWeight.tools?.listChars ?? 0,
        toolsSchemaChars: session.contextWeight.tools?.schemaChars ?? 0,
      });
    }
  }

  const latencyStats =
    latency.count > 0
      ? {
          count: latency.count,
          avgMs: latency.sum / latency.count,
          minMs: latency.min,
          maxMs: latency.max,
          p95Ms: latency.p95Max,
        }
      : null;

  const daily = Array.from(dailyMap.values())
    .map((day) => ({
      date: day.date,
      tokens: day.tokens,
      cost: day.cost,
      messages: day.messages,
      requests: day.requests,
      premiumRequests: day.premiumRequests,
      requestErrors: day.requestErrors,
      requestTimeouts: day.requestTimeouts,
      requestCancelled: day.requestCancelled,
      requestErrorRatePct: day.requests > 0 ? (day.requestErrors / day.requests) * 100 : 0,
      vectorSearches: day.vectorSearches,
      vectorSearchErrors: day.vectorSearchErrors,
      vectorResults: day.vectorResults,
      qmdBackedSearches: day.qmdBackedSearches,
      memoryGetCalls: day.memoryGetCalls,
      qmdMemoryGetCalls: day.qmdMemoryGetCalls,
      toolCalls: day.toolCalls,
      errors: day.errors,
      latency:
        day.latencyCount > 0
          ? {
              count: day.latencyCount,
              avgMs: day.latencySum / day.latencyCount,
              minMs: day.latencyMin,
              maxMs: day.latencyMax,
              p95Ms: day.latencyP95,
            }
          : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const requestStats = {
    ...requests,
    successRatePct: requests.total > 0 ? (requests.success / requests.total) * 100 : 0,
    failureRatePct: requests.total > 0 ? (requests.failed / requests.total) * 100 : 0,
    premiumSharePct: requests.total > 0 ? (requests.premium / requests.total) * 100 : 0,
    billableRatePct: requests.total > 0 ? (requests.billable / requests.total) * 100 : 0,
  };

  const vectorStats = {
    searchCalls: vector.searchCalls,
    searchSuccess: vector.searchSuccess,
    searchErrors: vector.searchErrors,
    emptySearches: vector.emptySearches,
    nonEmptySearches: vector.nonEmptySearches,
    qmdBackedSearches: vector.qmdBackedSearches,
    fallbackSearches: vector.fallbackSearches,
    totalResults: vector.totalResults,
    memoryGetCalls: vector.memoryGetCalls,
    qmdMemoryGetCalls: vector.qmdMemoryGetCalls,
    avgResultsPerSearch: vector.searchCalls > 0 ? vector.totalResults / vector.searchCalls : 0,
    qmdBackedRatePct:
      vector.searchCalls > 0 ? (vector.qmdBackedSearches / vector.searchCalls) * 100 : 0,
    searchErrorRatePct:
      vector.searchCalls > 0 ? (vector.searchErrors / vector.searchCalls) * 100 : 0,
    searchSuccessRatePct:
      vector.searchCalls > 0 ? (vector.searchSuccess / vector.searchCalls) * 100 : 0,
    latency:
      vectorLatency.count > 0
        ? {
            count: vectorLatency.count,
            avgMs: vectorLatency.sum / vectorLatency.count,
            minMs: vectorLatency.min,
            maxMs: vectorLatency.max,
            p95Ms: vectorLatency.p95Max,
          }
        : null,
    topQueries: mapTopEntries(vector.topQueryMap, 16).map((item) => ({
      query: item.key,
      count: item.count,
    })),
    topPaths: mapTopEntries(vector.topPathMap, 20).map((item) => ({
      path: item.key,
      count: item.count,
    })),
    topCollections: mapTopEntries(vector.topCollectionMap, 16).map((item) => ({
      collection: item.key,
      count: item.count,
    })),
    providerModels: mapTopEntries(vector.providerModelMap, 16).map((item) => ({
      providerModel: item.key,
      count: item.count,
    })),
  };

  const sortRequestRows = (a, b) =>
    b.total - a.total || b.premium - a.premium || b.cost - a.cost || b.tokens - a.tokens;
  const keyFilesDaily = Array.from(keyFileDailyMap.entries())
    .map(([date, counts]) => ({
      date,
      counts,
      total: KEY_FILE_DEFINITIONS.reduce((sum, item) => sum + (counts[item.key] ?? 0), 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const keyFilesTotals = KEY_FILE_DEFINITIONS.map((item) => ({
    key: item.key,
    label: item.label,
    count: keyFileTotals[item.key] ?? 0,
  }));

  return {
    filtered,
    totals,
    messages,
    requests: requestStats,
    vector: vectorStats,
    keyFiles: {
      totals: keyFilesTotals,
      daily: keyFilesDaily,
      totalHits: keyFilesTotals.reduce((sum, item) => sum + item.count, 0),
    },
    latency: latencyStats,
    aggregates: {
      daily,
      tools: Array.from(toolsMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      byModel: Array.from(byModelMap.values()).sort(sortByCostThenTokens),
      byProvider: Array.from(byProviderMap.values()).sort((a, b) =>
        sortByCostThenTokens(a, b),
      ),
      byAgent: Array.from(byAgentMap.values()).sort((a, b) =>
        sortByCostThenTokens(a, b),
      ),
      byChannel: Array.from(byChannelMap.values()).sort((a, b) =>
        sortByCostThenTokens(a, b),
      ),
      byRequestModel: Array.from(byRequestModelMap.values()).sort(sortRequestRows),
      byRequestProvider: Array.from(byRequestProviderMap.values()).sort(sortRequestRows),
      byRequestAgent: Array.from(byRequestAgentMap.values()).sort(sortRequestRows),
      byRequestChannel: Array.from(byRequestChannelMap.values()).sort(sortRequestRows),
      unknownChannelBreakdown: Array.from(unknownChannelBreakdownMap.values()).sort((a, b) =>
        b.total - a.total || b.sessions - a.sessions,
      ),
      context: contextRows.sort((a, b) => b.chars - a.chars),
    },
  };
}

function resolveStateDir(inputStateDir) {
  if (inputStateDir) {
    return path.resolve(inputStateDir);
  }
  if (process.env.OPENCLAW_STATE_DIR) {
    return path.resolve(process.env.OPENCLAW_STATE_DIR);
  }
  return path.join(os.homedir(), ".openclaw");
}

function resolveWorkspaceDir(inputWorkspaceDir, stateDir) {
  if (inputWorkspaceDir) {
    return path.resolve(inputWorkspaceDir);
  }
  if (process.env.OPENCLAW_WORKSPACE_DIR) {
    return path.resolve(process.env.OPENCLAW_WORKSPACE_DIR);
  }
  return path.join(stateDir, "workspace");
}

function resolvePremiumPattern(inputPattern) {
  const value =
    typeof inputPattern === "string" && inputPattern.trim()
      ? inputPattern.trim()
      : typeof process.env.OPENCLAW_PREMIUM_MODEL_PATTERN === "string" &&
          process.env.OPENCLAW_PREMIUM_MODEL_PATTERN.trim()
        ? process.env.OPENCLAW_PREMIUM_MODEL_PATTERN.trim()
        : null;
  if (!value) {
    return null;
  }
  try {
    return new RegExp(value, "i");
  } catch {
    return null;
  }
}

function resolveQuotaLimits(options = {}) {
  const totalLimit = asPositiveInt(options.requestQuota ?? process.env.OPENCLAW_REQUEST_QUOTA);
  const premiumLimit = asPositiveInt(options.premiumQuota ?? process.env.OPENCLAW_PREMIUM_REQUEST_QUOTA);
  return {
    totalLimit,
    premiumLimit,
  };
}

function buildQuotaSummary({ limits, requests }) {
  const totalUsed = requests?.billable ?? requests?.total ?? 0;
  const premiumUsed = requests?.premium ?? 0;
  const totalRemaining =
    typeof limits.totalLimit === "number" ? Math.max(0, limits.totalLimit - totalUsed) : null;
  const premiumRemaining =
    typeof limits.premiumLimit === "number"
      ? Math.max(0, limits.premiumLimit - premiumUsed)
      : null;
  const totalUsagePct =
    typeof limits.totalLimit === "number" && limits.totalLimit > 0
      ? (totalUsed / limits.totalLimit) * 100
      : null;
  const premiumUsagePct =
    typeof limits.premiumLimit === "number" && limits.premiumLimit > 0
      ? (premiumUsed / limits.premiumLimit) * 100
      : null;
  return {
    ...limits,
    totalUsed,
    premiumUsed,
    totalRemaining,
    premiumRemaining,
    totalUsagePct,
    premiumUsagePct,
    totalExceeded:
      typeof limits.totalLimit === "number" ? totalUsed > limits.totalLimit : false,
    premiumExceeded:
      typeof limits.premiumLimit === "number" ? premiumUsed > limits.premiumLimit : false,
  };
}

async function listAgents(stateDir) {
  const agentsDir = path.join(stateDir, "agents");
  let entries = [];
  try {
    entries = await fsp.readdir(agentsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function collectSessionsFromState({ stateDir, range, timelineLimit, premiumPattern }) {
  const agents = await listAgents(stateDir);
  const sessions = [];

  for (const agentId of agents) {
    const sessionsDir = path.join(stateDir, "agents", agentId, "sessions");
    let files = [];
    try {
      files = await fsp.readdir(sessionsDir, { withFileTypes: true });
    } catch {
      continue;
    }

    const storeIndex = buildStoreIndex(sessionsDir);
    const sessionFiles = files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    for (const fileName of sessionFiles) {
      const filePath = path.join(sessionsDir, fileName);
      try {
        const summary = await parseSessionFile({
          filePath,
          fileName,
          agentId,
          storeIndex,
          range,
          timelineLimit,
          premiumPattern,
        });
        sessions.push(summary);
      } catch {
        // Skip malformed transcripts but keep the collection run healthy.
      }
    }
  }

  sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return { agents, sessions };
}

export async function collectOpenClawMetrics(options = {}) {
  const stateDir = resolveStateDir(options.stateDir);
  const workspaceDir = resolveWorkspaceDir(options.workspaceDir, stateDir);

  const daysInput = options.days;
  const numericDays =
    daysInput === "all"
      ? undefined
      : typeof daysInput === "number"
        ? daysInput
        : typeof daysInput === "string" && daysInput.trim() !== ""
          ? Number(daysInput)
          : 30;
  const days = Number.isFinite(numericDays) && numericDays > 0 ? numericDays : undefined;

  const endMs = Date.now();
  const startMs = days ? endMs - days * DAY_MS : Number.NEGATIVE_INFINITY;

  const range = {
    days: days ?? "all",
    startMs,
    endMs,
    startIso: Number.isFinite(startMs) ? new Date(startMs).toISOString() : null,
    endIso: new Date(endMs).toISOString(),
  };

  const timelineLimit =
    Number.isFinite(options.timelineLimit) && options.timelineLimit > 0 ? options.timelineLimit : 240;
  const premiumPattern = resolvePremiumPattern(options.premiumModelPattern);
  const { sessions, agents } = await collectSessionsFromState({
    stateDir,
    range,
    timelineLimit,
    premiumPattern,
  });

  const filter = {
    agent: typeof options.agent === "string" && options.agent ? options.agent : null,
    channel: typeof options.channel === "string" && options.channel ? options.channel : null,
  };

  const aggregated = aggregateSessions({ sessions, filter });
  const memory = await collectMemoryStats({
    workspaceDir,
    memoryLimit: Number.isFinite(options.memoryLimit) ? options.memoryLimit : 100,
  });

  const sessionLimit =
    Number.isFinite(options.sessionLimit) && options.sessionLimit > 0 ? options.sessionLimit : 250;

  const topSessions = aggregated.filtered.slice(0, sessionLimit);

  const filterOptions = {
    agents,
    channels: Array.from(new Set(sessions.map((s) => s.channel).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    ),
  };

  const anomalies = buildAnomalies({
    daily: aggregated.aggregates.daily,
    sessions: aggregated.filtered,
    latency: aggregated.latency,
    requests: aggregated.requests,
    vector: aggregated.vector,
  });

  const quota = buildQuotaSummary({
    limits: resolveQuotaLimits(options),
    requests: aggregated.requests,
  });

  const alerts = buildAlerts({
    totals: aggregated.totals,
    messages: aggregated.messages,
    requests: aggregated.requests,
    vector: aggregated.vector,
    sessions: aggregated.filtered,
    memory,
    anomalies,
    quota,
  });

  return {
    generatedAt: Date.now(),
    stateDir,
    workspaceDir,
    range,
    filters: {
      selected: filter,
      options: filterOptions,
    },
    summary: {
      sessionsScanned: sessions.length,
      sessionsInScope: aggregated.filtered.length,
      totalTokens: aggregated.totals.totalTokens,
      totalCost: aggregated.totals.totalCost,
      metadataCost: aggregated.totals.metadataCostTotal,
      estimatedCost: aggregated.totals.estimatedCostTotal,
      metadataCostEntries: aggregated.totals.metadataCostEntries,
      estimatedCostEntries: aggregated.totals.estimatedCostEntries,
      missingCostEntries: aggregated.totals.missingCostEntries,
      costCoveragePct:
        aggregated.totals.metadataCostEntries + aggregated.totals.estimatedCostEntries > 0
          ? (aggregated.totals.metadataCostEntries /
              (aggregated.totals.metadataCostEntries + aggregated.totals.estimatedCostEntries)) *
            100
          : 0,
      totalRequests: aggregated.requests.total,
      billableRequests: aggregated.requests.billable,
      premiumRequests: aggregated.requests.premium,
      requestFailureRatePct: aggregated.requests.failureRatePct,
      requestSuccessRatePct: aggregated.requests.successRatePct,
      cacheReadSharePct:
        aggregated.totals.totalTokens > 0
          ? (aggregated.totals.cacheRead / aggregated.totals.totalTokens) * 100
          : 0,
      errorRatePct:
        aggregated.messages.total > 0
          ? (aggregated.messages.errors / aggregated.messages.total) * 100
          : 0,
      vectorSearches: aggregated.vector.searchCalls,
      vectorSearchErrorRatePct: aggregated.vector.searchErrorRatePct,
      qmdBackedRatePct: aggregated.vector.qmdBackedRatePct,
      avgLatencyMs: aggregated.latency?.avgMs ?? null,
      p95LatencyMs: aggregated.latency?.p95Ms ?? null,
      keyFileAccessHits: aggregated.keyFiles?.totalHits ?? 0,
    },
    totals: aggregated.totals,
    cost: {
      pricingVersion: MODEL_PRICING_VERSION,
      metadataCostTotal: aggregated.totals.metadataCostTotal,
      estimatedCostTotal: aggregated.totals.estimatedCostTotal,
      metadataCostEntries: aggregated.totals.metadataCostEntries,
      estimatedCostEntries: aggregated.totals.estimatedCostEntries,
      missingCostEntries: aggregated.totals.missingCostEntries,
      metadataSharePct:
        aggregated.totals.totalCost > 0
          ? (aggregated.totals.metadataCostTotal / aggregated.totals.totalCost) * 100
          : 0,
      estimatedSharePct:
        aggregated.totals.totalCost > 0
          ? (aggregated.totals.estimatedCostTotal / aggregated.totals.totalCost) * 100
          : 0,
      activePricingProfiles: MODEL_PRICING_CATALOG.map((item) => item.id),
    },
    messages: aggregated.messages,
    requests: aggregated.requests,
    vector: aggregated.vector,
    keyFiles: aggregated.keyFiles,
    quota,
    latency: aggregated.latency,
    aggregates: aggregated.aggregates,
    sessions: topSessions,
    memory,
    anomalies,
    alerts,
  };
}

function asNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function compactInt(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  return Math.round(value).toLocaleString("en-US");
}

function compactTokens(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(Math.round(value));
}

function compactPct(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0.0%";
  }
  return `${value.toFixed(1)}%`;
}

function compactUsd(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "$0.0000";
  }
  return `$${value.toFixed(4)}`;
}

function compactMs(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`;
  }
  return `${Math.round(value)}ms`;
}

export function buildCommandText(payload, options = {}) {
  const command = typeof options.command === "string" ? options.command.trim().toLowerCase() : "summary";
  const maxItems = Math.max(1, asNumber(options.maxItems, 6));
  const isZh = typeof options.lang === "string" && options.lang.toLowerCase().startsWith("zh");
  const L = (zh, en) => (isZh ? zh : en);
  const locale = isZh ? "zh-CN" : "en-US";
  const range = payload?.range?.days ?? "30";
  const summary = payload?.summary ?? {};
  const requests = payload?.requests ?? {};
  const vector = payload?.vector ?? {};
  const quota = payload?.quota ?? {};
  const cost = payload?.cost ?? {};
  const unknownBreakdown = Array.isArray(payload?.aggregates?.unknownChannelBreakdown)
    ? payload.aggregates.unknownChannelBreakdown
    : [];
  const generatedAt =
    typeof payload?.generatedAt === "number"
      ? new Date(payload.generatedAt).toLocaleString(locale)
      : "-";

  if (command === "quota") {
    const lines = [
      `${L("OpenClaw 配额", "OpenClaw Quota")} (${range}d)`,
      `${L("请求", "Requests")}: ${compactInt(quota.totalUsed)} / ${quota.totalLimit ?? L("不限", "unlimited")} (${compactPct(quota.totalUsagePct ?? 0)})`,
      `${L("高级", "Premium")}: ${compactInt(quota.premiumUsed)} / ${quota.premiumLimit ?? L("不限", "unlimited")} (${compactPct(quota.premiumUsagePct ?? 0)})`,
      `${L("剩余", "Remaining")}: ${L("总量", "total")} ${quota.totalRemaining ?? "∞"} · ${L("高级", "premium")} ${quota.premiumRemaining ?? "∞"}`,
      `${L("生成时间", "Generated")}: ${generatedAt}`,
    ];
    return lines.join("\n");
  }

  if (command === "qmd") {
    const topCollections = (vector.topCollections ?? [])
      .slice(0, maxItems)
      .map((item) => `${item.collection}(${compactInt(item.count)})`)
      .join(", ");
    const topQueries = (vector.topQueries ?? [])
      .slice(0, maxItems)
      .map((item) => `${item.query}(${compactInt(item.count)})`)
      .join(" | ");
    const lines = [
      `${L("OpenClaw QMD/向量", "OpenClaw QMD/Vector")} (${range}d)`,
      `${L("检索", "Searches")}: ${compactInt(vector.searchCalls)} · QMD-backed ${compactPct(vector.qmdBackedRatePct)}`,
      `${L("错误率", "Errors")}: ${compactPct(vector.searchErrorRatePct)} · ${L("平均结果数", "Avg results")} ${Number(vector.avgResultsPerSearch ?? 0).toFixed(2)}`,
      `${L("延迟", "Latency")}: avg ${compactMs(vector.latency?.avgMs)} · p95 ${compactMs(vector.latency?.p95Ms)}`,
      `memory_get: ${compactInt(vector.memoryGetCalls)} · qmd path ${compactInt(vector.qmdMemoryGetCalls)}`,
      `${L("Top collections", "Top collections")}: ${topCollections || "-"}`,
      `${L("Top queries", "Top queries")}: ${topQueries || "-"}`,
      `${L("生成时间", "Generated")}: ${generatedAt}`,
    ];
    return lines.join("\n");
  }

  if (command === "alerts") {
    const alerts = (payload?.alerts ?? []).slice(0, Math.max(maxItems, 3));
    const lines = [`${L("OpenClaw 告警", "OpenClaw Alerts")} (${range}d)`];
    if (!alerts.length) {
      lines.push(L("当前无活跃告警。", "No active alerts."));
    } else {
      for (const alert of alerts) {
        lines.push(`- [${alert.level ?? "info"}] ${alert.title}: ${alert.message}`);
      }
    }
    lines.push(`${L("生成时间", "Generated")}: ${generatedAt}`);
    return lines.join("\n");
  }

  if (command === "daily") {
    const dailyRows = (payload?.aggregates?.daily ?? []).slice(-Math.max(maxItems, 7));
    const lines = [`${L("OpenClaw 每日", "OpenClaw Daily")} (${range}d)`];
    for (const row of dailyRows) {
      lines.push(
        `${row.date}: req ${compactInt(row.requests)} (${compactPct(row.requestErrorRatePct)}) · tok ${compactTokens(row.tokens)} · qmd ${compactInt(row.qmdBackedSearches)}/${compactInt(row.vectorSearches)}`,
      );
    }
    lines.push(`${L("生成时间", "Generated")}: ${generatedAt}`);
    return lines.join("\n");
  }

  if (command === "weekly") {
    const topAlerts = (payload?.alerts ?? []).slice(0, Math.max(2, maxItems));
    const dailyRows = (payload?.aggregates?.daily ?? []).slice(-7);
    const weeklyRequests = dailyRows.reduce((sum, row) => sum + (row.requests ?? 0), 0);
    const weeklyTokens = dailyRows.reduce((sum, row) => sum + (row.tokens ?? 0), 0);
    const weeklyQmdBacked = dailyRows.reduce((sum, row) => sum + (row.qmdBackedSearches ?? 0), 0);
    const weeklyVector = dailyRows.reduce((sum, row) => sum + (row.vectorSearches ?? 0), 0);
    const lines = [
      `${L("OpenClaw 智能周报", "OpenClaw Weekly Brief")} (${range}d)`,
      `${L("请求", "Requests")}: ${compactInt(weeklyRequests)} · ${L("Tokens", "Tokens")}: ${compactTokens(weeklyTokens)} · ${L("成本", "Cost")}: ${compactUsd(summary.totalCost)}`,
      `${L("成本口径", "Cost basis")}: ${L("元数据", "metadata")} ${compactPct(cost.metadataSharePct ?? 0)} · ${L("估算", "estimated")} ${compactPct(cost.estimatedSharePct ?? 0)}`,
      `${L("延迟", "Latency")}: avg ${compactMs(summary.avgLatencyMs)} · p95 ${compactMs(summary.p95LatencyMs)} · ${L("失败率", "Request fail")} ${compactPct(summary.requestFailureRatePct)}`,
      `${L("QMD 覆盖率", "QMD coverage")}: ${compactPct(weeklyVector > 0 ? (weeklyQmdBacked / weeklyVector) * 100 : summary.qmdBackedRatePct)} (${compactInt(weeklyQmdBacked)}/${compactInt(weeklyVector)})`,
      `${L("关键文件访问", "Key files touched")}: ${compactInt(summary.keyFileAccessHits ?? 0)} (AGENT/TOOLS/SOUL/Memory)`,
    ];
    if (unknownBreakdown.length > 0) {
      const top = unknownBreakdown[0];
      const label = isZh ? top.labelZh ?? top.label ?? top.type : top.label ?? top.type;
      lines.push(
        `${L("Unknown 细分", "Unknown breakdown")}: ${label} ${compactInt(top.total ?? 0)} (${L("会话", "sessions")} ${compactInt(top.sessions ?? 0)})`,
      );
    }
    if (topAlerts.length) {
      lines.push(L("重点关注:", "Focus:"));
      for (const alert of topAlerts) {
        lines.push(`- [${alert.level ?? "info"}] ${alert.title}: ${alert.message}`);
      }
    } else {
      lines.push(L("重点关注: 当前无活跃运维告警。", "Focus: no active operational alerts."));
    }
    lines.push(`${L("生成时间", "Generated")}: ${generatedAt}`);
    return lines.join("\n");
  }

  if (command === "help") {
    return [
      L("OpenClaw 命令视图:", "OpenClaw command views:"),
      "- summary",
      "- qmd",
      "- alerts",
      "- daily",
      "- weekly",
      L("示例: node collector.mjs --command summary --days 7", "Example: node collector.mjs --command summary --days 7"),
    ].join("\n");
  }

  const lines = [
    `${L("OpenClaw 摘要", "OpenClaw Summary")} (${range}d)`,
    `${L("请求", "Requests")}: ${compactInt(summary.totalRequests)} (${L("计费", "billable")} ${compactInt(summary.billableRequests)} · ${L("高级", "premium")} ${compactInt(summary.premiumRequests)} · ${L("失败", "fail")} ${compactPct(summary.requestFailureRatePct)})`,
    `${L("Tokens", "Tokens")}: ${compactTokens(summary.totalTokens)} · ${L("成本", "Cost")} ${compactUsd(summary.totalCost)}`,
    `${L("成本口径", "Cost basis")}: ${L("元数据", "metadata")} ${compactPct(cost.metadataSharePct ?? 0)} · ${L("估算", "estimated")} ${compactPct(cost.estimatedSharePct ?? 0)}`,
    `${L("延迟", "Latency")}: avg ${compactMs(summary.avgLatencyMs)} · p95 ${compactMs(summary.p95LatencyMs)}`,
    `Vector/QMD: ${compactInt(summary.vectorSearches)} searches · qmd ${compactPct(summary.qmdBackedRatePct)} · err ${compactPct(summary.vectorSearchErrorRatePct)}`,
    unknownBreakdown.length > 0
      ? (() => {
          const top = unknownBreakdown[0];
          const label = isZh ? top.labelZh ?? top.label ?? top.type : top.label ?? top.type;
          return `${L("Unknown 细分", "Unknown breakdown")}: ${label} ${compactInt(top.total ?? 0)} (${L("会话", "sessions")} ${compactInt(top.sessions ?? 0)})`;
        })()
      : `${L("Unknown 细分", "Unknown breakdown")}: ${L("无", "none")}`,
    `${L("生成时间", "Generated")}: ${generatedAt}`,
  ];
  return lines.join("\n");
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`OpenClaw Observatory Collector\n\nUsage:\n  node collector.mjs [--state-dir <path>] [--workspace-dir <path>] [--days <n|all>] [--agent <id>] [--channel <name>] [--session-limit <n>] [--memory-limit <n>] [--timeline-limit <n>] [--command <summary|qmd|alerts|daily|weekly|help>] [--lang <zh|en>] [--max-items <n>] [--out <file>] [--pretty]\n`);
    process.exit(0);
  }

  const payload = await collectOpenClawMetrics({
    stateDir: typeof args["state-dir"] === "string" ? args["state-dir"] : undefined,
    workspaceDir:
      typeof args["workspace-dir"] === "string" ? args["workspace-dir"] : undefined,
    days: typeof args.days === "string" ? args.days : undefined,
    agent: typeof args.agent === "string" ? args.agent : undefined,
    channel: typeof args.channel === "string" ? args.channel : undefined,
    sessionLimit: asNumber(args["session-limit"], 250),
    memoryLimit: asNumber(args["memory-limit"], 100),
    timelineLimit: asNumber(args["timeline-limit"], 240),
    requestQuota: asNumber(args["request-quota"], NaN),
    premiumQuota: asNumber(args["premium-quota"], NaN),
    premiumModelPattern:
      typeof args["premium-model-pattern"] === "string"
        ? args["premium-model-pattern"]
        : undefined,
  });

  const command = typeof args.command === "string" ? args.command : null;
  if (command) {
    const text = buildCommandText(payload, {
      command,
      maxItems: asNumber(args["max-items"], 6),
      lang: typeof args.lang === "string" ? args.lang : undefined,
    });
    const outFile = typeof args.out === "string" ? args.out : null;
    if (outFile) {
      await fsp.writeFile(path.resolve(outFile), `${text}\n`, "utf8");
      console.log(`Wrote command snapshot to ${path.resolve(outFile)}`);
      return;
    }
    process.stdout.write(`${text}\n`);
    return;
  }

  const pretty = Boolean(args.pretty);
  const output = JSON.stringify(payload, null, pretty ? 2 : 0);
  const outFile = typeof args.out === "string" ? args.out : null;
  if (outFile) {
    await fsp.writeFile(path.resolve(outFile), output, "utf8");
    console.log(`Wrote metrics snapshot to ${path.resolve(outFile)}`);
    return;
  }
  process.stdout.write(`${output}\n`);
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
