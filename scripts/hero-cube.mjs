#!/usr/bin/env node
/*
  Drives the machine's Chrome over the DevTools protocol, the way
  scripts/check-diagrams.mjs does, to check the things about a WebGL hero that a
  source read cannot show, and to render the still that stands in for it.

  Two modes:

    node scripts/hero-cube.mjs --poster
        Renders public/hero-cube.png from the live cube. The fallback image is
        the same object the browser draws, captured rather than drawn by hand,
        and this is how it is made and re-made.

    node scripts/hero-cube.mjs
        Checks the hero cube:

          - the live cube is actually drawing, and drawing a cube: a dark field,
            blown-white edges, visible colour fringing, and depth inside the
            glass rather than a flat silhouette
          - its field, and its edges, measure up against
            design-reference/hero-inspo.png
          - it turns on its own, with no pointer involved
          - under prefers-reduced-motion it stops turning and keeps rendering —
            checked by pixel difference, not by reading a flag
          - with WebGL unavailable it never mounts a canvas, leaves the still
            standing, and never fetches the renderer
          - on an emulated mid-range phone with the CPU throttled 4x, what the
            cube costs per frame, and that the canvas resolution is clamped

        --perf  only the frame-budget measurement, which is the slow one.

  Software rendering is the caveat on every timing here: headless Chrome draws
  WebGL through SwiftShader, on the CPU. The absolute numbers are pessimistic by
  a large factor, and the useful signal is the comparison — cube against no
  cube, one transmission buffer size against another.
*/

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
const SERVER_PORT = 3457;
/* localhost, not 127.0.0.1: Next 16 refuses to serve its dev client across
   origins, and the page then never hydrates in dev. The two host names are the
   same server and different origins, which cost an hour. */
const HOST = "localhost";
const DEBUG_PORT = 9339;
const REFERENCE = path.join(ROOT, "design-reference", "hero-inspo.png");
const POSTER = path.join(ROOT, "public", "hero-cube.png");

const MODE = process.argv.includes("--poster")
  ? "poster"
  : process.argv.includes("--perf")
    ? "perf"
    : process.argv.includes("--probe")
      ? "probe"
      : "check";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => process.stdout.write(`${message}\n`);

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
    "/usr/bin/chromium",
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

function createCdp(socket) {
  let nextId = 0;
  const pending = new Map();
  const listeners = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
      return;
    }
    listeners.forEach((listener) => listener(message));
  });
  return {
    send: (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = (nextId += 1);
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, 180000);
        pending.set(id, { resolve, reject, timer });
        socket.send(
          JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }),
        );
      }),
    on: (listener) => listeners.push(listener),
  };
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

function runningDevServer() {
  const lockPath = path.join(ROOT, ".next", "dev", "lock");
  if (!existsSync(lockPath)) return null;
  try {
    const info = JSON.parse(readFileSync(lockPath, "utf8"));
    if (info && typeof info.appUrl === "string") return info.appUrl.replace(/\/$/, "");
  } catch {
    /* not a running server */
  }
  return null;
}

async function responds(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitForServer(base, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {
      /* keep waiting */
    }
    await sleep(400);
  }
  throw new Error(`server did not start at ${base}`);
}

/**
 * Evaluate in the page, retrying the one failure that is not really a failure:
 * an evaluation caught in flight while the document is being replaced reports
 * "Inspected target navigated or closed" and means nothing more than "ask again".
 */
async function evaluate(cdp, sessionId, expression, awaitPromise = false, attempts = 4) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await cdp.send(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise },
        sessionId,
      );
      if (result.exceptionDetails) {
        throw new Error(
          result.exceptionDetails.exception?.description || "evaluation failed",
        );
      }
      return result.result.value;
    } catch (error) {
      const message = String(error && error.message);
      const transient =
        /navigated or closed|context was destroyed|cannot find context/i.test(message);
      if (!transient || attempt >= attempts) throw error;
      await sleep(400);
    }
  }
}

/**
 * Navigate, and wait for the page to be ready to be measured. The marker is
 * planted in the old document first, so a poll tick can never be answered by the
 * page that is on its way out.
 */
async function open(cdp, sessionId, url, ready = "async () => true") {
  await evaluate(cdp, sessionId, 'window.__hcProbe = "old"; true').catch(() => {});
  await cdp.send(
    "Page.navigate",
    { url: `${url}${url.includes("?") ? "&" : "?"}hc=${Date.now()}` },
    sessionId,
  );
  return evaluate(
    cdp,
    sessionId,
    `(async () => {
      const waitFor = ${ready};
      const start = Date.now();
      while (Date.now() - start < 60000) {
        if (typeof window.__hcProbe !== "undefined") {
          await new Promise((r) => setTimeout(r, 60));
          continue;
        }
        if (document.readyState === "complete" && document.fonts.status === "loaded") {
          if (await waitFor()) {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await new Promise((r) => setTimeout(r, 400));
            return true;
          }
        }
        await new Promise((r) => setTimeout(r, 120));
      }
      return false;
    })()`,
    true,
  );
}

/** Wait for the hero's live canvas to exist and have painted something. */
const CUBE_READY = `async () => {
  const host = document.querySelector("[data-hero-cube]");
  if (!host || host.getAttribute("data-hero-cube") !== "live") return false;
  const canvas = host.querySelector("canvas");
  if (!canvas || canvas.width === 0) return false;
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  return !!gl;
}`;

const CUBE_FACTS = `(() => {
  const host = document.querySelector("[data-hero-cube]");
  if (!host) return { error: "no hero cube" };
  const canvas = host.querySelector("canvas");
  const still = host.querySelector("[data-hero-cube-still]");
  const rect = canvas ? canvas.getBoundingClientRect() : host.getBoundingClientRect();
  const gl = canvas ? canvas.getContext("webgl2") || canvas.getContext("webgl") : null;
  return {
    state: host.getAttribute("data-hero-cube"),
    canvasCount: document.querySelectorAll("[data-hero-cube] canvas").length,
    bufferW: canvas ? canvas.width : 0,
    bufferH: canvas ? canvas.height : 0,
    cssW: Math.round(rect.width),
    cssH: Math.round(rect.height),
    /* The renderer's own idea of the device pixel ratio, after the clamp. */
    renderer: gl ? gl.getParameter(gl.VERSION) : null,
    stillSrc: still ? still.getAttribute("src") : null,
    stillLoaded: still ? still.complete && still.naturalWidth > 0 : false,
    stillVisible: still
      ? (() => {
          const s = getComputedStyle(still);
          return s.display !== "none" && Number(s.opacity) > 0;
        })()
      : false,
    clip: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
    pointerEvents: getComputedStyle(host).pointerEvents,
    heroBg: (() => {
      const hero = document.querySelector("[data-hero]");
      return hero ? getComputedStyle(hero).backgroundColor : null;
    })(),
    heroText: (() => {
      const p = document.querySelector("[data-hero] p");
      if (!p) return null;
      return { colour: getComputedStyle(p).color, text: p.textContent.trim().slice(0, 42) };
    })(),
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  };
})()`;

/**
 * Screenshot a clip and hand it back as a data URL.
 *
 * PNG, not JPEG, and not for the size: JPEG subsamples colour, which puts
 * colour fringes of its own along every sharp edge — exactly the thing being
 * measured here — and its block noise would show up as frame-to-frame movement
 * in a cube that is standing still.
 */
async function capture(cdp, sessionId, clip, scale = 2) {
  /*
    Twice, and the second one counts. The first capture in a freshly painted
    document sometimes comes back as the canvas layer over nothing — the page's
    own background is missing from the composite, so a transparent canvas reads
    as pure black and every number taken from it is wrong. Asking twice settles
    it. (This is a headless-Chrome-with-SwiftShader quirk, not something the
    hero does: a screenshot from the devtools UI of the same frame shows the
    field.)
  */
  let last = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await cdp.send(
      "Page.captureScreenshot",
      {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
        clip: { ...clip, scale },
      },
      sessionId,
    );
    last = result.data;
    await sleep(120);
  }
  return `data:image/png;base64,${last}`;
}

/** The translateY out of a computed matrix, for reading the drawer's travel. */
function translateY(transform) {
  if (!transform || transform === "none") return 0;
  const match = transform.match(/matrix(3d)?\(([^)]+)\)/);
  if (!match) return 0;
  const parts = match[2].split(",").map((value) => Number(value.trim()));
  return match[1] ? parts[13] : parts[5];
}

/**
 * Runs in the page: decodes the frames, crops each to a centred square, and
 * returns both the numbers and the frame-to-frame differences. Pixel work has to
 * happen where the pixels are; Node has no image decoder.
 */
const analyse = (urls, crop) => `(async () => {
  const load = async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  };

  const summarise = (data, width, height) => {
    let sum = 0;
    let dark = 0;
    let glass = 0;
    let bright = 0;
    let blown = 0;
    let maxL = 0;
    let maxChroma = 0;
    let fringed = 0;
    let total = 0;
    let sumSq = 0;
    let transparent = 0;
    const lums = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (data[i + 3] === 0) transparent += 1;
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      sum += l;
      sumSq += l * l;
      if (l < 0.06) dark += 1;
      else if (l < 0.5) glass += 1;
      if (l > 0.85) bright += 1;
      if (l > 0.95) blown += 1;
      if (l > 0.25 && chroma > maxChroma) maxChroma = chroma;
      if (chroma > 40 && l > 0.12) fringed += 1;
      if (l > maxL) maxL = l;
      lums.push(l);
      total += 1;
    }
    lums.sort((a, b) => a - b);
    const at = (fraction) => lums[Math.min(lums.length - 1, Math.floor(lums.length * fraction))];
    const mean = sum / total;
    return {
      w: width,
      h: height,
      meanL: mean,
      sdL: Math.sqrt(Math.max(0, sumSq / total - mean * mean)),
      maxL,
      darkFrac: dark / total,
      glassFrac: glass / total,
      brightFrac: bright / total,
      blownFrac: blown / total,
      maxChroma,
      fringeFrac: fringed / total,
      centre: (() => {
        const middle = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
        return [data[middle], data[middle + 1], data[middle + 2], data[middle + 3]];
      })(),
      p10L: at(0.1),
      p50L: at(0.5),
      p99L: at(0.99),
      transparentFrac: transparent / total,
    };
  };

  const read = async (url) => {
    const image = await load(url);
    const side = Math.floor(Math.min(image.naturalWidth, image.naturalHeight) * ${crop});
    const sx = Math.floor((image.naturalWidth - side) / 2);
    const sy = Math.floor((image.naturalHeight - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    /* The hero's own ground first: the canvas is transparent, so a screenshot
       of it can carry alpha, and a transparent pixel is the field showing
       through, not a black cube. Compositing it here is what the eye sees. */
    ctx.fillStyle = "#05070b";
    ctx.fillRect(0, 0, side, side);
    ctx.drawImage(image, sx, sy, side, side, 0, 0, side, side);
    return { data: ctx.getImageData(0, 0, side, side).data, side };
  };

  const frames = [];
  for (const url of ${JSON.stringify(urls)}) frames.push(await read(url));

  const stats = frames.map((frame) => summarise(frame.data, frame.side, frame.side));
  const diffs = [];
  for (let index = 1; index < frames.length; index += 1) {
    const a = frames[index - 1].data;
    const b = frames[index].data;
    let changed = 0;
    let sum = 0;
    for (let i = 0; i < a.length; i += 4) {
      const delta =
        Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      sum += delta;
      if (delta > 24) changed += 1;
    }
    diffs.push({ meanAbs: sum / (a.length / 4) / 3, changedFrac: changed / (a.length / 4) });
  }

  return { stats, diffs };
})()`;

/**
 * The reference image, as numbers. Photographed through the same path as the
 * render — a screenshot of the image scaled to its own natural size, decoded and
 * summarised in the page — so the two are measured by the same instrument.
 */
async function referenceStats(cdp, cdpGlobal, appSession) {
  const { targetId } = await cdpGlobal("Target.createTarget", {
    url: `file:///${REFERENCE.replace(/\\/g, "/")}`,
  });
  const { sessionId } = await cdpGlobal("Target.attachToTarget", { targetId, flatten: true });
  await cdpGlobal("Page.enable", {}, sessionId);
  await cdpGlobal("Runtime.enable", {}, sessionId);
  try {
    const size = await evaluate(
      cdp,
      sessionId,
      `(async () => {
        for (let i = 0; i < 200; i += 1) {
          const image = document.querySelector("img");
          if (image && image.naturalWidth > 0 && image.complete) {
            return { w: image.naturalWidth, h: image.naturalHeight };
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        return null;
      })()`,
      true,
    );
    if (!size) return null;
    await cdpGlobal(
      "Emulation.setDeviceMetricsOverride",
      { width: size.w, height: size.h, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );
    await sleep(700);
    const shot = await cdpGlobal(
      "Page.captureScreenshot",
      { format: "png", fromSurface: true },
      sessionId,
    );
    const url = `data:image/png;base64,${shot.data}`;
    const result = await evaluate(appSession.cdp, appSession.sessionId, analyse([url], 1), true);
    return { size, stats: result.stats[0] };
  } finally {
    await cdpGlobal("Target.closeTarget", { targetId }).catch(() => {});
  }
}

/* What the page thinks the situation is, for when a check cannot even start. */
const DIAGNOSTICS = `(() => {
  const host = document.querySelector("[data-hero-cube]");
  const probe = {};
  for (const type of ["webgl2", "webgl", "experimental-webgl"]) {
    try {
      probe[type] = !!document.createElement("canvas").getContext(type);
    } catch (error) {
      probe[type] = "threw: " + error.message;
    }
  }
  return {
    webgl: probe,
    host: !!host,
    hostCount: document.querySelectorAll("[data-hero-cube]").length,
    state: host ? host.getAttribute("data-hero-cube") : null,
    hostHtml: host ? host.outerHTML.slice(0, 320) : null,
    heroHtml: (document.querySelector("[data-hero]")?.outerHTML || "").slice(0, 240),
    canvases: document.querySelectorAll("canvas").length,
    /* React marks its root container when it attaches. If none of these exist,
       hydration never started, whatever the page otherwise looks like. */
    reactRoot: [
      Object.keys(document).filter((key) => key.startsWith("__react")).length,
      Object.keys(document.body).filter((key) => key.startsWith("__react")).length,
      Object.keys(document.documentElement).filter((key) => key.startsWith("__react")).length,
    ],
    heroCubeRequests: performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /hero-cube|three|drei/i.test(name)),
  };
})()`;

/*
 * The frame budget, sampled in the page over real rAF ticks.
 *
 * Two numbers, and the second is the one that matters here. The interval
 * between frames is the browser's business — a WebGL canvas rasterises off the
 * main thread, so a slow frame can still be handed over on time. The gap is how
 * far into a frame this callback starts: everything that ran before it in that
 * frame, which is the render loop, is what this measures. On a canvas that is
 * only submitting work, that is the hero's share of the main thread.
 *
 * The first frames are dropped: the material compiles its shader, the HDR
 * arrives, and nothing in the first half second is a steady state.
 */
const FRAME_TIMES = `(async () => {
  const intervals = [];
  const gaps = [];
  let previous = 0;
  await new Promise((resolve) => {
    let count = 0;
    const tick = (now) => {
      if (previous) intervals.push(now - previous);
      previous = now;
      gaps.push(performance.now() - now);
      count += 1;
      if (count < 180) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });

  const summarise = (values) => {
    const sorted = values.slice(20).sort((a, b) => a - b);
    return {
      samples: sorted.length,
      median: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      worst: sorted[sorted.length - 1],
    };
  };

  return { interval: summarise(intervals), gap: summarise(gaps) };
})()`;

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error("no Chrome found; set CHROME_PATH");

  const userDataDir = path.join(tmpdir(), `glassbox-hero-cube-${Date.now()}`);
  /* HERO_CUBE_BASE points the checks at a server that is already up — a
     production `next start`, usually, which is the artifact that ships. */
  const external = process.env.HERO_CUBE_BASE;
  const existing = runningDevServer();
  const reuse = external ? true : existing !== null && (await responds(existing));
  const base = external || (reuse ? existing : `http://${HOST}:${SERVER_PORT}`);
  if (reuse) log(`Using the server already running at ${base}.`);

  const server = reuse
    ? null
    : spawn(process.execPath, [NEXT_BIN, "dev", "-p", String(SERVER_PORT)], {
        cwd: ROOT,
        stdio: "ignore",
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      });

  /*
    WebGL on the CPU: SwiftShader, and the flag that lets it run without a GPU
    at all. Without these, headless Chrome reports no WebGL and every check below
    would be measuring the fallback.
  */
  const softwareGl = process.env.HERO_CUBE_GL !== "off";
  const browser = spawn(
    chrome,
    [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      ...(softwareGl
        ? [
            "--enable-unsafe-swiftshader",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--allow-file-access-from-files",
          ]
        : ["--disable-gpu"]),
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
      /* gone */
    }
    try {
      browser.kill();
    } catch {
      /* gone */
    }
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* still closing */
    }
  };

  const failures = [];
  const check = (ok, message) => {
    log(`${ok ? "  ok  " : "  FAIL"} ${message}`);
    if (!ok) failures.push(message);
  };

  try {
    await waitForServer(base);
    const version = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const socket = await openWebSocket(version.webSocketDebuggerUrl);
    const cdp = createCdp(socket);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send("Log.enable", {}, sessionId);

    const requests = [];
    const consoleLines = [];
    cdp.on((message) => {
      if (message.method === "Network.requestWillBeSent") {
        requests.push(message.params.request.url);
      }
      if (message.method === "Network.responseReceived") {
        const status = message.params.response.status;
        if (status >= 400) {
          consoleLines.push(`[http ${status}] ${message.params.response.url}`);
        }
      }
      if (message.method === "Network.loadingFailed") {
        consoleLines.push(`[failed] ${message.params.errorText}`);
      }
      if (message.method === "Log.entryAdded") {
        consoleLines.push(`[log:${message.params.entry.level}] ${message.params.entry.text}`);
      }
      if (message.method === "Runtime.consoleAPICalled") {
        const text = message.params.args
          .map((arg) => arg.value ?? arg.description ?? arg.type)
          .join(" ");
        consoleLines.push(`[${message.params.type}] ${text}`);
      }
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params.exceptionDetails;
        consoleLines.push(
          `[exception] ${details.exception?.description || details.text}`.slice(0, 400),
        );
      }
    });

    /** When something cannot even start, say what the page is actually doing. */
    const diagnose = async (why) => {
      log(`\n  ${why}. The page reports:`);
      log(`  ${JSON.stringify(await evaluate(cdp, sessionId, DIAGNOSTICS))}`);
      const unique = [...new Set(consoleLines)];
      if (unique.length > 0) log(`  console:\n    ${unique.slice(0, 30).join("\n    ")}`);
    };

    const desktop = { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false };
    const setViewport = (metrics, session = sessionId) =>
      cdp.send("Emulation.setDeviceMetricsOverride", metrics, session);

    const globalCdp = (method, params, session) => cdp.send(method, params, session);

    await setViewport(desktop);

    if (MODE === "probe") {
      if (!(await open(cdp, sessionId, `${base}/`, CUBE_READY))) {
        await diagnose("the live cube never appeared");
      }
      await sleep(1500);
      const facts = await evaluate(cdp, sessionId, CUBE_FACTS);
      const attributes = await evaluate(
        cdp,
        sessionId,
        `(() => {
          const canvas = document.querySelector("[data-hero-cube] canvas");
          if (!canvas) return null;
          const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
          const attrs = gl ? gl.getContextAttributes() : null;
          const still = document.querySelector("[data-hero-cube-still]");
          return {
            alpha: attrs ? attrs.alpha : null,
            premultipliedAlpha: attrs ? attrs.premultipliedAlpha : null,
            stillLoaded: still ? still.complete && still.naturalWidth > 0 : null,
            stillSize: still ? still.naturalWidth + "x" + still.naturalHeight : null,
            buffer: canvas.width + "x" + canvas.height,
          };
        })()`,
      );
      log(`probe facts: ${JSON.stringify({ ...facts, ...attributes })}`);
      for (const scale of [1, 2]) {
        const shot = await capture(cdp, sessionId, facts.clip, scale);
        const result = await evaluate(cdp, sessionId, analyse([shot], 1), true);
        const s = result.stats[0];
        log(
          `  scale ${scale} (${s.w}x${s.h}): mean L ${s.meanL.toFixed(3)}, p10 ${s.p10L.toFixed(3)}, ` +
            `dark ${(s.darkFrac * 100).toFixed(1)}%, glass ${(s.glassFrac * 100).toFixed(1)}%, ` +
            `max L ${s.maxL.toFixed(2)}, chroma ${s.maxChroma.toFixed(0)}, centre ${JSON.stringify(s.centre)}`,
        );
      }
      socket.close();
      return;
    }

    if (MODE === "poster") {
      log("Rendering the still from the live cube:");
      if (!(await open(cdp, sessionId, `${base}/`, CUBE_READY))) {
        await diagnose("the live cube never appeared");
        throw new Error("nothing to capture");
      }
      const facts = await evaluate(cdp, sessionId, CUBE_FACTS);
      /*
        Wait for the cube to actually be in the frame. A canvas with a live
        context is not the same thing as a rendered cube: the material's shader
        compiles first, and on a software rasteriser that takes a while. Capture
        until there is something lit in there, and give up loudly if there never
        is.
      */
      let shot = null;
      let summary = null;
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        shot = await capture(cdp, sessionId, facts.clip);
        const result = await evaluate(cdp, sessionId, analyse([shot], 1), true);
        summary = result.stats[0];
        if (summary.maxL > 0.85) break;
        log(`  nothing drawn yet (max L ${summary.maxL.toFixed(2)}), waiting`);
        await sleep(1500);
      }
      mkdirSync(path.dirname(POSTER), { recursive: true });
      const bytes = Buffer.from(shot.replace(/^data:image\/png;base64,/, ""), "base64");
      writeFileSync(POSTER, bytes);
      log(`  wrote ${path.relative(ROOT, POSTER)} (${Math.round(bytes.length / 1024)} kB, ${facts.bufferW}x${facts.bufferH} buffer -> ${summary.w}px square clip)`);
      log(
        `  the still itself: mean L ${summary.meanL.toFixed(3)}, field p10 ${summary.p10L.toFixed(3)}, ` +
          `bright ${(summary.brightFrac * 100).toFixed(1)}%, max chroma ${summary.maxChroma.toFixed(0)}`,
      );
      check(
        summary.maxL > 0.85 && summary.p10L < 0.06,
        `the still is a lit cube on a dark field (max L ${summary.maxL.toFixed(2)}, p10 ${summary.p10L.toFixed(3)})`,
      );
      log(`\n${failures.length === 0 ? "Clean." : `${failures.length} problem(s).`}`);
      if (failures.length > 0) process.exitCode = 1;
      socket.close();
      return;
    }

    /* ---------- the live cube ---------- */
    log("\nno-preference, 1280x900:");
    if (!(await open(cdp, sessionId, `${base}/`, CUBE_READY))) {
      await diagnose("the live cube never appeared");
      throw new Error("the hero has no live cube to check");
    }
    await sleep(1200);
    const facts = await evaluate(cdp, sessionId, CUBE_FACTS);

    check(facts.state === "live", `the hero reports a live cube (state "${facts.state}")`);
    check(facts.canvasCount === 1, `exactly one canvas is mounted (${facts.canvasCount})`);
    check(
      !!facts.renderer,
      `the browser gave us WebGL (${facts.renderer || "no context"})`,
    );
    check(
      facts.bufferW > 0 && facts.bufferW <= facts.cssW * 2,
      `the drawing buffer is clamped, not retina (${facts.bufferW}px buffer for ${facts.cssW}px of layout)`,
    );
    check(
      facts.pointerEvents === "none",
      `the cube still never takes a click (pointer-events ${facts.pointerEvents})`,
    );
    check(
      facts.stillLoaded && facts.stillSrc === "/hero-cube.png",
      `the still is underneath it and loaded (${facts.stillSrc}, loaded ${facts.stillLoaded})`,
    );
    check(
      /rgb\(5, 7, 11\)/.test(facts.heroBg || ""),
      `the hero's ground is the reference's near-black (${facts.heroBg})`,
    );
    check(
      !!facts.heroText && /rgb\(185, 192, 200\)|rgb\(182, 190, 199\)/.test(facts.heroText.colour),
      `the hero text is now light on it (${facts.heroText?.colour}: "${facts.heroText?.text}...")`,
    );
    check(
      facts.bodyWidth <= facts.viewportWidth,
      `the full-bleed hero does not push the page sideways (${facts.bodyWidth} vs ${facts.viewportWidth})`,
    );

    /*
      Five captures over six seconds. The cube turns, and what a single frame
      holds depends entirely on where in that turn it was taken: the fringing is
      strong when an edge is angled across the view and faint when it is not,
      and the lit fraction of the faces swings the same way. The reference is
      one frozen frame, so it gets compared against the strongest of these, and
      the general numbers come from the middle frame.
    */
    const frames = [await capture(cdp, sessionId, facts.clip)];
    for (let index = 1; index < 5; index += 1) {
      await sleep(1200);
      frames.push(await capture(cdp, sessionId, facts.clip));
    }
    const render = await evaluate(cdp, sessionId, analyse(frames, 1), true);
    const cube = render.stats[2];
    const chromas = render.stats.map((stats) => stats.maxChroma).sort((a, b) => a - b);
    const chromaMax = chromas[chromas.length - 1];
    const chromaMedian = chromas[Math.floor(chromas.length / 2)];
    const moved = Math.max(...render.diffs.map((diff) => diff.meanAbs));
    const movedShare = Math.max(...render.diffs.map((diff) => diff.changedFrac));

    log(
      `  the render: mean L ${cube.meanL.toFixed(3)}, field p10 ${cube.p10L.toFixed(3)}, ` +
        `dark ${(cube.darkFrac * 100).toFixed(1)}%, glass ${(cube.glassFrac * 100).toFixed(1)}%, ` +
        `bright ${(cube.brightFrac * 100).toFixed(1)}%, blown ${(cube.blownFrac * 100).toFixed(2)}%, ` +
        `sd ${cube.sdL.toFixed(3)}`,
    );
    log(
      `  across the turn: max chroma ${chromas.join(" / ")} (median ${chromaMedian.toFixed(0)}), ` +
        `fringed ${(cube.fringeFrac * 100).toFixed(2)}%, frame-to-frame change ${moved.toFixed(1)}/255`,
    );

    check(cube.p10L < 0.08, `the field behind it is dark (p10 L ${cube.p10L.toFixed(3)})`);
    check(cube.maxL > 0.85, `its lit edges blow out, as the reference's do (max L ${cube.maxL.toFixed(2)})`);
    /*
      The share of the frame that is mid-tone glass swings with the turn — a
      face catching the key light is broad, one edge-on is not — so the claim is
      that the cube is a lit body at its brightest moment in the turn, not that
      every frame of it holds the same fraction.
    */
    const glassMost = Math.max(...render.stats.map((stats) => stats.glassFrac));
    check(
      glassMost > 0.08,
      `there is a glass body in the frame, not just an outline (${(glassMost * 100).toFixed(1)}% of the frame mid-tone at its fullest, ${(cube.glassFrac * 100).toFixed(1)}% mid-turn)`,
    );
    check(
      chromaMax > 100 && chromaMedian > 24,
      `chromatic aberration is visible at the edges (strongest fringe ${chromaMax.toFixed(0)}/255, median ${chromaMedian.toFixed(0)}, over ${(cube.fringeFrac * 100).toFixed(2)}% of the middle frame)`,
    );
    check(
      cube.sdL > 0.08,
      `the glass has depth rather than reading as a flat silhouette (sd ${cube.sdL.toFixed(3)})`,
    );

    /* Against the reference, measured by the same instrument. */
    const reference = existsSync(REFERENCE)
      ? await referenceStats(cdp, globalCdp, { cdp, sessionId })
      : null;
    if (reference) {
      const ref = reference.stats;
      log(
        `  the reference (${reference.size.w}x${reference.size.h}, centre square): field p10 ${ref.p10L.toFixed(3)}, ` +
          `mean L ${ref.meanL.toFixed(3)}, max L ${ref.maxL.toFixed(2)}, max chroma ${ref.maxChroma.toFixed(0)}, ` +
          `dark ${(ref.darkFrac * 100).toFixed(1)}%`,
      );
      check(
        Math.abs(cube.p10L - ref.p10L) < 0.04,
        `the ground matches the reference's (p10 ${cube.p10L.toFixed(3)} vs ${ref.p10L.toFixed(3)})`,
      );
      check(
        cube.maxL > ref.maxL - 0.08,
        `its edges are as bright as the reference's (max L ${cube.maxL.toFixed(2)} vs ${ref.maxL.toFixed(2)})`,
      );
      check(
        chromaMax > ref.maxChroma * 0.8,
        `its strongest fringe is the reference's size (${chromaMax.toFixed(0)} vs ${ref.maxChroma.toFixed(0)}, at its faintest ${chromas[0].toFixed(0)})`,
      );
    } else {
      log("  (no design-reference/hero-inspo.png to compare against)");
    }

    /*
      Light on dark, on the page. The hero re-points the site's colour tokens
      for its own subtree (the `on-dark` utility), and this is the price of that
      trick: every pair that used to be dark-on-white has to be checked against
      the black it now sits on.
    */
    log("\ncontrast on the dark ground:");
    const contrast = await evaluate(
      cdp,
      sessionId,
      `(() => {
        const channel = (value) => {
          const v = value / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        const luminance = ([r, g, b]) =>
          0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        const ground = luminance([5, 7, 11]);
        const hero = document.querySelector("[data-hero]");
        const rows = [];
        for (const el of hero.querySelectorAll("p, span, a, h1, h2, h3")) {
          if (!el.textContent.trim() || el.children.length > 0) continue;
          const style = getComputedStyle(el);
          /* Parsed by slicing rather than by regex: a regex written inside a
             template literal is a fine way to lose an afternoon to escaping,
             and the computed colour is always "rgb(r, g, b)" or "rgba(...)". */
          const raw = style.color;
          const parts = raw
            .slice(raw.indexOf("(") + 1, raw.indexOf(")"))
            .split(",")
            .map((value) => Number(value.trim()));
          if (parts.length < 3 || parts.some((value) => Number.isNaN(value))) continue;
          const ink = luminance(parts.slice(0, 3));
          rows.push({
            text: el.textContent.trim().slice(0, 26),
            colour: style.color,
            size: parseFloat(style.fontSize),
            weight: style.fontWeight,
            ratio: (Math.max(ink, ground) + 0.05) / (Math.min(ink, ground) + 0.05),
          });
        }
        return rows;
      })()`,
    );
    const worstContrast = contrast.reduce((worst, row) =>
      row.ratio < worst.ratio ? row : worst,
    );
    check(
      contrast.length >= 3 && worstContrast.ratio >= 4.5,
      `every word in the hero clears AA on its new ground (worst ${worstContrast.ratio.toFixed(2)}:1 for "${worstContrast.text}" in ${worstContrast.colour}, ${contrast.length} text elements)`,
    );

    /*
      The header mark, which this pass was told not to touch. It is not touched:
      it draws itself from the same tokens every diagram uses, and the hero's
      `on-dark` utility re-points those tokens for this subtree, so the same
      component comes out light on black without a line of it changing.
    */
    const mark = await evaluate(
      cdp,
      sessionId,
      `(() => {
        const hero = document.querySelector("[data-hero]");
        const svg = hero.querySelector("[data-glass-cube] svg");
        if (!svg) return null;
        const outline = svg.querySelector("polygon[stroke]") || svg.querySelector("polygon");
        /* The faces are filled with gradients, so the fill is a url(); what
           matters is the tokens those gradients are painted from. */
        const style = getComputedStyle(hero);
        return {
          stroke: getComputedStyle(outline).stroke,
          faceStops: [...svg.querySelectorAll("linearGradient stop")]
            .map((stop) => stop.getAttribute("stop-color"))
            .filter((value, index, all) => all.indexOf(value) === index),
          tokens: {
            ink: style.getPropertyValue("--color-ink").trim(),
            paper: style.getPropertyValue("--color-paper").trim(),
            tint: style.getPropertyValue("--color-accent-tint").trim(),
          },
        };
      })()`,
    );
    const lightEnough = (colour) => {
      const parts = String(colour)
        .slice(String(colour).indexOf("(") + 1, String(colour).indexOf(")"))
        .split(",")
        .map((value) => Number(value.trim()));
      if (parts.length < 3 || parts.some((value) => Number.isNaN(value))) {
        const hex = String(colour).trim().replace("#", "");
        if (hex.length < 6) return 0;
        return Math.max(
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        );
      }
      return Math.max(...parts.slice(0, 3));
    };
    check(
      mark !== null &&
        lightEnough(mark.stroke) > 180 &&
        lightEnough(mark.tokens.paper) > 150 &&
        lightEnough(mark.tokens.tint) > 120,
      `the header mark came out light with it (stroke ${mark?.stroke}, glass painted from ` +
        `${mark?.faceStops.join(", ")} = ${mark?.tokens.paper} / ${mark?.tokens.tint})`,
    );

    /* It turns, on its own. */
    log("\nrotation:");
    check(
      moved > 0.6 && movedShare > 0.01,
      `it turns with no pointer involved (mean pixel change ${moved.toFixed(2)}/255 between captures, ` +
        `${(movedShare * 100).toFixed(1)}% of pixels moved)`,
    );

    /* The exit it already had, untouched by this pass. */
    log("\nthe drawer exit:");
    const drawerAt = async (fraction) => {
      await evaluate(
        cdp,
        sessionId,
        `(() => {
          const hero = document.querySelector("[data-hero]");
          window.scrollTo({ top: Math.round(hero.getBoundingClientRect().height * ${fraction}), behavior: "instant" });
          return true;
        })()`,
      );
      await sleep(450);
      return evaluate(
        cdp,
        sessionId,
        `(() => {
          const el = document.querySelector("[data-hero-drawer]");
          const style = getComputedStyle(el);
          return { opacity: Number(style.opacity), transform: style.transform };
        })()`,
      );
    };
    const drawerTop = await drawerAt(0);
    const drawerMid = await drawerAt(0.55);
    check(drawerTop.opacity > 0.99, `at rest it is opaque (opacity ${drawerTop.opacity})`);
    check(
      translateY(drawerMid.transform) < -40,
      `scrolling carries the hero up like a drawer (translateY ${translateY(drawerMid.transform).toFixed(0)}px at 55%)`,
    );
    check(drawerMid.opacity < 0.75, `and it fades as it goes (opacity ${drawerMid.opacity.toFixed(2)})`);

    /* And the cube does not turn when it should not. */
    log("\nprefers-reduced-motion:");
    await cdp.send(
      "Emulation.setEmulatedMedia",
      { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
      sessionId,
    );
    if (!(await open(cdp, sessionId, `${base}/`, CUBE_READY))) {
      throw new Error("the cube did not appear under reduced motion");
    }
    await sleep(2600);
    const frozenFacts = await evaluate(cdp, sessionId, CUBE_FACTS);
    const stillA = await capture(cdp, sessionId, frozenFacts.clip);
    await sleep(1800);
    const stillB = await capture(cdp, sessionId, frozenFacts.clip);
    const frozen = await evaluate(cdp, sessionId, analyse([stillA, stillB], 1), true);
    check(
      frozenFacts.state === "live" && frozenFacts.canvasCount === 1,
      `the cube is still rendered, not removed (state "${frozenFacts.state}")`,
    );
    check(
      frozen.stats[0].maxL > 0.85 && frozen.stats[0].sdL > 0.05,
      `and still lit: the frame under reduce has a cube in it (max L ${frozen.stats[0].maxL.toFixed(2)}, ` +
        `contrast sd ${frozen.stats[0].sdL.toFixed(3)}, glass ${(frozen.stats[0].glassFrac * 100).toFixed(1)}%)`,
    );
    check(
      frozen.diffs[0].meanAbs < 0.15,
      `the rotation is frozen rather than stopped (mean change ${frozen.diffs[0].meanAbs.toFixed(3)}/255 over 1.8s)`,
    );

    /* Under reduced motion the exit becomes a crossfade: same departure, no
       travel. */
    const drawerStill = await drawerAt(0.55);
    check(
      Math.abs(translateY(drawerStill.transform)) < 1 && drawerStill.opacity < 0.75,
      `the drawer becomes a crossfade, with no travel at all (translateY ${translateY(drawerStill.transform).toFixed(2)}px, ` +
        `opacity ${drawerStill.opacity.toFixed(2)})`,
    );
    await drawerAt(0);
    await cdp.send("Emulation.setEmulatedMedia", { features: [] }, sessionId);

    /* ---------- the fallback ---------- */
    log("\nWebGL unavailable:");
    await cdp.send("Page.enable", {}, sessionId);
    const killWebgl = await cdp.send(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source: `
          for (const name of ["webgl", "webgl2", "experimental-webgl", "webgpu"]) {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
              if (String(type).toLowerCase().includes(name)) return null;
              return original.call(this, type, ...rest);
            };
          }
        `,
      },
      sessionId,
    );
    requests.length = 0;
    if (!(await open(cdp, sessionId, `${base}/`))) {
      throw new Error("the home page never rendered without WebGL");
    }
    await sleep(1500);
    const without = await evaluate(cdp, sessionId, CUBE_FACTS);
    check(without.state === "still", `the hero reports the still (state "${without.state}")`);
    check(without.canvasCount === 0, `no canvas was mounted at all (${without.canvasCount})`);
    check(
      without.stillLoaded && without.stillVisible,
      `the still is standing in its place (${without.stillSrc}, loaded ${without.stillLoaded})`,
    );
    const rendererRequests = requests.filter((url) => /three|drei|hero-cube-canvas/i.test(url));
    check(
      rendererRequests.length === 0,
      `the scene was never even downloaded (${rendererRequests.length} requests for it: ${rendererRequests.slice(0, 3).join(" ") || "none"})`,
    );
    check(
      !!without.heroText,
      `the hero's text is intact ("${without.heroText?.text}...")`,
    );
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: killWebgl.identifier }, sessionId);

    if (MODE === "check" && !process.argv.includes("--no-perf")) {
      log("\nmobile frame budget (explained above; software rendering):");
      for (const step of ["the cube", "no cube"]) {
        await setViewport({ width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
        if (!(await open(cdp, sessionId, `${base}/`, step === "the cube" ? CUBE_READY : "async () => true"))) {
          throw new Error("the phone viewport never settled");
        }
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }, sessionId);
        if (step === "no cube") {
          await evaluate(
            cdp,
            sessionId,
            `(() => {
              const canvas = document.querySelector("[data-hero-cube] canvas");
              if (canvas) canvas.remove();
              return true;
            })()`,
          );
          await sleep(800);
        } else {
          await sleep(1200);
        }
        const times = await evaluate(cdp, sessionId, FRAME_TIMES, true);
        log(
          `  ${step}: frame interval median ${times.interval.median.toFixed(1)}ms / p90 ${times.interval.p90.toFixed(1)}ms, ` +
            `main-thread gap median ${times.gap.median.toFixed(2)}ms / p90 ${times.gap.p90.toFixed(2)}ms / worst ${times.gap.worst.toFixed(2)}ms`,
        );
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }, sessionId);
      }
      await setViewport(desktop);
      log("  (the per-frame share of the transmission buffer is measured with --perf)");
    }

    if (MODE === "perf") {
      log("\nmobile frame budget, 390x844 at deviceScaleFactor 3, CPU throttled 4x:");
      await setViewport({ width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
      if (!(await open(cdp, sessionId, `${base}/`, CUBE_READY))) {
        throw new Error("the phone viewport never settled");
      }
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }, sessionId);
      await sleep(1200);
      const times = await evaluate(cdp, sessionId, FRAME_TIMES, true);
      const factsPhone = await evaluate(cdp, sessionId, CUBE_FACTS);
      log(
        `  frame interval median ${times.interval.median.toFixed(1)}ms / p90 ${times.interval.p90.toFixed(1)}ms`,
      );
      log(
        `  main-thread gap median ${times.gap.median.toFixed(2)}ms / p90 ${times.gap.p90.toFixed(2)}ms / worst ${times.gap.worst.toFixed(2)}ms ` +
          `(buffer ${factsPhone.bufferW}x${factsPhone.bufferH} for ${factsPhone.cssW}px of layout)`,
      );
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }, sessionId);
      await setViewport(desktop);
    }

    log(`\n${failures.length === 0 ? "Clean." : `${failures.length} problem(s).`}`);
    if (failures.length > 0) process.exitCode = 1;
    socket.close();
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  log(`hero-cube failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
