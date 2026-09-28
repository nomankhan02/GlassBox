#!/usr/bin/env node
/*
  Renders every diagram in a real browser and asserts the drawing rules the
  site's schematics are supposed to keep:

    - no text overflows its own node (>= 16px of padding each side)
    - no two labels overlap, and none sits on a node or an arrow
    - every arrow is horizontal or vertical, never diagonal
    - nothing (text, arrow, badge) falls outside the viewBox

  It reads real geometry with getBBox(), runs at a wide and a narrow viewport,
  and writes a PNG of each diagram into ./diagram-shots/ so a human can look at
  the drawing too. There is no test framework and no browser-automation
  dependency: it drives the Chrome already on the machine over the DevTools
  protocol.

  Usage: npm run check:diagrams
*/

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "diagram-shots");
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
const SERVER_PORT = 3431;
const DEBUG_PORT = 9333;
const TEXT_PAD_MIN = 16;
const LABEL_GAP_MIN = 12;
const EPS = 0.5;
const VIEWPORTS = [
  { width: 1280, height: 1000 },
  { width: 375, height: 900 },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(message) {
  process.stdout.write(`${message}\n`);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe")
      : null,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

function openWebSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => resolve(socket));
    socket.addEventListener("error", () => reject(new Error(`cannot open ${url}`)));
  });
}

/** A tiny flattened-session DevTools protocol client. */
function createCdp(socket) {
  let nextId = 0;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    }
  });

  return (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = (nextId += 1);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 90000);
      pending.set(id, { resolve, reject, timer });
      socket.send(
        JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }),
      );
    });
}

async function fetchJson(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      /* keep waiting */
    }
    await sleep(300);
  }
  throw new Error(`no response from ${url}`);
}

/**
 * A `next dev` server holds a lock at .next/dev/lock that records its URL, and
 * only one may run per project. Reuse a running one when there is one, so the
 * check works whether or not a dev server is already up.
 */
function runningDevServer() {
  const lockPath = path.join(ROOT, ".next", "dev", "lock");
  if (!existsSync(lockPath)) return null;
  try {
    const info = JSON.parse(readFileSync(lockPath, "utf8"));
    if (info && typeof info.appUrl === "string") {
      return info.appUrl.replace(/\/$/, "");
    }
  } catch {
    /* not a running server */
  }
  return null;
}

async function responds(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(base, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      /* keep waiting */
    }
    await sleep(400);
  }
  throw new Error(`server did not start at ${base}`);
}

async function evaluate(cdp, sessionId, expression, awaitPromise = false) {
  const result = await cdp(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise },
    sessionId,
  );
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "evaluation failed");
  }
  return result.result.value;
}

async function navigate(cdp, sessionId, url) {
  await cdp("Page.navigate", { url }, sessionId);
  const ready = await evaluate(
    cdp,
    sessionId,
    `(async () => {
      const start = Date.now();
      while (Date.now() - start < 50000) {
        if (document.readyState === "complete" && document.fonts.status === "loaded") {
          const el = document.querySelector("svg[data-diagram]");
          if (el && el.getBoundingClientRect().width > 0) {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            return true;
          }
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    })()`,
    true,
  );
  return ready;
}

const MEASURE = `(() => {
  const svg = document.querySelector("svg[data-diagram]");
  if (!svg) return { error: "no diagram svg" };
  const vb = svg.viewBox.baseVal;
  const box = (el) => {
    const b = el.getBBox();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  };
  const nodes = [...svg.querySelectorAll("[data-node]")].map((group) => {
    const rectEl = group.querySelector("[data-node-rect]");
    const lockEl = group.querySelector("[data-node-lock]");
    return {
      id: group.getAttribute("data-node"),
      rect: rectEl ? box(rectEl) : null,
      texts: [...group.querySelectorAll("[data-node-text]")].map(box),
      lock: lockEl ? box(lockEl) : null,
    };
  });
  const arrows = [...svg.querySelectorAll("[data-arrow]")].map((group) => ({
    id: group.getAttribute("data-arrow"),
    segs: [...group.querySelectorAll("[data-arrow-seg]")].map((el) => ({
      box: box(el),
      x1: Number(el.getAttribute("x1")),
      y1: Number(el.getAttribute("y1")),
      x2: Number(el.getAttribute("x2")),
      y2: Number(el.getAttribute("y2")),
    })),
    heads: [...group.querySelectorAll("[data-arrow-head]")].map(box),
    stops: [...group.querySelectorAll("[data-arrow-stop]")].map(box),
  }));
  const texts = [...svg.querySelectorAll("text")].map((el) => {
    const owner = el.closest("[data-node]");
    return {
      box: box(el),
      owner: owner ? owner.getAttribute("data-node") : null,
      content: el.textContent,
    };
  });
  const geometry = [...svg.querySelectorAll("rect,line,path,text")].map((el) => ({
    box: box(el),
    tag: el.tagName,
  }));
  return { viewBox: { w: vb.width, h: vb.height }, nodes, arrows, texts, geometry };
})()`;

function intersects(a, b, pad = 0) {
  return (
    a.x < b.x + b.w + pad &&
    b.x < a.x + a.w + pad &&
    a.y < b.y + b.h + pad &&
    b.y < a.y + a.h + pad
  );
}

function validate(id, viewport, data) {
  const failures = [];
  const { viewBox, nodes, arrows, texts, geometry } = data;
  const where = `${id} @${viewport.width}px`;

  /* Nothing may fall outside the drawing. */
  for (const item of geometry) {
    const { box, tag } = item;
    if (
      box.x < -EPS ||
      box.y < -EPS ||
      box.x + box.w > viewBox.w + EPS ||
      box.y + box.h > viewBox.h + EPS
    ) {
      failures.push(
        `${where}: <${tag}> extends past the viewBox ` +
          `(${box.x.toFixed(1)},${box.y.toFixed(1)} ${box.w.toFixed(1)}x${box.h.toFixed(1)} ` +
          `vs ${viewBox.w}x${viewBox.h})`,
      );
    }
  }

  /* Arrows are horizontal or vertical, never diagonal. */
  for (const arrow of arrows) {
    for (const seg of arrow.segs) {
      if (Math.abs(seg.x2 - seg.x1) > EPS && Math.abs(seg.y2 - seg.y1) > EPS) {
        failures.push(`${where}: diagonal arrow ${arrow.id}`);
      }
    }
  }

  /* Text stays inside its own node, with the minimum padding each side. */
  for (const node of nodes) {
    if (!node.rect) continue;
    for (const text of node.texts) {
      const padding = (node.rect.w - text.w) / 2;
      if (padding < TEXT_PAD_MIN - EPS) {
        failures.push(
          `${where}: node "${node.id}" text is only ${padding.toFixed(1)}px from the edge`,
        );
      }
      if (
        text.x < node.rect.x - EPS ||
        text.y < node.rect.y - EPS ||
        text.x + text.w > node.rect.x + node.rect.w + EPS ||
        text.y + text.h > node.rect.y + node.rect.h + EPS
      ) {
        failures.push(`${where}: node "${node.id}" text overflows its box`);
      }
      if (node.lock && intersects(text, node.lock, 0)) {
        failures.push(`${where}: node "${node.id}" lock overlaps its text`);
      }
    }
  }

  /* No two labels overlap, and none crowds another. */
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = texts[i];
      const b = texts[j];
      if (a.owner && a.owner === b.owner) continue;
      if (intersects(a.box, b.box, 0)) {
        failures.push(`${where}: labels overlap: "${a.content}" / "${b.content}"`);
      } else if (intersects(a.box, b.box, LABEL_GAP_MIN / 2)) {
        failures.push(
          `${where}: labels closer than ${LABEL_GAP_MIN}px: "${a.content}" / "${b.content}"`,
        );
      }
    }
  }

  /* A label never sits on a node it does not belong to. */
  for (const text of texts) {
    for (const node of nodes) {
      if (!node.rect || text.owner === node.id) continue;
      if (intersects(text.box, node.rect, 0)) {
        failures.push(`${where}: label "${text.content}" sits on node "${node.id}"`);
      }
    }
  }

  /* A label never sits on an arrow line, arrowhead or stop-bar. */
  const arrowParts = [];
  for (const arrow of arrows) {
    arrowParts.push(...arrow.segs.map((seg) => seg.box));
    arrowParts.push(...arrow.heads);
    arrowParts.push(...arrow.stops);
  }
  for (const text of texts) {
    for (const part of arrowParts) {
      if (intersects(text.box, part, 0)) {
        failures.push(`${where}: label "${text.content}" sits on an arrow`);
      }
    }
  }

  return failures;
}

async function screenshot(cdp, sessionId, file) {
  const rect = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const el = document.querySelector("svg[data-diagram]");
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })()`,
  );
  await sleep(120);
  const shot = await cdp(
    "Page.captureScreenshot",
    {
      format: "png",
      captureBeyondViewport: true,
      clip: {
        x: Math.max(0, rect.x + (await evaluate(cdp, sessionId, "window.scrollX"))),
        y: Math.max(0, rect.y + (await evaluate(cdp, sessionId, "window.scrollY"))),
        width: rect.w,
        height: rect.h,
        scale: 1,
      },
    },
    sessionId,
  );
  writeFileSync(file, Buffer.from(shot.data, "base64"));
}

async function main() {
  if (typeof WebSocket === "undefined") {
    log("check:diagrams needs Node 22+ for its built-in WebSocket.");
    process.exitCode = 1;
    return;
  }

  const chrome = findChrome();
  if (!chrome) {
    log("Could not find Chrome. Set CHROME_PATH to the browser binary.");
    process.exitCode = 1;
    return;
  }

  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  const userDataDir = path.join(tmpdir(), `glassbox-diagram-check-${Date.now()}`);

  const existing = runningDevServer();
  const reuse = existing !== null && (await responds(existing));
  const base = reuse ? existing : `http://127.0.0.1:${SERVER_PORT}`;
  if (reuse) log(`Using the dev server already running at ${base}.`);

  const server = reuse
    ? null
    : spawn(process.execPath, [NEXT_BIN, "dev", "-p", String(SERVER_PORT)], {
        cwd: ROOT,
        stdio: "ignore",
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      });

  const browser = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const cleanup = () => {
    try {
      server?.kill();
    } catch {
      /* already gone */
    }
    try {
      browser.kill();
    } catch {
      /* already gone */
    }
    /* The browser may still hold its profile for a moment; leaving it is fine. */
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* locked by a still-closing browser */
    }
  };

  const failures = [];

  try {
    await waitForServer(base);
    await fetch(`${base}/concepts`).catch(() => {});

    const version = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const socket = await openWebSocket(version.webSocketDebuggerUrl);
    const cdp = createCdp(socket);
    const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });

    await cdp("Page.enable", {}, sessionId);
    await cdp("Runtime.enable", {}, sessionId);
    await cdp(
      "Emulation.setEmulatedMedia",
      { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
      sessionId,
    );

    await navigate(cdp, sessionId, `${base}/concepts`);
    const ids = await evaluate(
      cdp,
      sessionId,
      `[...document.querySelectorAll('button[aria-controls$="-panel"]')].map((b) =>
        b.getAttribute("aria-controls").replace(/-panel$/, ""))`,
    );

    let checked = 0;

    for (const viewport of VIEWPORTS) {
      await cdp(
        "Emulation.setDeviceMetricsOverride",
        {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: false,
        },
        sessionId,
      );

      for (const id of ids) {
        const ready = await navigate(cdp, sessionId, `${base}/concepts#${id}`);
        if (!ready) continue;

        const data = await evaluate(cdp, sessionId, MEASURE);
        if (data.error) throw new Error(`${id}: ${data.error}`);

        checked += 1;
        if (process.env.DIAGRAM_CHECK_DEBUG) {
          log(
            `  ${id} @${viewport.width}: ${data.nodes.length} nodes, ` +
              `${data.arrows.length} arrows, ${data.texts.length} texts, ` +
              `viewBox ${data.viewBox.w}x${data.viewBox.h}`,
          );
        }
        failures.push(...validate(id, viewport, data));
        await screenshot(cdp, sessionId, path.join(SHOTS, `${id}-${viewport.width}.png`));
      }
    }

    log(`Rendered ${checked} diagram views; ${failures.length} problem(s).`);
    for (const failure of failures) log(`  ✗ ${failure}`);
    if (failures.length > 0) {
      log(`Screenshots written to ${path.relative(ROOT, SHOTS)}/`);
      process.exitCode = 1;
    } else {
      log(`Clean. Screenshots written to ${path.relative(ROOT, SHOTS)}/`);
    }

    socket.close();
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  log(`check:diagrams failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
