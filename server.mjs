#!/usr/bin/env node
import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectOpenClawMetrics } from "./collector.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");

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

function mimeType(filePath) {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  return "text/plain; charset=utf-8";
}

function asNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function readQuery(url) {
  const query = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  return query;
}

async function serveStatic(res, filePath) {
  try {
    const content = await fsp.readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeType(filePath),
      "cache-control": "no-cache",
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
}

function createCollectorCache(ttlMs = 15_000) {
  const cache = new Map();
  return {
    async get(options) {
      const key = JSON.stringify(options);
      const now = Date.now();
      const current = cache.get(key);
      if (current && now - current.createdAt < ttlMs) {
        return current.payload;
      }
      const payload = await collectOpenClawMetrics(options);
      cache.set(key, { createdAt: now, payload });
      return payload;
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = typeof args.host === "string" ? args.host : "127.0.0.1";
  const port = asNumber(args.port, 3188);
  const cache = createCollectorCache(asNumber(args["cache-ms"], 15_000));

  const fixedOptions = {
    stateDir: typeof args["state-dir"] === "string" ? args["state-dir"] : undefined,
    workspaceDir:
      typeof args["workspace-dir"] === "string" ? args["workspace-dir"] : undefined,
  };

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      json(res, 400, { ok: false, error: "invalid request url" });
      return;
    }

    const url = new URL(req.url, `http://${host}:${port}`);

    if (url.pathname === "/api/health") {
      json(res, 200, { ok: true, now: Date.now() });
      return;
    }

    if (url.pathname === "/api/collect") {
      try {
        const query = readQuery(url);
        const options = {
          ...fixedOptions,
          days: query.days && query.days !== "" ? query.days : "30",
          agent: query.agent || undefined,
          channel: query.channel || undefined,
          sessionLimit: asNumber(query.sessionLimit, 250),
          memoryLimit: asNumber(query.memoryLimit, 100),
          timelineLimit: asNumber(query.timelineLimit, 240),
        };
        const payload = await cache.get(options);
        json(res, 200, { ok: true, data: payload });
      } catch (error) {
        json(res, 500, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      await serveStatic(res, path.join(PUBLIC_DIR, "index.html"));
      return;
    }

    if (url.pathname === "/app.js") {
      await serveStatic(res, path.join(PUBLIC_DIR, "app.js"));
      return;
    }

    if (url.pathname === "/styles.css") {
      await serveStatic(res, path.join(PUBLIC_DIR, "styles.css"));
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  });

  server.listen(port, host, () => {
    process.stdout.write(
      `OpenClaw Observatory running at http://${host}:${port}\n` +
        `API: http://${host}:${port}/api/collect?days=30\n`,
    );
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
