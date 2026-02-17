const els = {
  days: document.getElementById("daysSelect"),
  agent: document.getElementById("agentSelect"),
  channel: document.getElementById("channelSelect"),
  requestQuota: document.getElementById("requestQuotaInput"),
  premiumQuota: document.getElementById("premiumQuotaInput"),
  refresh: document.getElementById("refreshBtn"),
  cards: document.getElementById("kpiCards"),
  trend: document.getElementById("trendChart"),
  trendMeta: document.getElementById("trendMeta"),
  requestTrend: document.getElementById("requestTrendChart"),
  requestTrendMeta: document.getElementById("requestTrendMeta"),
  requestHealth: document.getElementById("requestHealthChart"),
  requestHealthMeta: document.getElementById("requestHealthMeta"),
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
};

function fmtInt(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return value.toLocaleString("en-US");
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
  return new Date(value).toLocaleString();
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
  els.refresh.textContent = on ? "Loading…" : "Refresh";
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
  const cards = [
    {
      label: "Sessions In Scope",
      value: fmtInt(data.summary.sessionsInScope),
      hint: `${fmtInt(data.summary.sessionsScanned)} scanned`,
    },
    {
      label: "Total Tokens",
      value: fmtTokens(data.summary.totalTokens),
      hint: `input ${fmtTokens(data.totals.input)} · output ${fmtTokens(data.totals.output)}`,
    },
    { label: "Total Cost", value: fmtUsd(data.summary.totalCost), hint: "estimated from transcript" },
    {
      label: "Cache Read Share",
      value: fmtPct(data.summary.cacheReadSharePct),
      hint: `${fmtTokens(data.totals.cacheRead)} cache tokens`,
    },
    {
      label: "Requests",
      value: fmtInt(data.summary.totalRequests),
      hint: `${fmtInt(data.summary.billableRequests)} billable · ${fmtInt(data.summary.premiumRequests)} premium`,
    },
    {
      label: "Request Failure",
      value: fmtPct(data.summary.requestFailureRatePct),
      hint: `${fmtInt(data.requests.failed)} failed · ${fmtInt(data.requests.timeout)} timeout`,
    },
    {
      label: "Avg Latency",
      value: fmtMs(data.summary.avgLatencyMs),
      hint: "assistant response latency",
    },
    {
      label: "P95 Latency",
      value: fmtMs(data.summary.p95LatencyMs),
      hint: "tail response time",
    },
    {
      label: "QMD-backed Search",
      value: fmtPct(data.summary.qmdBackedRatePct),
      hint: `${fmtInt(data.summary.vectorSearches)} vector searches`,
    },
    {
      label: "Request Quota",
      value: totalQuota ? `${fmtInt(data.quota.totalUsed)} / ${fmtInt(totalQuota)}` : "Unlimited",
      hint: totalQuota ? `${fmtPct(data.quota.totalUsagePct)} used` : "not configured",
    },
    {
      label: "Premium Quota",
      value: premiumQuota
        ? `${fmtInt(data.quota.premiumUsed)} / ${fmtInt(premiumQuota)}`
        : "Unlimited",
      hint: premiumQuota ? `${fmtPct(data.quota.premiumUsagePct)} used` : "not configured",
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

function renderDualLineChart({ mount, seriesA, seriesB, colorA, colorB }) {
  const width = Math.max(mount.clientWidth - 16, 320);
  const height = 220;
  const pad = 18;

  if (!seriesA.length) {
    mount.innerHTML = `<div class="muted">No data in selected range.</div>`;
    return;
  }

  const pointsA = seriesA.map((v, i) => ({ x: i, v }));
  const pointsB = seriesB.map((v, i) => ({ x: i, v }));

  const pathA = linePath(pointsA, width, height, pad);
  const pathB = linePath(pointsB, width, height, pad);

  mount.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ga" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="${colorA}"/>
          <stop offset="100%" stop-color="#9af4ff"/>
        </linearGradient>
        <linearGradient id="gb" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="${colorB}"/>
          <stop offset="100%" stop-color="#ffe2ab"/>
        </linearGradient>
      </defs>
      <path d="${pathA}" fill="none" stroke="url(#ga)" stroke-width="2.3" />
      <path d="${pathB}" fill="none" stroke="url(#gb)" stroke-width="2.3" stroke-dasharray="5 4" />
    </svg>
  `;
}

function renderTrend(data) {
  const daily = data.aggregates.daily || [];
  els.trendMeta.textContent = `${daily.length} days`;
  renderDualLineChart({
    mount: els.trend,
    seriesA: daily.map((d) => d.tokens),
    seriesB: daily.map((d) => d.cost),
    colorA: "#5ad0ff",
    colorB: "#ffb86a",
  });
}

function renderLatency(data) {
  const daily = data.aggregates.daily || [];
  els.latencyMeta.textContent = `${daily.filter((d) => d.latency).length} days with latency`;
  renderDualLineChart({
    mount: els.latency,
    seriesA: daily.map((d) => d.latency?.avgMs ?? 0),
    seriesB: daily.map((d) => d.latency?.p95Ms ?? 0),
    colorA: "#6adf93",
    colorB: "#ffd076",
  });
}

function renderRequestTrend(data) {
  const daily = data.aggregates.daily || [];
  const withReq = daily.filter((d) => (d.requests ?? 0) > 0).length;
  els.requestTrendMeta.textContent = `${withReq} days with requests`;
  renderDualLineChart({
    mount: els.requestTrend,
    seriesA: daily.map((d) => d.requests ?? 0),
    seriesB: daily.map((d) => d.premiumRequests ?? 0),
    colorA: "#6ec8ff",
    colorB: "#ffcf6e",
  });
}

function renderRequestHealth(data) {
  const daily = data.aggregates.daily || [];
  els.requestHealthMeta.textContent = `${daily.length} days`;
  renderDualLineChart({
    mount: els.requestHealth,
    seriesA: daily.map((d) => d.requestErrors ?? 0),
    seriesB: daily.map((d) => d.requestTimeouts ?? 0),
    colorA: "#ff8d9a",
    colorB: "#ffd47a",
  });
}

function renderQuota(data) {
  const quota = data.quota || {};
  const rows = [
    {
      label: "Total Requests",
      value: quota.totalLimit ? `${fmtInt(quota.totalUsed)} / ${fmtInt(quota.totalLimit)}` : "Unlimited",
      sub: quota.totalLimit ? `${fmtPct(quota.totalUsagePct)} used` : "No cap configured",
    },
    {
      label: "Premium Requests",
      value: quota.premiumLimit
        ? `${fmtInt(quota.premiumUsed)} / ${fmtInt(quota.premiumLimit)}`
        : "Unlimited",
      sub: quota.premiumLimit ? `${fmtPct(quota.premiumUsagePct)} used` : "No cap configured",
    },
    {
      label: "Remaining",
      value: `${quota.totalRemaining ?? "∞"} total`,
      sub: `${quota.premiumRemaining ?? "∞"} premium`,
    },
    {
      label: "Billable Ratio",
      value: fmtPct(data.requests.billableRatePct),
      sub: `${fmtInt(data.requests.billable)} of ${fmtInt(data.requests.total)}`,
    },
  ];

  els.quotaMeta.textContent =
    quota.totalLimit || quota.premiumLimit ? "tracked with configured caps" : "caps not configured";
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
      const color = span.error ? "#ff7f86" : "#5ad0ff";
      return `<rect x="${x1.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${rowHeight}" rx="3" fill="${color}" opacity="0.9"></rect>`;
    })
    .join("");

  const axisY = height - 14;
  const startLabel = new Date(minTs).toLocaleTimeString();
  const endLabel = new Date(maxTs).toLocaleTimeString();

  return `
    <div class="wf-meta">
      <span>${latest.length} assistant turns</span>
      <span>${startLabel} → ${endLabel}</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="waterfall-svg">
      <line x1="${pad}" y1="${axisY}" x2="${width - pad}" y2="${axisY}" stroke="rgba(164,198,232,0.35)" stroke-width="1"></line>
      ${bars}
    </svg>
    <div class="wf-legend">
      <span><i style="background:#5ad0ff"></i> normal turn</span>
      <span><i style="background:#ff7f86"></i> error turn</span>
    </div>
  `;
}

function renderTimelineEvents(session) {
  const rows = (session.timeline || [])
    .filter((item) => typeof item.timestamp === "number")
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-14);
  if (!rows.length) {
    return '<div class="muted">No timeline events.</div>';
  }
  return rows
    .map((item) => {
      const stamp = new Date(item.timestamp).toLocaleTimeString();
      const tag = item.isError ? '<span class="tag bad">error</span>' : "";
      const model = item.model ? `${item.provider ?? "unknown"}/${item.model}` : "n/a";
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
    els.inspector.textContent = "No session selected.";
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
  els.sessionCount.textContent = `${rows.length} rows`;

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
  els.memoryMeta.textContent = memory.exists ? memory.relativePath || memory.memoryDir : "memory dir not found";

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
    .join("") || '<span class="muted">No keywords.</span>';

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
    .join("") || '<div class="muted">No memory files found.</div>';
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
    els.alerts.innerHTML = '<div class="alert info">No alerts. System currently looks healthy.</div>';
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
    params.set("maxItems", "8");
    const res = await fetch(`/api/command?${params.toString()}`, { cache: "no-store" });
    const payload = await res.json();
    if (!payload.ok) {
      throw new Error(payload.error || "command preview failed");
    }
    els.commandPreview.textContent = payload.text || "(empty command output)";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    els.commandPreview.textContent = `command preview failed: ${message}`;
  }
}

function updateFiltersFromData(data) {
  selectOptions(els.agent, data.filters.options.agents || [], "All agents");
  selectOptions(els.channel, data.filters.options.channels || [], "All channels");
}

function renderAll(data) {
  renderCards(data);
  renderTrend(data);
  renderRequestTrend(data);
  renderRequestHealth(data);
  renderQuota(data);
  renderVector(data);
  renderLatency(data);
  renderRankings(data);
  renderRequestBreakdowns(data);
  renderSessions(data);
  renderMemory(data);
  renderAnomalies(data);
  renderAlerts(data);
  els.generatedAt.textContent = `Generated ${fmtDate(data.generatedAt)} · range: ${data.range.days}`;
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
    els.alerts.innerHTML = `<article class="alert bad"><strong>Data Load Failed</strong><div>${esc(message)}</div></article>`;
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
