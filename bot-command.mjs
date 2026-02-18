#!/usr/bin/env node
import { buildCommandText, collectOpenClawMetrics } from "./collector.mjs";

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

function asNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = typeof args.cmd === "string" ? args.cmd : "summary";
  const payload = await collectOpenClawMetrics({
    stateDir: typeof args["state-dir"] === "string" ? args["state-dir"] : undefined,
    workspaceDir:
      typeof args["workspace-dir"] === "string" ? args["workspace-dir"] : undefined,
    days: typeof args.days === "string" ? args.days : "30",
    agent: typeof args.agent === "string" ? args.agent : undefined,
    channel: typeof args.channel === "string" ? args.channel : undefined,
    sessionLimit: asNumber(args["session-limit"], 250),
    memoryLimit: asNumber(args["memory-limit"], 100),
    timelineLimit: asNumber(args["timeline-limit"], 240),
    premiumModelPattern:
      typeof args["premium-model-pattern"] === "string"
        ? args["premium-model-pattern"]
        : undefined,
  });

  const text = buildCommandText(payload, {
    command,
    maxItems: asNumber(args["max-items"], 6),
    lang: typeof args.lang === "string" ? args.lang : undefined,
  });
  process.stdout.write(`${text}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
