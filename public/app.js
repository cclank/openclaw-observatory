const els = {
  days: document.getElementById("daysSelect"),
  agent: document.getElementById("agentSelect"),
  channel: document.getElementById("channelSelect"),
  lang: document.getElementById("langSelect"),
  refresh: document.getElementById("refreshBtn"),
  cards: document.getElementById("kpiCards"),
  trend: document.getElementById("trendChart"),
  trendMeta: document.getElementById("trendMeta"),
  requestTrend: document.getElementById("requestTrendChart"),
  requestTrendMeta: document.getElementById("requestTrendMeta"),
  requestHealth: document.getElementById("requestHealthChart"),
  requestHealthMeta: document.getElementById("requestHealthMeta"),
  keyFileMeta: document.getElementById("keyFileMeta"),
  keyFileChart: document.getElementById("keyFileChart"),
  keyFileMethod: document.getElementById("keyFileMethod"),
  vectorMeta: document.getElementById("vectorMeta"),
  vectorStats: document.getElementById("vectorStats"),
  vectorCollections: document.getElementById("vectorCollections"),
  vectorErrorsMeta: document.getElementById("vectorErrorsMeta"),
  vectorErrors: document.getElementById("vectorErrors"),
  latency: document.getElementById("latencyChart"),
  latencyMeta: document.getElementById("latencyMeta"),
  models: document.getElementById("modelsList"),
  tools: document.getElementById("toolsList"),
  toolDrilldownMeta: document.getElementById("toolDrilldownMeta"),
  toolDrilldown: document.getElementById("toolDrilldown"),
  requestModels: document.getElementById("requestModelsList"),
  requestChannels: document.getElementById("requestChannelsList"),
  unknownBreakdownMeta: document.getElementById("unknownBreakdownMeta"),
  unknownBreakdown: document.getElementById("unknownBreakdownList"),
  sessionCount: document.getElementById("sessionCount"),
  sessionsBody: document.querySelector("#sessionsTable tbody"),
  inspector: document.getElementById("sessionInspector"),
  memoryMeta: document.getElementById("memoryMeta"),
  memoryStats: document.getElementById("memoryStats"),
  memoryKeywords: document.getElementById("memoryKeywords"),
  memoryFiles: document.getElementById("memoryFiles"),
  memorySearch: document.getElementById("memorySearchInput"),
  memoryFilesCount: document.getElementById("memoryFilesCount"),
  anomalyList: document.getElementById("anomalyList"),
  modelSwitchMeta: document.getElementById("modelSwitchMeta"),
  modelSwitchList: document.getElementById("modelSwitchList"),
  commandPreview: document.getElementById("commandPreview"),
  commandButtons: Array.from(document.querySelectorAll(".cmd-btn")),
  alerts: document.getElementById("alerts"),
  alertRules: document.getElementById("alertRules"),
  generatedAt: document.getElementById("generatedAt"),
};

const state = {
  data: null,
  selectedSessionId: null,
  inFlight: false,
  commandMode: "summary",
  lang: "zh",
  memoryQuery: "",
  selectedTool: null,
  selectedVectorError: null,
  memoryDetailPath: null,
  memoryDetailLoadingPath: null,
  memoryDetailError: "",
  memoryDetailCache: new Map(),
};

const charts = new Map();
const hasEcharts = typeof window !== "undefined" && Boolean(window.echarts);

const I18N = {
  en: {
    "hero.eyebrow": "OpenClaw Metrics Console",
    "hero.title": "Observatory Dashboard",
    "hero.sub": "Interactive and explainable observability for intelligent agents.",
    "label.window": "Window",
    "label.agent": "Agent",
    "label.channel": "Channel",
    "label.language": "Language",
    "action.refresh": "Refresh",
    "action.loading": "Loading…",
    "chart.tokenCost": "Daily Token + Cost Trend",
    "chart.latency": "Response Latency",
    "chart.requestVolume": "Request Volume",
    "chart.requestReliability": "Request Reliability",
    "chart.qmd": "QMD and Vector Retrieval",
    "chart.vectorErrors": "Vector Error Details",
    "chart.topModels": "Top Models",
    "chart.topTools": "Top Tools",
    "chart.toolDrilldown": "Tool Drilldown",
    "chart.requestByModel": "Request by Model",
    "chart.requestByChannel": "Request by Channel",
    "chart.unknownBreakdown": "Unknown Source Breakdown",
    "chart.keyFileTrend": "Key File Daily Access",
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
    "memory.latestFiles": "Memory Files",
    "memory.search": "Search file name/path/content",
    "anomaly.title": "Anomaly Radar",
    "anomaly.meta": "Token spike · latency jitter",
    "anomaly.modelSwitch": "Model Switching Sessions",
    "alert.title": "Operational Alerts",
    "alert.rules": "Alert Rules",
    "status.generated": "Generated",
  },
  zh: {
    "hero.eyebrow": "OpenClaw 指标控制台",
    "hero.title": "可观测性仪表盘",
    "hero.sub": "面向智能 Agent 的可交互、可解释观测系统。",
    "label.window": "时间窗口",
    "label.agent": "Agent",
    "label.channel": "渠道",
    "label.language": "语言",
    "action.refresh": "刷新",
    "action.loading": "加载中…",
    "chart.tokenCost": "每日 Tokens 与成本趋势",
    "chart.latency": "响应延迟趋势",
    "chart.requestVolume": "请求量趋势",
    "chart.requestReliability": "请求可靠性",
    "chart.qmd": "QMD 与向量检索（QMD 回源占比）",
    "chart.vectorErrors": "向量检索错误明细",
    "chart.topModels": "模型 Top 排行",
    "chart.topTools": "工具 Top 排行",
    "chart.toolDrilldown": "工具下钻分析",
    "chart.requestByModel": "按模型请求分布",
    "chart.requestByChannel": "按渠道请求分布",
    "chart.unknownBreakdown": "Unknown 来源细分",
    "chart.keyFileTrend": "关键文件每日访问",
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
    "memory.latestFiles": "记忆文件",
    "memory.search": "搜索文件名/路径/片段",
    "anomaly.title": "异常雷达",
    "anomaly.meta": "Token 尖峰 · 延迟抖动",
    "anomaly.modelSwitch": "模型频繁切换会话",
    "alert.title": "运行告警",
    "alert.rules": "告警规则说明",
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
    node.textContent = t(key, node.textContent || "");
  });
  if (els.memorySearch) {
    els.memorySearch.placeholder = t("memory.search", els.memorySearch.placeholder || "");
  }
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
      label: state.lang === "zh" ? "请求数" : "Requests",
      value: fmtInt(data.summary.totalRequests),
      hint:
        state.lang === "zh"
          ? `${fmtInt(data.summary.billableRequests)} 计费 · ${fmtInt(data.summary.premiumRequests)} 高级`
          : `${fmtInt(data.summary.billableRequests)} billable · ${fmtInt(data.summary.premiumRequests)} premium`,
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
      label: state.lang === "zh" ? "总成本" : "Total Cost",
      value: fmtUsd(data.summary.totalCost),
      hint:
        state.lang === "zh"
          ? "模型维度估算值（实际以供应商账单为准）"
          : "model-aware estimate (billing provider is source of truth)",
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
      label: state.lang === "zh" ? "关键文件访问" : "Key File Access",
      value: fmtInt(data.summary.keyFileAccessHits),
      hint: "AGENT.md / TOOLS.md / SOUL.md / Memory",
    },
  ];

  els.cards.innerHTML = cards
    .map(
      (card) =>
        `<article class="card"><h3>${esc(card.label)}</h3><strong>${esc(card.value)}</strong><span class="hint">${esc(card.hint)}</span></article>`,
    )
    .join("");
}

function disposeCharts() {
  for (const chart of charts.values()) {
    chart.dispose();
  }
  charts.clear();
}

function getChart(mount, key) {
  if (!hasEcharts || !mount) {
    return null;
  }
  if (!charts.has(key)) {
    const chart = window.echarts.init(mount, null, { renderer: "canvas" });
    charts.set(key, chart);
  }
  return charts.get(key);
}

function compactAxisValue(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(Math.round(value));
}

function axisTokens(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function axisUsd(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  const abs = Math.abs(value);
  if (abs >= 100) {
    return `$${value.toFixed(0)}`;
  }
  if (abs >= 1) {
    return `$${value.toFixed(2)}`;
  }
  if (abs >= 0.01) {
    return `$${value.toFixed(3)}`;
  }
  return `$${value.toFixed(4)}`;
}

function axisMs(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }
  return `${Math.round(value)}ms`;
}

function renderInteractiveDualChart({
  key,
  mount,
  labels,
  seriesA,
  seriesB,
  nameA,
  nameB,
  colorA,
  colorB,
  axisAFormatter = (value) => compactAxisValue(value),
  axisBFormatter = (value) => compactAxisValue(value),
}) {
  if (!mount) {
    return;
  }
  if (!labels.length) {
    mount.innerHTML = `<div class="muted">${state.lang === "zh" ? "选定时间范围暂无数据。" : "No data in selected range."}</div>`;
    return;
  }
  if (!hasEcharts) {
    mount.innerHTML = `<div class="muted">ECharts not loaded.</div>`;
    return;
  }

  const chart = getChart(mount, key);
  if (!chart) {
    return;
  }
  chart.setOption(
    {
      animationDuration: 360,
      color: [colorA, colorB],
      tooltip: { trigger: "axis" },
      legend: {
        top: 0,
        textStyle: { color: "#71685d", fontSize: 11 },
      },
      grid: { left: 14, right: 14, top: 34, bottom: 44, containLabel: true },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { color: "#655d53", fontSize: 11, hideOverlap: false },
        axisLine: { lineStyle: { color: "#b8ae9f" } },
      },
      yAxis: [
        {
          type: "value",
          axisLabel: { color: "#655d53", fontSize: 11, formatter: axisAFormatter },
          axisLine: { show: true, lineStyle: { color: "rgba(125,117,106,0.25)" } },
          splitLine: { lineStyle: { color: "rgba(148,136,121,0.16)" } },
        },
        {
          type: "value",
          axisLabel: { color: "#655d53", fontSize: 11, formatter: axisBFormatter },
          axisLine: { show: true, lineStyle: { color: "rgba(125,117,106,0.25)" } },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: 0, filterMode: "none" },
        { type: "slider", xAxisIndex: 0, height: 14, bottom: 8, brushSelect: false },
      ],
      series: [
        {
          name: nameA,
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          data: seriesA,
          yAxisIndex: 0,
          lineStyle: { width: 2.2 },
          areaStyle: { opacity: 0.08 },
          emphasis: { focus: "series" },
        },
        {
          name: nameB,
          type: "line",
          smooth: true,
          symbol: "diamond",
          symbolSize: 6,
          data: seriesB,
          yAxisIndex: 1,
          lineStyle: { width: 2.2, type: "dashed" },
          emphasis: { focus: "series" },
        },
      ],
    },
    true,
  );
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
  renderInteractiveDualChart({
    key: "trend",
    mount: els.trend,
    labels: daily.map((d) => d.date),
    seriesA: daily.map((d) => d.tokens),
    seriesB: daily.map((d) => d.cost),
    nameA: state.lang === "zh" ? "Tokens" : "Tokens",
    nameB: state.lang === "zh" ? "成本" : "Cost",
    colorA: "#7f9688",
    colorB: "#ba9a73",
    axisAFormatter: axisTokens,
    axisBFormatter: axisUsd,
  });
}

function renderLatency(data) {
  const daily = data.aggregates.daily || [];
  const rows = daily.filter((d) => d.latency);
  els.latencyMeta.textContent =
    state.lang === "zh" ? `${rows.length} 天有延迟样本` : `${rows.length} days with latency`;
  renderInteractiveDualChart({
    key: "latency",
    mount: els.latency,
    labels: daily.map((d) => d.date),
    seriesA: daily.map((d) => d.latency?.avgMs ?? 0),
    seriesB: daily.map((d) => d.latency?.p95Ms ?? 0),
    nameA: "Avg",
    nameB: "P95",
    colorA: "#819786",
    colorB: "#b78578",
    axisAFormatter: axisMs,
    axisBFormatter: axisMs,
  });
}

function renderRequestTrend(data) {
  const daily = data.aggregates.daily || [];
  const withReq = daily.filter((d) => (d.requests ?? 0) > 0).length;
  els.requestTrendMeta.textContent =
    state.lang === "zh" ? `${withReq} 天有请求` : `${withReq} days with requests`;
  renderInteractiveDualChart({
    key: "reqTrend",
    mount: els.requestTrend,
    labels: daily.map((d) => d.date),
    seriesA: daily.map((d) => d.requests ?? 0),
    seriesB: daily.map((d) => d.premiumRequests ?? 0),
    nameA: state.lang === "zh" ? "总请求" : "Total",
    nameB: state.lang === "zh" ? "高级" : "Premium",
    colorA: "#7b9584",
    colorB: "#c4a77f",
    axisAFormatter: compactAxisValue,
    axisBFormatter: compactAxisValue,
  });
}

function renderRequestHealth(data) {
  const daily = data.aggregates.daily || [];
  els.requestHealthMeta.textContent = state.lang === "zh" ? `${daily.length} 天` : `${daily.length} days`;
  renderInteractiveDualChart({
    key: "reqHealth",
    mount: els.requestHealth,
    labels: daily.map((d) => d.date),
    seriesA: daily.map((d) => d.requestErrors ?? 0),
    seriesB: daily.map((d) => d.requestTimeouts ?? 0),
    nameA: state.lang === "zh" ? "失败" : "Failures",
    nameB: state.lang === "zh" ? "超时" : "Timeouts",
    colorA: "#af7f72",
    colorB: "#c4a77f",
    axisAFormatter: compactAxisValue,
    axisBFormatter: compactAxisValue,
  });
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
  els.vectorMeta.textContent =
    state.lang === "zh"
      ? `${fmtInt(vector.searchCalls)} 次检索 · QMD 回源 ${fmtPct(vector.qmdBackedRatePct)}（命中 qmd/* 或 provider=qmd）`
      : `${fmtInt(vector.searchCalls)} searches · QMD-backed ${fmtPct(vector.qmdBackedRatePct)} (qmd/* hit or provider=qmd)`;
  els.vectorStats.innerHTML = rows
    .map(
      (row) =>
        `<div class="memory-cell"><span class="muted">${esc(row.label)}</span><strong>${esc(row.value)}</strong><div class="muted">${esc(row.sub)}</div></div>`,
    )
    .join("");
  els.vectorCollections.innerHTML = (vector.topCollections || [])
    .slice(0, 12)
    .map((item) => `<span class="chip">${esc(item.collection)} · ${esc(item.count)}</span>`)
    .join("") || `<span class="muted">${state.lang === "zh" ? "未观察到 QMD collection" : "No QMD collections observed."}</span>`;
  const topErrors = Array.isArray(vector.topErrors) ? vector.topErrors : [];
  const samples = Array.isArray(vector.errorSamples) ? vector.errorSamples : [];
  if (els.vectorErrorsMeta) {
    els.vectorErrorsMeta.textContent =
      state.lang === "zh"
        ? `${fmtInt(vector.searchErrors ?? 0)} errors · 点击标签查看`
        : `${fmtInt(vector.searchErrors ?? 0)} errors · click tags to inspect`;
  }
  if (!els.vectorErrors) {
    return;
  }
  if (!topErrors.length) {
    els.vectorErrors.innerHTML = `<div class="muted">${state.lang === "zh" ? "当前无向量检索错误。" : "No vector retrieval errors in range."}</div>`;
    return;
  }
  const selected = state.selectedVectorError || topErrors[0].error;
  state.selectedVectorError = selected;
  const sampleRows = samples.filter((row) => row.error === selected).slice(0, 20);
  const heads = topErrors
    .slice(0, 10)
    .map((row) => {
      const active = row.error === selected;
      return `<button class="cmd-btn${active ? " active" : ""}" data-vecerr="${esc(row.error)}">${esc(row.error)} (${fmtInt(row.count)})</button>`;
    })
    .join("");
  const details =
    sampleRows
      .map(
        (row) => `<article class="memory-file">
        <div class="name">${esc(row.error)}</div>
        <div class="path">${esc(row.sessionId ?? "-")} · ${esc(row.date ?? "-")}</div>
        <div class="muted">${esc(row.tool ?? "-")} · ${esc(row.query ?? row.path ?? "-")}</div>
      </article>`,
      )
      .join("") || `<div class="muted">${state.lang === "zh" ? "暂无样本细节。" : "No sample rows."}</div>`;
  els.vectorErrors.innerHTML = `<div class="command-toolbar">${heads}</div><div>${details}</div>`;
  els.vectorErrors.querySelectorAll("[data-vecerr]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedVectorError = button.getAttribute("data-vecerr");
      renderVector(data);
    });
  });
}

function renderRankings(data) {
  renderBars({
    mount: els.models,
    rows: (data.aggregates.byModel || []).slice(0, 12),
    valueGetter: (row) => row.totals.totalTokens,
    labelGetter: (row) => `${row.provider ?? "unknown"} / ${row.model ?? "unknown"}`,
    valueFormatter: (value, row) => `${fmtTokens(value)} · ${fmtUsd(row.totals.totalCost)}`,
    emptyText: state.lang === "zh" ? "暂无模型使用" : "No model usage",
  });

  const toolRows = (data.aggregates.tools || []).slice(0, 16);
  if (!toolRows.length) {
    els.tools.innerHTML = `<div class="muted">${
      state.lang === "zh"
        ? "暂无工具调用；若确认有工具调用，请检查会话日志是否包含 tool_use/tool_result 或 toolCalls 字段。"
        : "No tool calls; if you expect calls, verify session logs include tool_use/tool_result or toolCalls fields."
    }</div>`;
  } else {
    const max = Math.max(...toolRows.map((row) => row.count), 1);
    els.tools.innerHTML = toolRows
      .map((row) => {
        const width = (row.count / max) * 100;
        const active = state.selectedTool === row.name;
        return `
          <div class="bar-row">
            <div class="bar-head">
              <button class="cmd-btn${active ? " active" : ""}" data-tool="${esc(row.name)}">${esc(row.name)}</button>
              <span>${fmtInt(row.count)} ${state.lang === "zh" ? "次" : "calls"}</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${width.toFixed(2)}%"></div></div>
          </div>
        `;
      })
      .join("");
    els.tools.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedTool = button.getAttribute("data-tool");
        renderRankings(data);
      });
    });
  }

  const drillRows = Array.isArray(data.aggregates.toolDrilldown) ? data.aggregates.toolDrilldown : [];
  const tool = drillRows.find((row) => row.name === state.selectedTool) || drillRows[0] || null;
  if (tool) {
    state.selectedTool = tool.name;
  }
  if (!tool) {
    els.toolDrilldownMeta.textContent = state.lang === "zh" ? "无工具数据" : "No tool data";
    els.toolDrilldown.innerHTML = `<div class="muted">${state.lang === "zh" ? "暂无可下钻项。" : "No drilldown data."}</div>`;
    return;
  }
  els.toolDrilldownMeta.textContent =
    state.lang === "zh"
      ? `${tool.name} · ${fmtInt(tool.totalCalls)} 次调用 · ${fmtInt(tool.sessions)} 会话`
      : `${tool.name} · ${fmtInt(tool.totalCalls)} calls · ${fmtInt(tool.sessions)} sessions`;
  const byAgent = (tool.byAgent || [])
    .slice(0, 6)
    .map((row) => `${row.agentId}: ${fmtInt(row.count)}`)
    .join(" · ");
  const byChannel = (tool.byChannel || [])
    .slice(0, 6)
    .map((row) => `${row.channel}: ${fmtInt(row.count)}`)
    .join(" · ");
  const topSessions = (tool.topSessions || [])
    .slice(0, 8)
    .map(
      (row) => `<article class="memory-file">
      <div class="name">${esc(row.label || row.sessionId || "-")}</div>
      <div class="path">${esc(row.agentId || "-")} · ${esc(row.channel || "unknown")}</div>
      <div class="muted">${fmtInt(row.count || 0)} ${state.lang === "zh" ? "次" : "calls"} · ${esc(fmtDate(row.updatedAt))}</div>
      <button class="cmd-btn" type="button" data-drill-session="${esc(row.id || "")}">${state.lang === "zh" ? "打开会话" : "Open Session"}</button>
    </article>`,
    )
    .join("");
  els.toolDrilldown.innerHTML = `
    <article class="alert info"><strong>${state.lang === "zh" ? "按 Agent" : "By Agent"}</strong><div>${esc(byAgent || "-")}</div></article>
    <article class="alert info"><strong>${state.lang === "zh" ? "按渠道" : "By Channel"}</strong><div>${esc(byChannel || "-")}</div></article>
    <div class="memory-files">${topSessions || `<div class="muted">${state.lang === "zh" ? "暂无会话样本。" : "No session samples."}</div>`}</div>
  `;
  els.toolDrilldown.querySelectorAll("[data-drill-session]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-drill-session");
      if (!id || !state.data) {
        return;
      }
      state.selectedSessionId = id;
      renderSessions(state.data);
      els.inspector?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  const unknownRows = (data.aggregates.unknownChannelBreakdown || []).slice(0, 12);
  const unknownReq = unknownRows.reduce((sum, row) => sum + (row.total ?? 0), 0);
  els.unknownBreakdownMeta.textContent =
    unknownRows.length > 0
      ? state.lang === "zh"
        ? `${fmtInt(unknownReq)} 次请求已细分`
        : `${fmtInt(unknownReq)} requests classified`
      : state.lang === "zh"
        ? "当前无 unknown 请求"
        : "No unknown requests";
  renderBars({
    mount: els.unknownBreakdown,
    rows: unknownRows,
    valueGetter: (row) => row.total ?? 0,
    labelGetter: (row) => (state.lang === "zh" ? row.labelZh ?? row.label ?? row.type : row.label ?? row.type),
    valueFormatter: (value, row) =>
      state.lang === "zh"
        ? `${fmtInt(value)} 请求 · ${fmtInt(row.sessions ?? 0)} 会话`
        : `${fmtInt(value)} req · ${fmtInt(row.sessions ?? 0)} sessions`,
    emptyText: state.lang === "zh" ? "暂无 unknown 细分数据" : "No unknown breakdown data",
  });
  const samples = Array.isArray(data.aggregates.unknownChannelSamples)
    ? data.aggregates.unknownChannelSamples.slice(0, 8)
    : [];
  if (samples.length && els.unknownBreakdown) {
    const rows = samples
      .map(
        (row) => `<article class="memory-file">
      <div class="name">${esc(
        state.lang === "zh"
          ? row.typeLabelZh || row.typeLabel || row.type || "unknown"
          : row.typeLabel || row.type || "unknown",
      )}</div>
      <div class="path">${esc(row.agentId || "-")} · ${esc(row.sessionId || "-")}</div>
      <div class="muted">${esc(row.reason || "-")} · ${esc(fmtDate(row.updatedAt))}</div>
    </article>`,
      )
      .join("");
    els.unknownBreakdown.innerHTML += `<div class="memory-files">${rows}</div>`;
  }
}

function renderKeyFiles(data) {
  const keyFiles = data.keyFiles || { totals: [], daily: [] };
  const dailyRows = Array.isArray(keyFiles.daily) ? keyFiles.daily : [];
  const totalHits = Number.isFinite(keyFiles.totalHits) ? keyFiles.totalHits : 0;
  const eventCount = Number.isFinite(keyFiles.eventCount) ? keyFiles.eventCount : 0;
  if (dailyRows.length > 0) {
    els.keyFileMeta.textContent =
      state.lang === "zh"
        ? `${dailyRows.length} 天 · 累计 ${fmtInt(totalHits)} 次访问 · ${fmtInt(eventCount)} 条路径事件`
        : `${dailyRows.length} days · ${fmtInt(totalHits)} total hits · ${fmtInt(eventCount)} path events`;
  } else {
    els.keyFileMeta.textContent = state.lang === "zh" ? "无关键文件访问记录" : "No key-file access records";
  }

  renderInteractiveDualChart({
    key: "keyfiles",
    mount: els.keyFileChart,
    labels: dailyRows.map((row) => row.date),
    seriesA: dailyRows.map((row) => row.total ?? 0),
    seriesB: dailyRows.map((row) => {
      const counts = row.counts || {};
      return (counts.agentMd ?? 0) + (counts.toolsMd ?? 0) + (counts.soulMd ?? 0);
    }),
    nameA: state.lang === "zh" ? "总访问" : "Total Access",
    nameB: state.lang === "zh" ? "规范文件" : "Doc Hits",
    colorA: "#8b9f92",
    colorB: "#b58f7f",
    axisAFormatter: (value) => compactAxisValue(value),
    axisBFormatter: (value) => compactAxisValue(value),
  });

  const rows = [
    {
      level: "info",
      title: state.lang === "zh" ? "统计口径" : "Counting Method",
      text:
        state.lang === "zh"
          ? "按路径事件计数：解析 tool_use/tool_result/input/result 中的 path 字段，命中 AGENT.md、TOOLS.md、SOUL.md、memory/*。"
          : "Path-event counting: parse path-like fields in tool_use/tool_result/input/result and match AGENT.md, TOOLS.md, SOUL.md, memory/*.",
    },
    {
      level: "warn",
      title: state.lang === "zh" ? "准确性边界" : "Accuracy Boundary",
      text:
        state.lang === "zh"
          ? "仅统计日志内可见路径。若工具未记录 path 或字段缺失，则不会计入。"
          : "Only paths visible in logs are counted. Missing tool path fields are not countable.",
    },
  ];
  els.keyFileMethod.innerHTML = rows
    .map((row) => `<article class="alert ${row.level}"><strong>${esc(row.title)}</strong><div>${esc(row.text)}</div></article>`)
    .join("");
}

function renderSessionWaterfall(session) {
  const spans = (session.waterfall || [])
    .filter((item) => typeof item.startTs === "number" && typeof item.endTs === "number")
    .sort((a, b) => a.startTs - b.startTs);
  if (!spans.length) {
    return `<div class="muted">${state.lang === "zh" ? "当前窗口无响应瀑布数据。" : "No waterfall spans for selected window."}</div>`;
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

async function openMemoryFile(relativePath) {
  if (!relativePath) {
    return;
  }
  if (state.memoryDetailPath === relativePath) {
    state.memoryDetailPath = null;
    state.memoryDetailLoadingPath = null;
    state.memoryDetailError = "";
    if (state.data) {
      renderMemory(state.data);
    }
    return;
  }
  state.memoryDetailPath = relativePath;
  state.memoryDetailLoadingPath = relativePath;
  state.memoryDetailError = "";
  if (state.data) {
    renderMemory(state.data);
  }
  try {
    if (!state.memoryDetailCache.has(relativePath)) {
      const res = await fetch(`/api/memory-file?path=${encodeURIComponent(relativePath)}`, {
        cache: "no-store",
      });
      const payload = await res.json();
      if (!payload.ok || !payload.file) {
        throw new Error(payload.error || "memory file request failed");
      }
      state.memoryDetailCache.set(relativePath, payload.file);
    }
  } catch (error) {
    state.memoryDetailError = error instanceof Error ? error.message : String(error);
  } finally {
    state.memoryDetailLoadingPath = null;
    if (state.data) {
      renderMemory(state.data);
    }
  }
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
    .map((cell) => `<div class="memory-cell"><span class="muted">${esc(cell.label)}</span><strong>${esc(cell.value)}</strong></div>`)
    .join("");

  els.memoryKeywords.innerHTML = (memory.keywords || [])
    .slice(0, 20)
    .map((item) => `<span class="chip">${esc(item.word)} · ${esc(item.count)}</span>`)
    .join("") || `<span class="muted">${state.lang === "zh" ? "暂无关键词。" : "No keywords."}</span>`;

  const query = state.memoryQuery.trim().toLowerCase();
  const files = Array.isArray(memory.files) ? memory.files : [];
  const filtered = query
    ? files.filter((file) => {
        const text = `${file.title ?? ""} ${file.relativePath ?? ""} ${file.snippet ?? ""}`.toLowerCase();
        return text.includes(query);
      })
    : files;

  els.memoryFilesCount.textContent =
    state.lang === "zh"
      ? `展示 ${fmtInt(filtered.length)} / ${fmtInt(files.length)}（总文件 ${fmtInt(memory.fileCount)}）`
      : `showing ${fmtInt(filtered.length)} / ${fmtInt(files.length)} (total ${fmtInt(memory.fileCount)})`;

  els.memoryFiles.innerHTML =
    filtered
      .map((file) => {
        const isOpen = state.memoryDetailPath === file.relativePath;
        const cached = state.memoryDetailCache.get(file.relativePath);
        const loading = state.memoryDetailLoadingPath === file.relativePath;
        const detail = isOpen
          ? loading
            ? `<div class="muted">${state.lang === "zh" ? "加载全文中..." : "Loading full file..."}</div>`
            : state.memoryDetailError
              ? `<div class="muted">${esc(state.memoryDetailError)}</div>`
              : cached
                ? `<pre class="memory-full">${esc(cached.content || "")}</pre>
                <div class="muted">${cached.truncated ? (state.lang === "zh" ? "已截断（最大 200,000 字符）" : "truncated (max 200,000 chars)") : ""}</div>`
                : `<div class="muted">${state.lang === "zh" ? "无详细内容" : "No details available"}</div>`
          : "";
        return `
          <article class="memory-file">
            <div class="name">${esc(file.title)}</div>
            <div class="path">${esc(file.relativePath)}</div>
            <div class="muted">${esc(fmtBytes(file.size))} · ${esc(fmtDate(file.mtimeMs))}</div>
            <div>${esc(file.snippet || "")}</div>
            <button class="cmd-btn" type="button" data-memory-open="${esc(file.relativePath)}">
              ${isOpen ? (state.lang === "zh" ? "收起全文" : "Hide Full Content") : state.lang === "zh" ? "查看全文" : "View Full Content"}
            </button>
            ${detail}
          </article>
        `;
      })
      .join("") || `<div class="muted">${state.lang === "zh" ? "未发现匹配记忆文件。" : "No matching memory files."}</div>`;

  els.memoryFiles.querySelectorAll("[data-memory-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetPath = button.getAttribute("data-memory-open");
      if (!targetPath) {
        return;
      }
      void openMemoryFile(targetPath);
    });
  });
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
    anomalyCards.push(`<article class="alert info">${state.lang === "zh" ? "当前规则未触发异常。" : "No anomaly triggered by current rules."}</article>`);
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
      .join("") || `<div class="muted">${state.lang === "zh" ? "暂无模型切换会话。" : "No model switching sessions."}</div>`;
}

function renderAlertRules(data) {
  const rules = [
    {
      key: "error_rate",
      title: state.lang === "zh" ? "消息错误率 >= 5%" : "Message Error Rate >= 5%",
      matched: (data.messages.total > 0 ? (data.messages.errors / data.messages.total) * 100 : 0) >= 5,
    },
    {
      key: "request_fail",
      title: state.lang === "zh" ? "请求失败率 >= 8% 且请求 >= 20" : "Request Failure >= 8% with >=20 requests",
      matched: (data.requests.total ?? 0) >= 20 && (data.requests.failureRatePct ?? 0) >= 8,
    },
    {
      key: "vector_err",
      title: state.lang === "zh" ? "向量检索错误率 >= 10% 且检索 >= 10" : "Vector Error >= 10% with >=10 searches",
      matched: (data.vector.searchCalls ?? 0) >= 10 && (data.vector.searchErrorRatePct ?? 0) >= 10,
    },
    {
      key: "qmd_low",
      title: state.lang === "zh" ? "QMD 回源占比 < 40% 且检索 >= 10" : "QMD-backed < 40% with >=10 searches",
      matched: (data.vector.searchCalls ?? 0) >= 10 && (data.vector.qmdBackedRatePct ?? 0) < 40,
    },
    {
      key: "memory_large",
      title: state.lang === "zh" ? "Memory 文件 > 1000" : "Memory files > 1000",
      matched: (data.memory.fileCount ?? 0) > 1000,
    },
  ];

  els.alertRules.innerHTML = rules
    .map(
      (rule) =>
        `<article class="alert rule"><strong>${esc(rule.title)}</strong><div>${
          rule.matched
            ? state.lang === "zh"
              ? "当前已触发"
              : "triggered"
            : state.lang === "zh"
              ? "当前未触发"
              : "not triggered"
        }</div></article>`,
    )
    .join("");
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
  selectOptions(els.channel, data.filters.options.channels || [], state.lang === "zh" ? "全部渠道" : "All channels");
}

function renderAll(data) {
  renderCards(data);
  renderTrend(data);
  renderRequestTrend(data);
  renderRequestHealth(data);
  renderLatency(data);
  renderVector(data);
  renderRankings(data);
  renderRequestBreakdowns(data);
  renderKeyFiles(data);
  renderSessions(data);
  renderMemory(data);
  renderAnomalies(data);
  renderAlerts(data);
  renderAlertRules(data);
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
    params.set("memoryLimit", "0");
    params.set("timelineLimit", "320");

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
  if (els.memorySearch) {
    els.memorySearch.addEventListener("input", () => {
      state.memoryQuery = els.memorySearch.value || "";
      if (state.data) {
        renderMemory(state.data);
      }
    });
  }
  for (const button of els.commandButtons) {
    button.addEventListener("click", () => {
      state.commandMode = button.getAttribute("data-cmd") || "summary";
      for (const btn of els.commandButtons) {
        btn.classList.toggle("active", btn === button);
      }
      void refreshCommandPreview();
    });
  }

  window.addEventListener("resize", () => {
    for (const chart of charts.values()) {
      chart.resize();
    }
  });
}

state.lang = localStorage.getItem("openclaw_observatory_lang") === "en" ? "en" : "zh";
els.lang.value = state.lang;
state.memoryQuery = "";
applyI18n();
for (const button of els.commandButtons) {
  button.classList.toggle("active", button.getAttribute("data-cmd") === state.commandMode);
}

bindEvents();
fetchData();
setInterval(() => {
  fetchData();
}, 30_000);

window.addEventListener("beforeunload", () => {
  disposeCharts();
});
