const els = {
  days: document.getElementById("daysSelect"),
  agent: document.getElementById("agentSelect"),
  channel: document.getElementById("channelSelect"),
  lang: document.getElementById("langSelect"),
  requestQuota: document.getElementById("requestQuotaInput"),
  premiumQuota: document.getElementById("premiumQuotaInput"),
  refresh: document.getElementById("refreshBtn"),
  cards: document.getElementById("kpiCards"),
  weeklyMeta: document.getElementById("weeklyMeta"),
  weeklyBrief: document.getElementById("weeklyBrief"),
  trend: document.getElementById("trendChart"),
  trendMeta: document.getElementById("trendMeta"),
  requestTrend: document.getElementById("requestTrendChart"),
  requestTrendMeta: document.getElementById("requestTrendMeta"),
  requestHealth: document.getElementById("requestHealthChart"),
  requestHealthMeta: document.getElementById("requestHealthMeta"),
  keyFileMeta: document.getElementById("keyFileMeta"),
  keyFileChart: document.getElementById("keyFileChart"),
  keyFileStats: document.getElementById("keyFileStats"),
  quotaMeta: document.getElementById("quotaMeta"),
  quotaCards: document.getElementById("quotaCards"),
  vectorMeta: document.getElementById("vectorMeta"),
  vectorStats: document.getElementById("vectorStats"),
  vectorCollections: document.getElementById("vectorCollections"),
  latency: document.getElementById("latencyChart"),
  latencyMeta: document.getElementById("latencyMeta"),
  models: document.getElementById("modelsList"),
  tools: document.getElementById("toolsList"),
  requestModels: document.getElementById("requestModelsList"),
  requestChannels: document.getElementById("requestChannelsList"),
  sessionCount: document.getElementById("sessionCount"),
  sessionsBody: document.querySelector("#sessionsTable tbody"),
  inspector: document.getElementById("sessionInspector"),
  memoryMeta: document.getElementById("memoryMeta"),
  memoryStats: document.getElementById("memoryStats"),
  memoryKeywords: document.getElementById("memoryKeywords"),
  memoryFiles: document.getElementById("memoryFiles"),
  anomalyList: document.getElementById("anomalyList"),
  modelSwitchMeta: document.getElementById("modelSwitchMeta"),
  modelSwitchList: document.getElementById("modelSwitchList"),
  commandPreview: document.getElementById("commandPreview"),
  commandButtons: Array.from(document.querySelectorAll(".cmd-btn")),
  alerts: document.getElementById("alerts"),
  generatedAt: document.getElementById("generatedAt"),
};

const state = {
  data: null,
  selectedSessionId: null,
  inFlight: false,
  commandMode: "summary",
  lang: "zh",
};

const I18N = {
  en: {
    "hero.eyebrow": "OpenClaw Metrics Console",
    "hero.title": "Observatory Dashboard",
    "hero.sub": "Tokens, latency, tools, model mix, and memory footprint in one place.",
    "label.window": "Window",
    "label.agent": "Agent",
    "label.channel": "Channel",
    "label.language": "Language",
    "label.requestQuota": "Request Quota",
    "label.premiumQuota": "Premium Quota",
    "action.refresh": "Refresh",
    "action.loading": "Loading…",
    "placeholder.unlimited": "Unlimited",
    "weekly.title": "Intelligent Weekly Brief",
    "chart.tokenCost": "Daily Token + Cost Trend",
    "chart.latency": "Response Latency",
    "chart.requestVolume": "Request Volume",
    "chart.requestReliability": "Request Reliability",
    "chart.quota": "Quota and Budget",
    "chart.qmd": "QMD and Vector Retrieval",
    "chart.topModels": "Top Models",
    "chart.topTools": "Top Tools",
    "chart.requestByModel": "Request by Model",
    "chart.requestByChannel": "Request by Channel",
    "chart.keyFileTrend": "Key File Daily Access",
    "chart.keyFileRank": "Key File Access Ranking",
    "session.title": "Sessions",
    "table.session": "Session",
    "table.agent": "Agent",
    "table.tokens": "Tokens",
    "table.cost": "Cost",
    "table.latency": "Latency",
    "table.updated": "Updated",
    "session.inspector": "Session Inspector",
    "session.clickRow": "Click a row",
    "session.none": "No session selected.",
    "command.title": "Bot Command Preview",
    "command.meta": "Telegram / Discord short command response",
    "command.loading": "Loading command preview…",
    "memory.footprint": "Memory Footprint",
    "memory.latestFiles": "Latest Memory Files",
    "anomaly.title": "Anomaly Radar",
    "anomaly.meta": "Token spike · latency jitter",
    "anomaly.modelSwitch": "Model Switching Sessions",
    "alert.title": "Operational Alerts",
    "status.generated": "Generated",
  },
  zh: {
    "hero.eyebrow": "OpenClaw 指标控制台",
    "hero.title": "可观测性仪表盘",
    "hero.sub": "在一个界面同时查看 Tokens、延迟、工具调用、模型分布与记忆特征。",
    "label.window": "时间窗口",
    "label.agent": "Agent",
    "label.channel": "渠道",
    "label.language": "语言",
    "label.requestQuota": "请求额度",
    "label.premiumQuota": "高级额度",
    "action.refresh": "刷新",
    "action.loading": "加载中…",
    "placeholder.unlimited": "不限",
    "weekly.title": "智能周报卡片",
    "chart.tokenCost": "每日 Tokens 与成本趋势",
    "chart.latency": "响应延迟趋势",
    "chart.requestVolume": "请求量趋势",
    "chart.requestReliability": "请求可靠性",
    "chart.quota": "配额与预算",
    "chart.qmd": "QMD 与向量检索",
    "chart.topModels": "模型 Top 排行",
    "chart.topTools": "工具 Top 排行",
    "chart.requestByModel": "按模型请求分布",
    "chart.requestByChannel": "按渠道请求分布",
    "chart.keyFileTrend": "关键文件每日访问",
    "chart.keyFileRank": "关键文件访问排行",
    "session.title": "会话列表",
    "table.session": "会话",
    "table.agent": "Agent",
    "table.tokens": "Tokens",
    "table.cost": "成本",
    "table.latency": "延迟",
    "table.updated": "更新时间",
    "session.inspector": "会话分析面板",
    "session.clickRow": "点击左侧行查看",
    "session.none": "未选择会话。",
    "command.title": "机器人命令预览",
    "command.meta": "Telegram / Discord 可直接转发的短命令输出",
    "command.loading": "正在加载命令预览…",
    "memory.footprint": "记忆数据体量",
    "memory.latestFiles": "最新记忆文件",
    "anomaly.title": "异常雷达",
    "anomaly.meta": "Token 尖峰 · 延迟抖动",
    "anomaly.modelSwitch": "模型频繁切换会话",
    "alert.title": "运行告警",
    "status.generated": "生成时间",
  },
};

function t(key, fallback = "") {
  return I18N[state.lang]?.[key] ?? fallback;
}

function applyI18n() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (!key) {
      return;
    }
    const translated = t(key, node.textContent || "");
    node.textContent = translated;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    if (!key) {
      return;
    }
    const translated = t(key, node.getAttribute("placeholder") || "");
    node.setAttribute("placeholder", translated);
  });
}

function fmtInt(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return value.toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US");
}

function fmtTokens(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function fmtUsd(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `$${value.toFixed(4)}`;
}

function fmtPct(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(1)}%`;
}

function fmtMs(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`;
  }
  return `${Math.round(value)}ms`;
}

function fmtBytes(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  const units = ["B", "KB", "MB", "GB"];
  let n = value;
  let idx = 0;
  while (n >= 1024 && idx < units.length - 1) {
    n /= 1024;
    idx += 1;
  }
  return `${n.toFixed(n >= 10 ? 1 : 2)} ${units[idx]}`;
}

function fmtDate(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return new Date(value).toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US");
}

function positiveIntFromInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return Math.round(n);
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setLoading(on) {
  state.inFlight = on;
  els.refresh.disabled = on;
  els.refresh.textContent = on ? t("action.loading", "Loading…") : t("action.refresh", "Refresh");
}

function selectOptions(select, values, labelPrefix) {
  const current = select.value;
  select.innerHTML = `<option value="">${labelPrefix}</option>`;
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  if (values.includes(current)) {
    select.value = current;
  }
}

function renderCards(data) {
  const totalQuota = data.quota?.totalLimit ?? null;
  const premiumQuota = data.quota?.premiumLimit ?? null;
  const unlimitedLabel = state.lang === "zh" ? "不限" : "Unlimited";
  const cards = [
    {
      label: state.lang === "zh" ? "范围内会话" : "Sessions In Scope",
      value: fmtInt(data.summary.sessionsInScope),
      hint:
        state.lang === "zh"
          ? `${fmtInt(data.summary.sessionsScanned)} 个已扫描`
          : `${fmtInt(data.summary.sessionsScanned)} scanned`,
    },
    {
      label: state.lang === "zh" ? "总 Tokens" : "Total Tokens",
      value: fmtTokens(data.summary.totalTokens),
      hint:
        state.lang === "zh"
          ? `输入 ${fmtTokens(data.totals.input)} · 输出 ${fmtTokens(data.totals.output)}`
          : `input ${fmtTokens(data.totals.input)} · output ${fmtTokens(data.totals.output)}`,
    },
    {
      label: state.lang === "zh" ? "关键文件访问" : "Key File Access",
      value: fmtInt(data.summary.keyFileAccessHits),
      hint:
        state.lang === "zh"
          ? "AGENT.md / TOOLS.md / SOUL.md / Memory"
          : "AGENT.md / TOOLS.md / SOUL.md / Memory",
    },
    {
      label: state.lang === "zh" ? "总成本" : "Total Cost",
      value: fmtUsd(data.summary.totalCost),
      hint: state.lang === "zh" ? "由会话估算" : "estimated from transcript",
    },
    {
      label: state.lang === "zh" ? "缓存命中占比" : "Cache Read Share",
      value: fmtPct(data.summary.cacheReadSharePct),
      hint:
        state.lang === "zh"
          ? `${fmtTokens(data.totals.cacheRead)} 缓存 tokens`
          : `${fmtTokens(data.totals.cacheRead)} cache tokens`,
    },
    {
      label: state.lang === "zh" ? "请求数" : "Requests",
      value: fmtInt(data.summary.totalRequests),
      hint:
        state.lang === "zh"
          ? `${fmtInt(data.summary.billableRequests)} 计费 · ${fmtInt(data.summary.premiumRequests)} 高级`
          : `${fmtInt(data.summary.billableRequests)} billable · ${fmtInt(data.summary.premiumRequests)} premium`,
    },
    {
      label: state.lang === "zh" ? "请求失败率" : "Request Failure",
      value: fmtPct(data.summary.requestFailureRatePct),
      hint:
        state.lang === "zh"
          ? `${fmtInt(data.requests.failed)} 失败 · ${fmtInt(data.requests.timeout)} 超时`
          : `${fmtInt(data.requests.failed)} failed · ${fmtInt(data.requests.timeout)} timeout`,
    },
    {
      label: state.lang === "zh" ? "平均延迟" : "Avg Latency",
      value: fmtMs(data.summary.avgLatencyMs),
      hint: state.lang === "zh" ? "助手响应延迟" : "assistant response latency",
    },
    {
      label: state.lang === "zh" ? "P95 延迟" : "P95 Latency",
      value: fmtMs(data.summary.p95LatencyMs),
      hint: state.lang === "zh" ? "长尾响应时间" : "tail response time",
    },
    {
      label: state.lang === "zh" ? "QMD 回源占比" : "QMD-backed Search",
      value: fmtPct(data.summary.qmdBackedRatePct),
      hint:
        state.lang === "zh"
          ? `${fmtInt(data.summary.vectorSearches)} 次向量检索`
          : `${fmtInt(data.summary.vectorSearches)} vector searches`,
    },
    {
      label: state.lang === "zh" ? "请求额度" : "Request Quota",
      value: totalQuota ? `${fmtInt(data.quota.totalUsed)} / ${fmtInt(totalQuota)}` : unlimitedLabel,
      hint:
        totalQuota && state.lang === "zh"
          ? `${fmtPct(data.quota.totalUsagePct)} 已用`
          : totalQuota
            ? `${fmtPct(data.quota.totalUsagePct)} used`
            : state.lang === "zh"
              ? "未配置"
              : "not configured",
    },
    {
      label: state.lang === "zh" ? "高级额度" : "Premium Quota",
      value: premiumQuota
        ? `${fmtInt(data.quota.premiumUsed)} / ${fmtInt(premiumQuota)}`
        : unlimitedLabel,
      hint:
        premiumQuota && state.lang === "zh"
          ? `${fmtPct(data.quota.premiumUsagePct)} 已用`
          : premiumQuota
            ? `${fmtPct(data.quota.premiumUsagePct)} used`
            : state.lang === "zh"
              ? "未配置"
              : "not configured",
    },
  ];

  els.cards.innerHTML = cards
    .map(
      (card) =>
        `<article class="card"><h3>${esc(card.label)}</h3><strong>${esc(card.value)}</strong><span class="hint">${esc(card.hint)}</span></article>`,
    )
    .join("");
}

function linePath(points, width, height, pad) {
  if (points.length < 2) {
    return "";
  }
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const max = Math.max(...points.map((p) => p.v), 1);

  return points
    .map((point, index) => {
      const x = pad + (index / (points.length - 1)) * innerW;
      const y = pad + innerH - (point.v / max) * innerH;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function renderDualLineChart({ mount, seriesA, seriesB, colorA, colorB, labels = [] }) {
  const width = Math.max(mount.clientWidth - 16, 320);
  const height = 240;
  const pad = 24;

  if (!seriesA.length) {
    mount.innerHTML = `<div class="muted">${state.lang === "zh" ? "选定时间范围暂无数据。" : "No data in selected range."}</div>`;
    return;
  }

  const pointsA = seriesA.map((v, i) => ({ x: i, v }));
  const pointsB = seriesB.map((v, i) => ({ x: i, v }));

  const pathA = linePath(pointsA, width, height, pad);
  const pathB = linePath(pointsB, width, height, pad);
  const ticks = [0, Math.floor((seriesA.length - 1) / 2), Math.max(0, seriesA.length - 1)];
  const uniqueTicks = Array.from(new Set(ticks)).filter((v) => v >= 0 && v < seriesA.length);
  const innerW = width - pad * 2;
  const tickLines = uniqueTicks
    .map((idx) => {
      const x = pad + (seriesA.length > 1 ? (idx / (seriesA.length - 1)) * innerW : innerW / 2);
      const dateLabel = labels[idx] ?? "";
      return `
        <line x1="${x.toFixed(2)}" y1="${pad}" x2="${x.toFixed(2)}" y2="${height - pad}" stroke="rgba(148,136,121,0.2)" stroke-width="1" />
        <text x="${x.toFixed(2)}" y="${height - 6}" text-anchor="middle" fill="var(--muted)" font-size="10">${esc(dateLabel)}</text>
      `;
    })
    .join("");
  const maxY = Math.max(...seriesA, ...seriesB, 1);

  mount.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ga" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="${colorA}"/>
          <stop offset="100%" stop-color="#9af4ff"/>
        </linearGradient>
        <linearGradient id="gb" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="${colorB}"/>
          <stop offset="100%" stop-color="#d2bea4"/>
        </linearGradient>
      </defs>
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="rgba(148,136,121,0.35)" stroke-width="1" />
      <line x1="${pad}" y1="${pad}" x2="${width - pad}" y2="${pad}" stroke="rgba(148,136,121,0.2)" stroke-width="1" stroke-dasharray="3 3" />
      ${tickLines}
      <path d="${pathA}" fill="none" stroke="url(#ga)" stroke-width="2.3" />
      <path d="${pathB}" fill="none" stroke="url(#gb)" stroke-width="2.3" stroke-dasharray="5 4" />
      <text x="${pad}" y="${pad - 6}" fill="var(--muted)" font-size="10">max ${esc(fmtInt(maxY))}</text>
    </svg>
  `;
}

function renderTrend(data) {
  const daily = data.aggregates.daily || [];
  if (daily.length > 0) {
    const first = daily[0].date;
    const last = daily[daily.length - 1].date;
    els.trendMeta.textContent =
      state.lang === "zh" ? `${daily.length} 天 · ${first} → ${last}` : `${daily.length} days · ${first} → ${last}`;
  } else {
    els.trendMeta.textContent = state.lang === "zh" ? "无数据" : "No data";
  }
  renderDualLineChart({
    mount: els.trend,
    seriesA: daily.map((d) => d.tokens),
    seriesB: daily.map((d) => d.cost),
    labels: daily.map((d) => d.date.slice(5)),
    colorA: "#8ba193",
    colorB: "#bda58b",
  });
}

function renderLatency(data) {
  const daily = data.aggregates.daily || [];
  els.latencyMeta.textContent =
    state.lang === "zh"
      ? `${daily.filter((d) => d.latency).length} 天有延迟样本`
      : `${daily.filter((d) => d.latency).length} days with latency`;
  renderDualLineChart({
    mount: els.latency,
    seriesA: daily.map((d) => d.latency?.avgMs ?? 0),
    seriesB: daily.map((d) => d.latency?.p95Ms ?? 0),
    labels: daily.map((d) => d.date.slice(5)),
    colorA: "#849a89",
    colorB: "#c6ac7f",
  });
}

function renderRequestTrend(data) {
  const daily = data.aggregates.daily || [];
  const withReq = daily.filter((d) => (d.requests ?? 0) > 0).length;
  els.requestTrendMeta.textContent =
    state.lang === "zh" ? `${withReq} 天有请求` : `${withReq} days with requests`;
  renderDualLineChart({
    mount: els.requestTrend,
    seriesA: daily.map((d) => d.requests ?? 0),
    seriesB: daily.map((d) => d.premiumRequests ?? 0),
    labels: daily.map((d) => d.date.slice(5)),
    colorA: "#879d8f",
    colorB: "#bca27f",
  });
}

function renderRequestHealth(data) {
  const daily = data.aggregates.daily || [];
  els.requestHealthMeta.textContent = state.lang === "zh" ? `${daily.length} 天` : `${daily.length} days`;
  renderDualLineChart({
    mount: els.requestHealth,
    seriesA: daily.map((d) => d.requestErrors ?? 0),
    seriesB: daily.map((d) => d.requestTimeouts ?? 0),
    labels: daily.map((d) => d.date.slice(5)),
    colorA: "#b4877d",
    colorB: "#c3ab85",
  });
}

function renderQuota(data) {
  const quota = data.quota || {};
  const unlimitedLabel = state.lang === "zh" ? "不限" : "Unlimited";
  const rows = [
    {
      label: state.lang === "zh" ? "总请求额度" : "Total Requests",
      value: quota.totalLimit ? `${fmtInt(quota.totalUsed)} / ${fmtInt(quota.totalLimit)}` : unlimitedLabel,
      sub: quota.totalLimit
        ? state.lang === "zh"
          ? `${fmtPct(quota.totalUsagePct)} 已用`
          : `${fmtPct(quota.totalUsagePct)} used`
        : state.lang === "zh"
          ? "未配置上限"
          : "No cap configured",
    },
    {
      label: state.lang === "zh" ? "高级请求额度" : "Premium Requests",
      value: quota.premiumLimit
        ? `${fmtInt(quota.premiumUsed)} / ${fmtInt(quota.premiumLimit)}`
        : unlimitedLabel,
      sub: quota.premiumLimit
        ? state.lang === "zh"
          ? `${fmtPct(quota.premiumUsagePct)} 已用`
          : `${fmtPct(quota.premiumUsagePct)} used`
        : state.lang === "zh"
          ? "未配置上限"
          : "No cap configured",
    },
    {
      label: state.lang === "zh" ? "剩余额度" : "Remaining",
      value: state.lang === "zh" ? `${quota.totalRemaining ?? "∞"} 总量` : `${quota.totalRemaining ?? "∞"} total`,
      sub: state.lang === "zh" ? `${quota.premiumRemaining ?? "∞"} 高级` : `${quota.premiumRemaining ?? "∞"} premium`,
    },
    {
      label: state.lang === "zh" ? "计费比例" : "Billable Ratio",
      value: fmtPct(data.requests.billableRatePct),
      sub:
        state.lang === "zh"
          ? `${fmtInt(data.requests.billable)} / ${fmtInt(data.requests.total)}`
          : `${fmtInt(data.requests.billable)} of ${fmtInt(data.requests.total)}`,
    },
  ];

  els.quotaMeta.textContent =
    quota.totalLimit || quota.premiumLimit
      ? state.lang === "zh"
        ? "按配置上限追踪"
        : "tracked with configured caps"
      : state.lang === "zh"
        ? "未配置上限"
        : "caps not configured";
  els.quotaCards.innerHTML = rows
    .map(
      (row) =>
        `<div class="memory-cell"><span class="muted">${esc(row.label)}</span><strong>${esc(row.value)}</strong><div class="muted">${esc(row.sub)}</div></div>`,
    )
    .join("");
}

function renderVector(data) {
  const vector = data.vector || {};
  const rows = [
    { label: "Search Calls", value: fmtInt(vector.searchCalls), sub: `${fmtInt(vector.searchSuccess)} success` },
    { label: "Error Rate", value: fmtPct(vector.searchErrorRatePct), sub: `${fmtInt(vector.searchErrors)} errors` },
    { label: "QMD-backed", value: fmtPct(vector.qmdBackedRatePct), sub: `${fmtInt(vector.qmdBackedSearches)} searches` },
    {
      label: "Latency",
      value: `${fmtMs(vector.latency?.avgMs)} avg`,
      sub: `${fmtMs(vector.latency?.p95Ms)} p95`,
    },
    {
      label: "Avg Results",
      value: Number(vector.avgResultsPerSearch ?? 0).toFixed(2),
      sub: `${fmtInt(vector.totalResults)} total`,
    },
    {
      label: "memory_get",
      value: fmtInt(vector.memoryGetCalls),
      sub: `${fmtInt(vector.qmdMemoryGetCalls)} qmd paths`,
    },
  ];
  els.vectorMeta.textContent = `${fmtInt(vector.searchCalls)} searches`;
  els.vectorStats.innerHTML = rows
    .map(
      (row) =>
        `<div class="memory-cell"><span class="muted">${esc(row.label)}</span><strong>${esc(row.value)}</strong><div class="muted">${esc(row.sub)}</div></div>`,
    )
    .join("");
  els.vectorCollections.innerHTML = (vector.topCollections || [])
    .slice(0, 12)
    .map((item) => `<span class="chip">${esc(item.collection)} · ${esc(item.count)}</span>`)
    .join("") || '<span class="muted">No QMD collections observed.</span>';
}

function renderBars({ mount, rows, valueGetter, labelGetter, valueFormatter, emptyText = "No data" }) {
  if (!rows.length) {
    mount.innerHTML = `<div class="muted">${esc(emptyText)}</div>`;
    return;
  }

  const max = Math.max(...rows.map((row) => valueGetter(row)), 1);
  mount.innerHTML = rows
    .map((row) => {
      const value = valueGetter(row);
      const width = (value / max) * 100;
      return `
        <div class="bar-row">
          <div class="bar-head">
            <span>${esc(labelGetter(row))}</span>
            <span>${esc(valueFormatter(value, row))}</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${width.toFixed(2)}%"></div></div>
        </div>
      `;
    })
    .join("");
}

function renderRankings(data) {
  renderBars({
    mount: els.models,
    rows: (data.aggregates.byModel || []).slice(0, 10),
    valueGetter: (row) => row.totals.totalTokens,
    labelGetter: (row) => `${row.provider ?? "unknown"} / ${row.model ?? "unknown"}`,
    valueFormatter: (value, row) => `${fmtTokens(value)} · ${fmtUsd(row.totals.totalCost)}`,
    emptyText: "No model usage",
  });

  renderBars({
    mount: els.tools,
    rows: (data.aggregates.tools || []).slice(0, 10),
    valueGetter: (row) => row.count,
    labelGetter: (row) => row.name,
    valueFormatter: (value) => `${fmtInt(value)} calls`,
    emptyText: "No tool calls",
  });
}

function renderRequestBreakdowns(data) {
  renderBars({
    mount: els.requestModels,
    rows: (data.aggregates.byRequestModel || []).slice(0, 12),
    valueGetter: (row) => row.total,
    labelGetter: (row) => `${row.provider ?? "unknown"} / ${row.model ?? "unknown"}`,
    valueFormatter: (value, row) =>
      `${fmtInt(value)} req · ${fmtPct(value > 0 ? (row.failed / value) * 100 : 0)} fail`,
    emptyText: "No request-model data",
  });

  renderBars({
    mount: els.requestChannels,
    rows: (data.aggregates.byRequestChannel || []).slice(0, 12),
    valueGetter: (row) => row.total,
    labelGetter: (row) => row.channel ?? "unknown",
    valueFormatter: (value, row) =>
      `${fmtInt(value)} req · ${fmtPct(value > 0 ? (row.premium / value) * 100 : 0)} premium`,
    emptyText: "No request-channel data",
  });
}

function renderKeyFiles(data) {
  const keyFiles = data.keyFiles || { totals: [], daily: [] };
  const dailyRows = Array.isArray(keyFiles.daily) ? keyFiles.daily : [];
  const totalHits = Number.isFinite(keyFiles.totalHits) ? keyFiles.totalHits : 0;
  if (dailyRows.length > 0) {
    els.keyFileMeta.textContent =
      state.lang === "zh"
        ? `${dailyRows.length} 天 · 累计 ${fmtInt(totalHits)} 次访问`
        : `${dailyRows.length} days · ${fmtInt(totalHits)} total hits`;
  } else {
    els.keyFileMeta.textContent = state.lang === "zh" ? "无关键文件访问记录" : "No key-file access records";
  }

  renderDualLineChart({
    mount: els.keyFileChart,
    seriesA: dailyRows.map((row) => row.total ?? 0),
    seriesB: dailyRows.map((row) => {
      const counts = row.counts || {};
      return (counts.agentMd ?? 0) + (counts.toolsMd ?? 0) + (counts.soulMd ?? 0);
    }),
    labels: dailyRows.map((row) => String(row.date).slice(5)),
    colorA: "#8b9f92",
    colorB: "#b58f7f",
  });

  renderBars({
    mount: els.keyFileStats,
    rows: [...(keyFiles.totals || [])].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)),
    valueGetter: (row) => row.count ?? 0,
    labelGetter: (row) => row.label ?? row.key ?? "unknown",
    valueFormatter: (value) => `${fmtInt(value)} ${state.lang === "zh" ? "次" : "hits"}`,
    emptyText: state.lang === "zh" ? "暂无关键文件访问统计" : "No key-file access stats",
  });
}

function renderWeeklyBrief(data) {
  const summary = data.summary || {};
  const alerts = data.alerts || [];
  const anomalies = data.anomalies || {};
  const brief = [];
  brief.push({
    level: summary.requestFailureRatePct > 8 ? "warn" : "info",
    title: state.lang === "zh" ? "系统负载" : "System Load",
    text:
      state.lang === "zh"
        ? `请求 ${fmtInt(summary.totalRequests)}，总 tokens ${fmtTokens(summary.totalTokens)}，成本 ${fmtUsd(summary.totalCost)}。`
        : `Requests ${fmtInt(summary.totalRequests)}, total tokens ${fmtTokens(summary.totalTokens)}, cost ${fmtUsd(summary.totalCost)}.`,
  });
  brief.push({
    level: summary.p95LatencyMs > 6000 ? "warn" : "info",
    title: state.lang === "zh" ? "响应延迟" : "Latency",
    text:
      state.lang === "zh"
        ? `平均 ${fmtMs(summary.avgLatencyMs)}，P95 ${fmtMs(summary.p95LatencyMs)}。`
        : `Avg ${fmtMs(summary.avgLatencyMs)}, P95 ${fmtMs(summary.p95LatencyMs)}.`,
  });
  brief.push({
    level: summary.qmdBackedRatePct < 40 ? "warn" : "info",
    title: state.lang === "zh" ? "QMD 覆盖率" : "QMD Coverage",
    text:
      state.lang === "zh"
        ? `回源占比 ${fmtPct(summary.qmdBackedRatePct)}，向量检索 ${fmtInt(summary.vectorSearches)} 次。`
        : `Backed rate ${fmtPct(summary.qmdBackedRatePct)} across ${fmtInt(summary.vectorSearches)} vector searches.`,
  });
  if (summary.keyFileAccessHits > 0) {
    brief.push({
      level: "info",
      title: state.lang === "zh" ? "关键文件访问" : "Key-File Access",
      text:
        state.lang === "zh"
          ? `AGENT/TOOLS/SOUL/Memory 共访问 ${fmtInt(summary.keyFileAccessHits)} 次。`
          : `${fmtInt(summary.keyFileAccessHits)} accesses for AGENT/TOOLS/SOUL/Memory.`,
    });
  }
  if (anomalies?.requestFailureSpikes?.length) {
    brief.push({
      level: "bad",
      title: state.lang === "zh" ? "异常告警" : "Anomaly Alert",
      text:
        state.lang === "zh"
          ? `检测到 ${fmtInt(anomalies.requestFailureSpikes.length)} 次失败率尖峰，建议优先排查。`
          : `${fmtInt(anomalies.requestFailureSpikes.length)} failure spikes detected; prioritize investigation.`,
    });
  } else if (alerts.length) {
    brief.push({
      level: "warn",
      title: state.lang === "zh" ? "风险提示" : "Risk Signals",
      text: alerts
        .slice(0, 1)
        .map((item) => item.title)
        .join(" · "),
    });
  }

  els.weeklyMeta.textContent = state.lang === "zh" ? "自动生成 · 每次刷新更新" : "Auto-generated · updates on each refresh";
  els.weeklyBrief.innerHTML = brief
    .slice(0, 5)
    .map(
      (item) =>
        `<article class="brief-item ${esc(item.level)}"><strong>${esc(item.title)}</strong><div>${esc(item.text)}</div></article>`,
    )
    .join("");
}

function renderSessionWaterfall(session) {
  const spans = (session.waterfall || [])
    .filter((item) => typeof item.startTs === "number" && typeof item.endTs === "number")
    .sort((a, b) => a.startTs - b.startTs);
  if (!spans.length) {
    return '<div class="muted">No waterfall spans for selected window.</div>';
  }

  const latest = spans.slice(Math.max(0, spans.length - 60));
  const minTs = latest[0].startTs;
  const maxTs = latest[latest.length - 1].endTs;
  const fullRange = Math.max(1, maxTs - minTs);

  const width = Math.max(360, els.inspector.clientWidth - 20);
  const rowHeight = 8;
  const gap = 4;
  const pad = 12;
  const height = Math.max(120, latest.length * (rowHeight + gap) + pad * 2 + 18);
  const innerW = width - pad * 2;

  const bars = latest
    .map((span, i) => {
      const x1 = pad + ((span.startTs - minTs) / fullRange) * innerW;
      const x2 = pad + ((span.endTs - minTs) / fullRange) * innerW;
      const barWidth = Math.max(2, x2 - x1);
      const y = pad + i * (rowHeight + gap);
      const color = span.error ? "#ae7f73" : "#7f9688";
      return `<rect x="${x1.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${rowHeight}" rx="3" fill="${color}" opacity="0.9"></rect>`;
    })
    .join("");

  const axisY = height - 14;
  const startLabel = new Date(minTs).toLocaleTimeString();
  const midLabel = new Date(minTs + Math.floor(fullRange / 2)).toLocaleTimeString();
  const endLabel = new Date(maxTs).toLocaleTimeString();

  return `
    <div class="wf-meta">
      <span>${latest.length} assistant turns</span>
      <span>${startLabel} → ${endLabel}</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="waterfall-svg">
      <line x1="${pad}" y1="${axisY}" x2="${width - pad}" y2="${axisY}" stroke="rgba(148,136,121,0.35)" stroke-width="1"></line>
      <line x1="${(width / 2).toFixed(2)}" y1="${pad}" x2="${(width / 2).toFixed(2)}" y2="${axisY}" stroke="rgba(148,136,121,0.2)" stroke-width="1" stroke-dasharray="3 3"></line>
      ${bars}
      <text x="${pad}" y="${height - 2}" text-anchor="start" fill="var(--muted)" font-size="10">${esc(startLabel)}</text>
      <text x="${(width / 2).toFixed(2)}" y="${height - 2}" text-anchor="middle" fill="var(--muted)" font-size="10">${esc(midLabel)}</text>
      <text x="${width - pad}" y="${height - 2}" text-anchor="end" fill="var(--muted)" font-size="10">${esc(endLabel)}</text>
    </svg>
    <div class="wf-legend">
      <span><i style="background:#7f9688"></i> ${state.lang === "zh" ? "正常轮次" : "normal turn"}</span>
      <span><i style="background:#ae7f73"></i> ${state.lang === "zh" ? "错误轮次" : "error turn"}</span>
    </div>
  `;
}

function renderTimelineEvents(session) {
  const rows = (session.timeline || [])
    .filter((item) => typeof item.timestamp === "number")
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-14);
  if (!rows.length) {
    return `<div class="muted">${state.lang === "zh" ? "暂无时间线事件。" : "No timeline events."}</div>`;
  }
  return rows
    .map((item) => {
      const stamp = new Date(item.timestamp).toLocaleTimeString();
      const tag = item.isError ? '<span class="tag bad">error</span>' : "";
      const model = item.model ? `${item.provider ?? "unknown"}/${item.model}` : state.lang === "zh" ? "无" : "n/a";
      return `
        <div class="tl-row">
          <div class="tl-head">
            <span>${esc(stamp)} · ${esc(item.role)}</span>
            <span>${esc(fmtTokens(item.tokens ?? 0))} tok · ${esc(fmtUsd(item.cost))}</span>
          </div>
          <div class="tl-sub">${esc(model)} · ${esc(fmtMs(item.durationMs))} ${tag}</div>
          <div class="tl-text">${esc(item.text || "")}</div>
        </div>
      `;
    })
    .join("");
}

function renderInspector(session) {
  if (!session) {
    els.inspector.classList.add("empty");
    els.inspector.textContent = t("session.none", "No session selected.");
    return;
  }

  els.inspector.classList.remove("empty");
  const ctx = session.contextWeight?.systemPrompt;
  els.inspector.innerHTML = `
    <div class="inspector-grid">
      <div><span class="muted">Session</span><strong>${esc(session.label || session.sessionId)}</strong></div>
      <div><span class="muted">Agent</span><strong>${esc(session.agentId)}</strong></div>
      <div><span class="muted">Channel</span><strong>${esc(session.channel ?? "-")}</strong></div>
      <div><span class="muted">Updated</span><strong>${esc(fmtDate(session.updatedAt))}</strong></div>
      <div><span class="muted">Tokens</span><strong>${esc(fmtInt(session.totals.totalTokens))}</strong></div>
      <div><span class="muted">Cost</span><strong>${esc(fmtUsd(session.totals.totalCost))}</strong></div>
      <div><span class="muted">Latency</span><strong>${esc(session.latency ? `${fmtMs(session.latency.avgMs)} avg / ${fmtMs(session.latency.p95Ms)} p95` : "-")}</strong></div>
      <div><span class="muted">Model Switches</span><strong>${esc(fmtInt(session.modelSwitches ?? 0))}</strong></div>
      <div><span class="muted">System Prompt Chars</span><strong>${esc(ctx?.chars ? fmtInt(ctx.chars) : "-")}</strong></div>
      <div><span class="muted">Project Context</span><strong>${esc(ctx?.projectContextChars ? fmtInt(ctx.projectContextChars) : "-")}</strong></div>
    </div>
    <div class="inspector-section">
      <h4>Response Waterfall</h4>
      ${renderSessionWaterfall(session)}
    </div>
    <div class="inspector-section">
      <h4>Recent Timeline Events</h4>
      ${renderTimelineEvents(session)}
    </div>
  `;
}

function renderSessions(data) {
  const rows = data.sessions || [];
  els.sessionCount.textContent = state.lang === "zh" ? `${rows.length} 行` : `${rows.length} rows`;

  els.sessionsBody.innerHTML = rows
    .map((session) => {
      const selected = state.selectedSessionId === session.id ? ' style="background: rgba(95,163,226,0.2)"' : "";
      const name = session.label || session.sessionId;
      return `
        <tr data-session-id="${esc(session.id)}"${selected}>
          <td>${esc(name)}</td>
          <td>${esc(session.agentId)}</td>
          <td>${esc(fmtTokens(session.totals.totalTokens))}</td>
          <td>${esc(fmtUsd(session.totals.totalCost))}</td>
          <td>${esc(fmtMs(session.latency?.avgMs))}</td>
          <td>${esc(fmtDate(session.updatedAt))}</td>
        </tr>
      `;
    })
    .join("");

  const selectedSession = rows.find((s) => s.id === state.selectedSessionId) || rows[0] || null;
  if (!state.selectedSessionId && selectedSession) {
    state.selectedSessionId = selectedSession.id;
  }
  renderInspector(selectedSession);

  els.sessionsBody.querySelectorAll("tr[data-session-id]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedSessionId = row.getAttribute("data-session-id");
      renderSessions(data);
    });
  });
}

function renderMemory(data) {
  const memory = data.memory;
  els.memoryMeta.textContent = memory.exists
    ? memory.relativePath || memory.memoryDir
    : state.lang === "zh"
      ? "未找到 memory 目录"
      : "memory dir not found";

  const stats = [
    { label: "Files", value: fmtInt(memory.fileCount) },
    { label: "Total Size", value: fmtBytes(memory.totalBytes) },
    { label: "Newest", value: memory.newestMs ? fmtDate(memory.newestMs) : "-" },
    { label: "Oldest", value: memory.oldestMs ? fmtDate(memory.oldestMs) : "-" },
  ];

  els.memoryStats.innerHTML = stats
    .map(
      (cell) =>
        `<div class="memory-cell"><span class="muted">${esc(cell.label)}</span><strong>${esc(cell.value)}</strong></div>`,
    )
    .join("");

  els.memoryKeywords.innerHTML = (memory.keywords || [])
    .slice(0, 18)
    .map((item) => `<span class="chip">${esc(item.word)} · ${esc(item.count)}</span>`)
    .join("") || `<span class="muted">${state.lang === "zh" ? "暂无关键词。" : "No keywords."}</span>`;

  els.memoryFiles.innerHTML = (memory.files || [])
    .slice(0, 60)
    .map(
      (file) => `
        <article class="memory-file">
          <div class="name">${esc(file.title)}</div>
          <div class="path">${esc(file.relativePath)}</div>
          <div class="muted">${esc(fmtBytes(file.size))} · ${esc(fmtDate(file.mtimeMs))}</div>
          <div>${esc(file.snippet || "")}</div>
        </article>
      `,
    )
    .join("") || `<div class="muted">${state.lang === "zh" ? "未发现记忆文件。" : "No memory files found."}</div>`;
}

function renderAnomalies(data) {
  const anomalies = data.anomalies || {};
  const tokenSpikes = anomalies.tokenSpikes || [];
  const requestSpikes = anomalies.requestSpikes || [];
  const requestFailureSpikes = anomalies.requestFailureSpikes || [];
  const latencyJitter = anomalies.latencyJitter;
  const qmdCoverageDrop = anomalies.qmdCoverageDrop;
  const modelSwitching = anomalies.modelSwitching || [];

  const anomalyCards = [];
  if (tokenSpikes.length) {
    for (const spike of tokenSpikes.slice(0, 5)) {
      anomalyCards.push(
        `<article class="alert warn"><strong>Token Spike (${esc(spike.date)})</strong><div>${esc(fmtTokens(spike.tokens))} tokens · ${esc(spike.ratio.toFixed(2))}x baseline</div></article>`,
      );
    }
  }
  if (latencyJitter) {
    anomalyCards.push(
      `<article class="alert warn"><strong>Latency Jitter</strong><div>CV ${(latencyJitter.coefficientOfVariation * 100).toFixed(1)}% · p95/avg ${latencyJitter.globalP95ToAvgRatio.toFixed(2)}x</div></article>`,
    );
  }
  if (requestSpikes.length) {
    for (const spike of requestSpikes.slice(0, 5)) {
      anomalyCards.push(
        `<article class="alert warn"><strong>Request Spike (${esc(spike.date)})</strong><div>${esc(fmtInt(spike.requests))} requests · ${esc(spike.ratio.toFixed(2))}x baseline</div></article>`,
      );
    }
  }
  if (requestFailureSpikes.length) {
    for (const spike of requestFailureSpikes.slice(0, 4)) {
      anomalyCards.push(
        `<article class="alert bad"><strong>Failure Spike (${esc(spike.date)})</strong><div>${esc(spike.ratePct.toFixed(1))}% failure · ${esc(spike.ratio.toFixed(2))}x baseline</div></article>`,
      );
    }
  }
  if (qmdCoverageDrop) {
    anomalyCards.push(
      `<article class="alert info"><strong>QMD Coverage Low</strong><div>${esc(fmtPct(qmdCoverageDrop.qmdBackedRatePct))} · ${esc(fmtInt(qmdCoverageDrop.qmdBackedSearches))}/${esc(fmtInt(qmdCoverageDrop.searchCalls))} searches</div></article>`,
    );
  }
  if (!anomalyCards.length) {
    anomalyCards.push('<article class="alert info">No anomaly triggered by current rules.</article>');
  }
  els.anomalyList.innerHTML = anomalyCards.join("");

  els.modelSwitchMeta.textContent = `${modelSwitching.length} sessions`;
  els.modelSwitchList.innerHTML =
    modelSwitching
      .slice(0, 24)
      .map(
        (item) => `
        <article class="memory-file">
          <div class="name">${esc(item.label || item.sessionId)}</div>
          <div class="path">${esc(item.agentId)} · switches ${esc(item.switches)} · models ${esc(item.uniqueModels)}</div>
          <div class="muted">${esc(fmtDate(item.updatedAt))}</div>
          <div>${esc(
            (item.models || [])
              .map((m) => `${m.provider}/${m.model}`)
              .slice(0, 4)
              .join(", "),
          )}</div>
        </article>
      `,
      )
      .join("") || '<div class="muted">No model switching sessions.</div>';
}

function renderAlerts(data) {
  const alerts = data.alerts || [];
  if (!alerts.length) {
    els.alerts.innerHTML = `<div class="alert info">${state.lang === "zh" ? "当前无告警，系统状态良好。" : "No alerts. System currently looks healthy."}</div>`;
    return;
  }
  els.alerts.innerHTML = alerts
    .map((alert) => {
      const level = alert.level === "warn" ? "warn" : alert.level === "bad" ? "bad" : "info";
      return `<article class="alert ${level}"><strong>${esc(alert.title)}</strong><div>${esc(alert.message)}</div></article>`;
    })
    .join("");
}

async function refreshCommandPreview() {
  if (!state.data) {
    return;
  }
  try {
    const params = new URLSearchParams();
    params.set("cmd", state.commandMode || "summary");
    params.set("days", els.days.value || "30");
    if (els.agent.value) {
      params.set("agent", els.agent.value);
    }
    if (els.channel.value) {
      params.set("channel", els.channel.value);
    }
    const reqQuota = positiveIntFromInput(els.requestQuota.value);
    const premiumQuota = positiveIntFromInput(els.premiumQuota.value);
    if (reqQuota) {
      params.set("requestQuota", String(reqQuota));
    }
    if (premiumQuota) {
      params.set("premiumQuota", String(premiumQuota));
    }
    params.set("lang", state.lang);
    params.set("maxItems", "8");
    const res = await fetch(`/api/command?${params.toString()}`, { cache: "no-store" });
    const payload = await res.json();
    if (!payload.ok) {
      throw new Error(payload.error || "command preview failed");
    }
    els.commandPreview.textContent =
      payload.text || (state.lang === "zh" ? "（命令输出为空）" : "(empty command output)");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    els.commandPreview.textContent =
      state.lang === "zh" ? `命令预览失败: ${message}` : `command preview failed: ${message}`;
  }
}

function updateFiltersFromData(data) {
  selectOptions(els.agent, data.filters.options.agents || [], state.lang === "zh" ? "全部 Agent" : "All agents");
  selectOptions(
    els.channel,
    data.filters.options.channels || [],
    state.lang === "zh" ? "全部渠道" : "All channels",
  );
}

function renderAll(data) {
  renderCards(data);
  renderWeeklyBrief(data);
  renderTrend(data);
  renderRequestTrend(data);
  renderRequestHealth(data);
  renderKeyFiles(data);
  renderQuota(data);
  renderVector(data);
  renderLatency(data);
  renderRankings(data);
  renderRequestBreakdowns(data);
  renderSessions(data);
  renderMemory(data);
  renderAnomalies(data);
  renderAlerts(data);
  els.generatedAt.textContent =
    state.lang === "zh"
      ? `${t("status.generated", "生成时间")} ${fmtDate(data.generatedAt)} · 范围: ${data.range.days}`
      : `${t("status.generated", "Generated")} ${fmtDate(data.generatedAt)} · range: ${data.range.days}`;
  void refreshCommandPreview();
}

async function fetchData() {
  if (state.inFlight) {
    return;
  }

  setLoading(true);
  try {
    const params = new URLSearchParams();
    params.set("days", els.days.value || "30");
    if (els.agent.value) {
      params.set("agent", els.agent.value);
    }
    if (els.channel.value) {
      params.set("channel", els.channel.value);
    }
    params.set("sessionLimit", "300");
    params.set("memoryLimit", "120");
    params.set("timelineLimit", "300");
    const requestQuota = positiveIntFromInput(els.requestQuota.value);
    const premiumQuota = positiveIntFromInput(els.premiumQuota.value);
    if (requestQuota) {
      params.set("requestQuota", String(requestQuota));
    }
    if (premiumQuota) {
      params.set("premiumQuota", String(premiumQuota));
    }

    const res = await fetch(`/api/collect?${params.toString()}`, { cache: "no-store" });
    const payload = await res.json();
    if (!payload.ok) {
      throw new Error(payload.error || "collect failed");
    }

    state.data = payload.data;
    updateFiltersFromData(state.data);
    renderAll(state.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    els.alerts.innerHTML = `<article class="alert bad"><strong>${esc(
      state.lang === "zh" ? "数据加载失败" : "Data Load Failed",
    )}</strong><div>${esc(message)}</div></article>`;
  } finally {
    setLoading(false);
  }
}

function bindEvents() {
  els.refresh.addEventListener("click", () => {
    fetchData();
  });
  els.days.addEventListener("change", fetchData);
  els.agent.addEventListener("change", fetchData);
  els.channel.addEventListener("change", fetchData);
  els.lang.addEventListener("change", () => {
    state.lang = els.lang.value === "en" ? "en" : "zh";
    localStorage.setItem("openclaw_observatory_lang", state.lang);
    applyI18n();
    if (state.data) {
      updateFiltersFromData(state.data);
      renderAll(state.data);
    } else {
      fetchData();
    }
  });
  els.requestQuota.addEventListener("change", () => {
    localStorage.setItem("openclaw_observatory_request_quota", els.requestQuota.value || "");
    fetchData();
  });
  els.premiumQuota.addEventListener("change", () => {
    localStorage.setItem("openclaw_observatory_premium_quota", els.premiumQuota.value || "");
    fetchData();
  });
  for (const button of els.commandButtons) {
    button.addEventListener("click", () => {
      state.commandMode = button.getAttribute("data-cmd") || "summary";
      for (const btn of els.commandButtons) {
        btn.classList.toggle("active", btn === button);
      }
      void refreshCommandPreview();
    });
  }
}

state.lang = localStorage.getItem("openclaw_observatory_lang") === "en" ? "en" : "zh";
els.lang.value = state.lang;
applyI18n();
els.requestQuota.value = localStorage.getItem("openclaw_observatory_request_quota") || "";
els.premiumQuota.value = localStorage.getItem("openclaw_observatory_premium_quota") || "";
for (const button of els.commandButtons) {
  button.classList.toggle("active", button.getAttribute("data-cmd") === state.commandMode);
}

bindEvents();
fetchData();
setInterval(() => {
  fetchData();
}, 30_000);
