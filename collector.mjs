#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
const STOP_REASON_ERRORS = new Set(["error", "aborted", "cancelled", "timeout"]);
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

function toFinite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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

function extractToolDetails(message) {
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
      if (block.type === "tool_use") {
        const name = typeof block.name === "string" ? block.name.trim() : "";
        if (name) {
          names.push(name);
        }
      }
      if (block.type === "tool_result") {
        results += 1;
        if (block.is_error === true) {
          errors += 1;
        }
      }
    }
  }

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
    if (block.type === "text" && typeof block.text === "string") {
      const text = block.text.trim();
      if (text) {
        chunks.push(text);
      }
      continue;
    }
    if (block.type === "tool_use") {
      const name = typeof block.name === "string" ? block.name : "tool";
      chunks.push(`[tool:${name}]`);
      continue;
    }
    if (block.type === "tool_result") {
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
    missingCostEntries: 0,
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
    return;
  }
  totals.missingCostEntries += 1;
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
  const { filePath, fileName, agentId, storeIndex, range, timelineLimit = 240 } = params;
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

  const toolMap = new Map();
  const modelMap = new Map();
  const dailyMap = new Map();
  const dailyLatencies = new Map();
  const latencyValues = [];
  const preview = [];
  const timeline = [];
  const waterfall = [];
  const activityDates = new Set();

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

    const tools = extractToolDetails(message);
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
      } else {
        const rawCostTotal =
          toFinite(record.costTotal) ??
          toFinite(message.costTotal) ??
          toFinite(asRecord(record.cost)?.total) ??
          toFinite(asRecord(message.cost)?.total);
        applyCostTotal(totals, rawCostTotal);
        applyCostTotal(modelBucket.totals, rawCostTotal);
        if (dayBucket && typeof rawCostTotal === "number") {
          dayBucket.cost += rawCostTotal;
        }
        if (typeof rawCostTotal === "number") {
          entryCostTotal = rawCostTotal;
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
        durationMs: typeof durationMs === "number" ? durationMs : null,
        toolCalls: tools.names.length,
        toolResults: tools.results,
        isError: entryIsError,
        stopReason: stopReason ?? null,
        text: trimSnippet(extractText(message.content), 140),
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
        error: entryIsError,
      });
    }

    if (dayBucket) {
      dailyMap.set(dayBucket.date, dayBucket);
    }

    if (role) {
      const text = trimSnippet(extractText(message.content));
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
    toolUsage,
    modelUsage,
    latency,
    daily,
    contextWeight,
    systemPromptReport: entry?.systemPromptReport ?? null,
    memoryFlushAt: toFinite(entry?.memoryFlushAt),
    memoryFlushCompactionCount: toFinite(entry?.memoryFlushCompactionCount),
    modelOverride: typeof entry?.modelOverride === "string" ? entry.modelOverride : undefined,
    providerOverride:
      typeof entry?.providerOverride === "string" ? entry.providerOverride : undefined,
    preview,
    timeline: timelineTail,
    waterfall: waterfallTail,
    modelSwitches,
    uniqueModels: uniqueModelKeys.size,
    activityDates: Array.from(activityDates).sort((a, b) => a.localeCompare(b)),
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

function buildAnomalies({ daily, sessions, latency }) {
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

  return {
    tokenSpikes,
    latencyJitter,
    modelSwitching,
  };
}

function buildAlerts({ totals, messages, sessions, memory, anomalies }) {
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

  const toolsMap = new Map();
  const byModelMap = new Map();
  const byProviderMap = new Map();
  const byAgentMap = new Map();
  const byChannelMap = new Map();
  const dailyMap = new Map();
  const contextRows = [];

  const latency = {
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

    for (const day of session.daily) {
      const daily =
        dailyMap.get(day.date) ?? {
          date: day.date,
          tokens: 0,
          cost: 0,
          messages: 0,
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

  return {
    filtered,
    totals,
    messages,
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

async function collectSessionsFromState({ stateDir, range, timelineLimit }) {
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

  const { sessions, agents } = await collectSessionsFromState({ stateDir, range, timelineLimit });

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
  });

  const alerts = buildAlerts({
    totals: aggregated.totals,
    messages: aggregated.messages,
    sessions: aggregated.filtered,
    memory,
    anomalies,
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
      cacheReadSharePct:
        aggregated.totals.totalTokens > 0
          ? (aggregated.totals.cacheRead / aggregated.totals.totalTokens) * 100
          : 0,
      errorRatePct:
        aggregated.messages.total > 0
          ? (aggregated.messages.errors / aggregated.messages.total) * 100
          : 0,
      avgLatencyMs: aggregated.latency?.avgMs ?? null,
      p95LatencyMs: aggregated.latency?.p95Ms ?? null,
    },
    totals: aggregated.totals,
    messages: aggregated.messages,
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

async function runCli() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`OpenClaw Observatory Collector\n\nUsage:\n  node collector.mjs [--state-dir <path>] [--workspace-dir <path>] [--days <n|all>] [--agent <id>] [--channel <name>] [--session-limit <n>] [--memory-limit <n>] [--timeline-limit <n>] [--out <file>] [--pretty]\n`);
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
  });

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
