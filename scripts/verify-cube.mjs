#!/usr/bin/env node
/*
  Temporary verification for the illustrated glass cube (deleted once the pass
  is done). Drives the Chrome on the machine over the DevTools protocol, the
  same way scripts/check-diagrams.mjs does, and asserts the things a source
  read cannot show:

    - the header mark is not clipped: no ancestor clips, and the drawing's box
      sits inside the row it is placed in
    - the drawing is a hairline construction (1px, non-scaling) with three
      gradient-filled faces
    - under no-preference the hero breathes and the highlight sweeps
    - under no-preference the header mark is dragged by the pointer and springs
      back to rest when the pointer leaves
    - under reduced motion both instances hold a static pose

  Usage: node scripts/verify-cube.mjs
*/

import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
const SERVER_PORT = 3453;
const DEBUG_PORT = 9335;

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
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
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

async function evaluate(cdp, sessionId, expression, awaitPromise = false) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluation failed");
  return result.result.value;
}

/**
 * Navigate and wait for the cube (and the fonts) to be on screen. The URL is
 * made unique and a marker is planted in the old document first, so a poll tick
 * can never be answered by the page that is on its way out — which is exactly
 * how an earlier version of this check read a no-preference render while
 * claiming to be in reduced motion.
 */
async function open(cdp, sessionId, url) {
  await evaluate(cdp, sessionId, 'window.__vuProbe = "old"; true');
  await cdp("Page.navigate", { url: `${url}${url.includes("?") ? "&" : "?"}vu=${Date.now()}` }, sessionId);
  return evaluate(
    cdp,
    sessionId,
    `(async () => {
      const start = Date.now();
      while (Date.now() - start < 50000) {
        if (typeof window.__vuProbe !== "undefined") {
          await new Promise((r) => setTimeout(r, 60));
          continue;
        }
        if (document.readyState === "complete" && document.fonts.status === "loaded") {
          const svg = document.querySelector("[data-glass-cube] svg");
          if (svg && svg.getBoundingClientRect().width > 0) {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await new Promise((r) => setTimeout(r, 350));
            return true;
          }
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    })()`,
    true,
  );
}

/* Runs in the page: geometry, structure and computed-style facts about a cube. */
const CUBE_FACTS = (behavior) => `(() => {
  const host = document.querySelector('[data-glass-cube="${behavior}"]');
  if (!host) return { error: "no ${behavior} cube" };
  const svg = host.querySelector("svg");
  const wrapper = svg.parentElement;
  const rect = svg.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const header = host.closest("header");
  const headerRect = header ? header.getBoundingClientRect() : null;

  /*
    A clipping ancestor only counts if the drawing actually leaves it. The
    hero's section is overflow:hidden on purpose — the drawer needs an edge to
    close against — so the question is whether the cube's rendered box (padding
    included, ancestors' transforms applied) still fits inside it.
  */
  const clippers = [];
  for (let el = host; el && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    const clipsX = [style.overflow, style.overflowX].some((v) => v !== "visible");
    const clipsY = [style.overflow, style.overflowY].some((v) => v !== "visible");
    if (!clipsX && !clipsY) continue;
    const r = el.getBoundingClientRect();
    const out =
      (clipsX && (hostRect.x < r.x - 1 || hostRect.x + hostRect.w > r.x + r.w + 1)) ||
      (clipsY && (hostRect.y < r.y - 1 || hostRect.y + hostRect.h > r.y + r.h + 1));
    if (out) {
      clippers.push(
        el.tagName.toLowerCase() + " clips the cube: box " +
          hostRect.x.toFixed(0) + "," + hostRect.y.toFixed(0) + " " + hostRect.w.toFixed(0) + "x" + hostRect.h.toFixed(0) +
          " vs " + r.x.toFixed(0) + "," + r.y.toFixed(0) + " " + r.width.toFixed(0) + "x" + r.height.toFixed(0),
      );
    }
  }

  /* The drawn faces only: the clip path's polygons are not faces. */
  const faces = [...svg.querySelectorAll("g > polygon")];
  const fills = faces.map((p) => p.getAttribute("fill"));
  const silhouette = svg.querySelector(":scope > polygon");
  const sheen = svg.querySelector("[data-glass-sheen]");
  const stops = [...svg.querySelectorAll("linearGradient stop")].map((s) => s.getAttribute("stop-opacity"));

  return {
    rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    hostRect: { x: hostRect.x, y: hostRect.y, w: hostRect.width, h: hostRect.height },
    headerRect: headerRect ? { x: headerRect.x, y: headerRect.y, w: headerRect.width, h: headerRect.height } : null,
    clippers,
    faceCount: faces.length,
    gradientFaces: fills.filter((f) => (f || "").includes("url(#")).length,
    silhouetteStroke: silhouette.getAttribute("stroke-width"),
    silhouetteVectorEffect: silhouette.getAttribute("vector-effect"),
    sheenState: sheen ? sheen.getAttribute("data-glass-sheen") : null,
    sheenTransform: sheen ? getComputedStyle(sheen).transform : null,
    wrapperTransform: getComputedStyle(wrapper).transform,
    wrapperOpacity: getComputedStyle(wrapper).opacity,
    stopOpacities: stops,
    cubeCount: document.querySelectorAll("[data-glass-cube]").length,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    reducedValueless: matchMedia("(prefers-reduced-motion)").matches,
  };
})()`;

/* Hero drawer: the scroll exit applied to the whole hero composition. */
const DRAWER = `(() => {
  const el = document.querySelector("[data-hero-drawer]");
  const hero = document.querySelector("[data-hero]");
  if (!el || !hero) return { error: "no hero" };
  const style = getComputedStyle(el);
  return {
    transform: style.transform,
    opacity: Number(style.opacity),
    heroHeight: hero.getBoundingClientRect().height,
    viewport: window.innerHeight,
    scrollY: window.scrollY,
    inlineStyle: el.getAttribute("style"),
    lines: [...hero.querySelectorAll("p")].map((p) => p.textContent.trim()).filter(Boolean),
  };
})()`;

const scrollToHeroProgress = (fraction) => `(() => {
  const hero = document.querySelector("[data-hero]");
  const target = Math.round(hero.getBoundingClientRect().height * ${fraction});
  window.scrollTo({ top: target, behavior: "instant" });
  return target;
})()`;

const wrapperTransform = (behavior) =>
  `(() => {
    const host = document.querySelector('[data-glass-cube="${behavior}"]');
    const wrapper = host.querySelector("svg").parentElement;
    return getComputedStyle(wrapper).transform;
  })()`;

const sheenTransform = (behavior) =>
  `(() => {
    const host = document.querySelector('[data-glass-cube="${behavior}"]');
    const sheen = host.querySelector("[data-glass-sheen]");
    return getComputedStyle(sheen).transform;
  })()`;

/** translateX / translateY out of a computed matrix, or 0 for "none". */
function matrixPart(transform, index2d, index3d) {
  if (!transform || transform === "none") return 0;
  const m = transform.match(/matrix(3d)?\(([^)]+)\)/);
  if (!m) return 0;
  const parts = m[2].split(",").map((n) => Number(n.trim()));
  return m[1] ? parts[index3d] : parts[index2d];
}
const tx = (transform) => matrixPart(transform, 4, 12);
const ty = (transform) => matrixPart(transform, 5, 13);
/**
 * The x scale out of a matrix — how far a spring-in has travelled. "none" is
 * an identity transform, so it reads as exactly 1: a row caught mid-spring has
 * to be caught as a matrix, not as an untransformed element.
 */
const scaleOf = (transform) =>
  !transform || transform === "none" ? 1 : matrixPart(transform, 0, 0);

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error("no Chrome found; set CHROME_PATH");

  const userDataDir = path.join(tmpdir(), `glassbox-cube-check-${Date.now()}`);
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
    const { targetId } = await cdp("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
    await cdp("Page.enable", {}, sessionId);
    await cdp("Runtime.enable", {}, sessionId);
    await cdp(
      "Emulation.setDeviceMetricsOverride",
      { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );

    /* ---------- motion allowed ---------- */
    log("\nno-preference:");
    await cdp("Emulation.setEmulatedMedia", { features: [] }, sessionId);

    if (!(await open(cdp, sessionId, `${base}/concepts`))) throw new Error("concepts never rendered a cube");
    const header = await evaluate(cdp, sessionId, CUBE_FACTS("track"));

    check(header.cubeCount === 1, `one cube on a content page (found ${header.cubeCount})`);
    check(header.clippers.length === 0, `nothing clips the mark (${header.clippers.join(" | ") || "no clipping ancestor reaches it"})`);
    check(
      header.headerRect !== null &&
        header.rect.y >= header.headerRect.y - 0.5 &&
        header.rect.y + header.rect.h <= header.headerRect.y + header.headerRect.h + 0.5,
      `the mark sits inside the masthead row (mark ${header.rect.y.toFixed(1)}..${(header.rect.y + header.rect.h).toFixed(1)} vs row ${header.headerRect?.y.toFixed(1)}..${header.headerRect ? (header.headerRect.y + header.headerRect.h).toFixed(1) : "?"})`,
    );
    check(header.hostRect.w > header.rect.w, `the mark's box has room around the drawing (${header.rect.w.toFixed(1)} in ${header.hostRect.w.toFixed(1)})`);
    check(header.faceCount === 3 && header.gradientFaces === 3, `three gradient-filled faces (${header.gradientFaces}/${header.faceCount})`);
    check(header.silhouetteStroke === "1", `hairline stroke width 1 (${header.silhouetteStroke})`);
    check(header.silhouetteVectorEffect === "non-scaling-stroke", `hairline kept at one device pixel (${header.silhouetteVectorEffect})`);
    check(
      header.stopOpacities.length > 0 && header.stopOpacities.some((o) => Number(o) > 0),
      `the glass fills are visible (${header.stopOpacities.join(",")})`,
    );

    /* The sweep travels. */
    const sheenA = await evaluate(cdp, sessionId, sheenTransform("track"));
    await sleep(900);
    const sheenB = await evaluate(cdp, sessionId, sheenTransform("track"));
    check(sheenA !== sheenB, `the highlight sweeps (${sheenA} -> ${sheenB})`);

    /* The pointer drags it, and it springs back. */
    const centre = {
      x: header.rect.x + header.rect.w / 2,
      y: header.rect.y + header.rect.h / 2,
    };
    await cdp(
      "Input.dispatchMouseEvent",
      { type: "mouseMoved", x: centre.x + 60, y: centre.y + 18, buttons: 0 },
      sessionId,
    );
    await sleep(420);
    const pulled = tx(await evaluate(cdp, sessionId, wrapperTransform("track")));
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: centre.x + 200, y: centre.y + 200, buttons: 0 }, sessionId);
    await sleep(1400);
    const settled = tx(await evaluate(cdp, sessionId, wrapperTransform("track")));
    check(Math.abs(pulled) > 0.4, `the mark is dragged by the pointer (translateX ${pulled.toFixed(2)}px)`);
    check(Math.abs(settled) < 0.35 && Math.abs(settled) < Math.abs(pulled), `it springs back to rest (translateX ${settled.toFixed(2)}px)`);

    /* The hero breathes. */
    if (!(await open(cdp, sessionId, `${base}/`))) throw new Error("home page never rendered a cube");
    const hero = await evaluate(cdp, sessionId, CUBE_FACTS("float"));
    check(hero.cubeCount === 2, `header and hero cubes both render (found ${hero.cubeCount})`);
    check(hero.clippers.length === 0, `nothing clips the hero cube (${hero.clippers.join(" | ") || "no clipping ancestor reaches it"})`);
    check(
      hero.sheenState === "sweep",
      `the hero highlight is set to sweep (${hero.sheenState})`,
    );
    const floatA = await evaluate(cdp, sessionId, wrapperTransform("float"));
    await sleep(1400);
    const floatB = await evaluate(cdp, sessionId, wrapperTransform("float"));
    check(floatA !== floatB, `the hero breathes (${floatA} -> ${floatB})`);

    /* ---------- the hero drawer ---------- */
    log("\nhero exit:");
    const heroTop = await evaluate(cdp, sessionId, DRAWER);
    check(
      Math.abs(heroTop.heroHeight - heroTop.viewport) <= 2,
      `the hero is one viewport tall (${heroTop.heroHeight} vs ${heroTop.viewport})`,
    );
    check(heroTop.lines.length >= 2, `the hero carries its supporting lines (${heroTop.lines.length}: "${heroTop.lines[1]?.slice(0, 48)}...")`);
    check(Math.abs(ty(heroTop.transform)) < 1 && heroTop.opacity > 0.99, `at rest it is unmoved and opaque (${heroTop.transform}, opacity ${heroTop.opacity})`);

    await evaluate(cdp, sessionId, scrollToHeroProgress(0.55));
    await sleep(500);
    const heroMid = await evaluate(cdp, sessionId, DRAWER);
    check(
      ty(heroMid.transform) < -40,
      `scrolling carries it up like a drawer (translateY ${ty(heroMid.transform).toFixed(0)}px at 55%)`,
    );
    check(heroMid.opacity < 0.75, `and it fades as it goes (opacity ${heroMid.opacity.toFixed(2)})`);

    /* The fade has to be monotonic: an exit that comes back is not an exit. */
    const sweep = [];
    for (const fraction of [0.3, 0.6, 0.8, 0.9, 1]) {
      await evaluate(cdp, sessionId, scrollToHeroProgress(fraction));
      await sleep(350);
      const sample = await evaluate(cdp, sessionId, DRAWER);
      sweep.push(sample.opacity);
    }
    check(
      sweep.every((value, index) => index === 0 || value <= sweep[index - 1] + 0.001),
      `the fade only ever goes one way (${sweep.map((v) => v.toFixed(2)).join(" -> ")})`,
    );

    await evaluate(cdp, sessionId, scrollToHeroProgress(1));
    await sleep(500);
    const heroEnd = await evaluate(cdp, sessionId, DRAWER);
    check(
      heroEnd.opacity < 0.08,
      `gone by the time the section has passed (opacity ${heroEnd.opacity.toFixed(3)} at scrollY ${heroEnd.scrollY}, translateY ${ty(heroEnd.transform).toFixed(0)}px, style "${heroEnd.inlineStyle}")`,
    );

    /* A short laptop window is the one that would crop a cube this size. */
    log("\nshort window (1280x700):");
    await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 700, deviceScaleFactor: 1, mobile: false }, sessionId);
    if (!(await open(cdp, sessionId, `${base}/`))) throw new Error("home page never rendered a cube");
    const shortHero = await evaluate(cdp, sessionId, CUBE_FACTS("float"));
    check(shortHero.clippers.length === 0, `the cube still fits (${shortHero.clippers.join(" | ") || "inside the hero"})`);

    /* ---------- the guidance callouts ---------- */
    log("\nguidance callouts:");
    const callouts = `(() => {
      const items = [...document.querySelectorAll("[data-prompt-fragment]")];
      return items.map((el) => {
        const p = el.querySelector("p");
        const s = p ? getComputedStyle(p) : null;
        const box = getComputedStyle(el);
        return {
          label: el.querySelector("span")?.textContent?.trim(),
          text: p ? p.textContent.trim().slice(0, 40) : null,
          font: s ? s.fontFamily : null,
          size: s ? s.fontSize : null,
          colour: s ? s.color : null,
          leftBorder: box.borderLeftWidth,
          background: box.backgroundColor,
        };
      });
    })()`;

    if (!(await open(cdp, sessionId, `${base}/`))) throw new Error("home page never rendered");
    const homeCallouts = await evaluate(cdp, sessionId, callouts);
    check(homeCallouts.length >= 1, `the homepage carries its guidance callout (${homeCallouts.length})`);
    check(
      homeCallouts.every((c) => c.font && !/Mono/i.test(c.font)),
      `callouts are set in the site's prose, not a code face (${homeCallouts.map((c) => c.font).join(" | ")})`,
    );
    check(
      homeCallouts.every((c) => c.leftBorder === "0px" && (c.background === "rgba(0, 0, 0, 0)" || c.background === "transparent")),
      `no stripe and no recessed well (${homeCallouts.map((c) => `${c.leftBorder}/${c.background}`).join(" | ")})`,
    );
    check(
      homeCallouts.every((c) => c.text && c.text.length > 20),
      `the wording is kept ("${homeCallouts[0]?.text}..." labelled "${homeCallouts[0]?.label}")`,
    );

    /* The register rows open on click, so the callouts inside them are only in
       the document once every row has been opened. */
    if (!(await open(cdp, sessionId, `${base}/getting-started`))) throw new Error("steps page never rendered");
    const opened = await evaluate(
      cdp,
      sessionId,
      `document.querySelectorAll('button[aria-controls$="-panel"]').length`,
    );
    check(opened >= 5, `layer 00 has its steps to open (${opened})`);
    /* One at a time: the register is an accordion, so only the open row's
       contents are in the document. */
    const stepCallouts = [];
    for (let index = 0; index < opened; index += 1) {
      await evaluate(
        cdp,
        sessionId,
        `(() => {
          const buttons = [...document.querySelectorAll('button[aria-controls$="-panel"]')];
          buttons[${index}].click();
          return true;
        })()`,
      );
      await sleep(400);
      stepCallouts.push(...(await evaluate(cdp, sessionId, callouts)));
    }
    check(
      stepCallouts.length >= 5 && stepCallouts.every((c) => c.font && !/Mono/i.test(c.font) && c.leftBorder === "0px"),
      `every reused callout on layer 00 is restyled (${stepCallouts.length} found, all prose)`,
    );

    if (!(await open(cdp, sessionId, `${base}/build-log`))) throw new Error("build log never rendered");
    const logPrompt = await evaluate(
      cdp,
      sessionId,
      `(() => {
        const span = [...document.querySelectorAll("span.field-label")].find(
          (el) => el.textContent.trim() === "the prompt, as sent",
        );
        const block = span ? span.parentElement : null;
        const p = block ? block.querySelector("p") : null;
        if (!p) return null;
        const s = getComputedStyle(p);
        const b = getComputedStyle(block);
        return {
          font: s.fontFamily,
          size: s.fontSize,
          leftBorder: b.borderLeftWidth,
          background: b.backgroundColor,
          text: p.textContent.trim().slice(0, 32),
        };
      })()`,
    );
    check(
      logPrompt !== null && !/Mono/i.test(logPrompt.font) && logPrompt.leftBorder === "0px",
      `the transcribed prompt is prose too (${logPrompt?.font}, left border ${logPrompt?.leftBorder}, "${logPrompt?.text}...")`,
    );

    /* ---------- the rate-limiting demo ---------- */
    log("\nrate-limiting demo:");
    if (!(await open(cdp, sessionId, `${base}/concepts#rate-limiting`))) throw new Error("concepts never rendered");
    const openedDemo = await evaluate(
      cdp,
      sessionId,
      `(() => {
        const already = !!document.querySelector('[aria-label="rate limiter simulation"]');
        if (!already) {
          const btn = [...document.querySelectorAll('button[aria-controls$="-panel"]')].find((b) =>
            (b.getAttribute("aria-controls") || "").includes("rate-limiting"),
          );
          if (btn) btn.click();
        }
        return already;
      })()`,
    );
    await sleep(900);
    const demoReady = await evaluate(
      cdp,
      sessionId,
      `!!document.querySelector('[aria-label="rate limiter simulation"]')`,
    );
    check(demoReady, `the demo opened in place (hash deep link ${openedDemo ? "auto-opened" : "clicked"})`);

    /* Sample the demo while a flood arrives, so the animation is caught in act. */
    const SAMPLE_DEMO = `(() => {
      const demo = document.querySelector('[aria-label="rate limiter simulation"]');
      if (!demo) return { error: "no demo" };
      const rows = [...demo.querySelectorAll("ol > li")];
      const meters = [...demo.querySelectorAll("[data-meter]")];
      return {
        rows: rows.map((li) => {
          const body = li.querySelector("[data-request-body]");
          return {
            status: li.getAttribute("data-entry-status"),
            /* The spring-in is on the row itself; the shake is on its body. */
            rowTransform: getComputedStyle(li).transform,
            bodyTransform: body ? getComputedStyle(body).transform : "none",
            refusedTint: (li.className || "").includes("bg-bad-tint"),
            flash: !!li.querySelector("span.bg-bad-tint"),
          };
        }),
        meters: meters.map((m) => ({
          id: m.getAttribute("data-meter"),
          rejected: m.getAttribute("data-rejected"),
          flash: !!m.querySelector("span.bg-bad-tint"),
          readout: m.querySelector("[class*=readout]")?.textContent?.trim(),
          /* "none" is an identity transform: a fill at its full width needs no
             matrix. Anything the spring is moving through does have one. */
          /*
            The bar's x scale. "none" is an identity transform — a fill sitting
            at its full width needs no matrix — so it reads as 1. Parsed with
            string slicing rather than a regex, because a regex written inside a
            template literal is a good way to spend an afternoon.
          */
          fill: (() => {
            const f = m.querySelector("[data-meter-fill]");
            if (!f) return null;
            const t = getComputedStyle(f).transform;
            if (t === "none" || !t.includes("(")) return 1;
            return Number(t.slice(t.indexOf("(") + 1, t.indexOf(")")).split(",")[0]);
          })(),
        })),
      };
    })()`;

    await evaluate(
      cdp,
      sessionId,
      `(() => {
        const demo = document.querySelector('[aria-label="rate limiter simulation"]');
        const flood = [...demo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Flood 8");
        flood.click();
        return true;
      })()`,
    );

    const frames = [];
    for (let index = 0; index < 60; index += 1) {
      frames.push(await evaluate(cdp, sessionId, SAMPLE_DEMO));
      await sleep(45);
    }
    const last = frames[frames.length - 1];
    const scales = frames.flatMap((f) => f.rows.map((r) => scaleOf(r.rowTransform)));
    const shakes = frames.flatMap((f) => f.rows.map((r) => Math.abs(tx(r.bodyTransform))));
    const refusedRows = last.rows.filter((r) => r.status === "429");
    const rejectedFrames = frames.filter((f) => f.meters.some((m) => m.rejected === "true"));

    check(last.rows.length >= 5, `the flood arrived as separate requests (${last.rows.length} rows in the log)`);
    check(refusedRows.length >= 3, `the over-limit ones came back 429 (${refusedRows.length} refused)`);
    check(
      scales.some((s) => s < 0.99) && scales.some((s) => s > 1.0),
      `a request springs in rather than appearing (scales seen ${Math.min(...scales).toFixed(2)}..${Math.max(...scales).toFixed(2)})`,
    );
    check(
      shakes.some((x) => x > 1),
      `a refused request shakes (largest row offset ${Math.max(...shakes).toFixed(1)}px)`,
    );
    check(
      frames.some((f) => f.rows.some((r) => r.flash)),
      "a refused request flashes once behind its own row",
    );
    check(
      rejectedFrames.length >= 3,
      `the counter animates the refusal too (${rejectedFrames.length} frames with a rejected meter)`,
    );

    await sleep(600);
    const resting = await evaluate(cdp, sessionId, SAMPLE_DEMO);
    const flooded = resting.meters.find((m) => m.id === "anon");
    const untouched = resting.meters.find((m) => m.id === "user");
    check(
      flooded && flooded.fill !== null && Math.abs(flooded.fill - 1) < 0.02 && flooded.readout?.startsWith("5"),
      `the allowance fill tracked to the limit (${flooded?.fill?.toFixed(2)} of 1, readout "${flooded?.readout}")`,
    );
    check(
      untouched && untouched.fill === 0 && untouched.readout?.startsWith("0"),
      `the other keys did not move (${resting.meters.map((m) => `${m.id} fill ${m.fill}`).join(" | ")})`,
    );

    /* A partial fill is the only way to see the bar travel rather than jump. */
    const clickByText = (needle) => `(() => {
      const demo = document.querySelector('[aria-label="rate limiter simulation"]');
      const button = [...demo.querySelectorAll("button")].find((b) => b.textContent.includes(${JSON.stringify(needle)}));
      if (!button) return false;
      button.click();
      return true;
    })()`;
    check(await evaluate(cdp, sessionId, clickByText("user_4817")), "switched to the second key");
    check(await evaluate(cdp, sessionId, clickByText("Send 3")), "sent a burst on the second key");

    const travel = [];
    for (let index = 0; index < 22; index += 1) {
      await sleep(40);
      const sample = await evaluate(cdp, sessionId, SAMPLE_DEMO);
      const meter = sample.meters.find((m) => m.id === "user");
      travel.push(meter.fill);
    }
    await sleep(500);
    const afterBurst = await evaluate(cdp, sessionId, SAMPLE_DEMO);
    const partial = afterBurst.meters.find((m) => m.id === "user");

    check(
      travel.filter((v) => v !== null && v > 0.02 && v < 0.58).length >= 2,
      `the bar travels to its new reading (mid-spring values ${travel.filter((v) => v !== null && v > 0.02 && v < 0.58).length} of ${travel.length} samples)`,
    );
    check(
      partial && partial.fill !== null && Math.abs(partial.fill - 0.6) < 0.03 && partial.readout?.startsWith("3"),
      `and it lands on 3 of 5 (found ${afterBurst.meters.length} meters: ${afterBurst.meters.map((m) => `${m.id} fill ${m.fill}`).join(", ")})`,
    );
    check(
      partial?.rejected === "false",
      "the burst was allowed and its requests were not shaken",
    );

    log("\nnarrow phone (390x844):");
    await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
    if (!(await open(cdp, sessionId, `${base}/`))) throw new Error("home page never rendered a cube");
    const phoneHero = await evaluate(cdp, sessionId, CUBE_FACTS("float"));
    check(phoneHero.clippers.length === 0, `the cube fits a phone too (${phoneHero.clippers.join(" | ") || "inside the hero"})`);
    await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

    /* ---------- reduced motion ---------- */
    log("\nreduce:");
    await cdp(
      "Emulation.setEmulatedMedia",
      { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
      sessionId,
    );

    if (!(await open(cdp, sessionId, `${base}/`))) throw new Error("home page never rendered a cube");
    const reducedHero = await evaluate(cdp, sessionId, CUBE_FACTS("float"));
    check(reducedHero.reduced, `the emulated preference is visible to the page (explicit query ${reducedHero.reduced}, valueless query ${reducedHero.reducedValueless})`);
    check(reducedHero.sheenState === "rest", `the highlight rests (${reducedHero.sheenState})`);

    /* The exit becomes an opacity crossfade, with no translate at all. */
    await evaluate(cdp, sessionId, scrollToHeroProgress(0.55));
    await sleep(500);
    const reducedMid = await evaluate(cdp, sessionId, DRAWER);
    check(Math.abs(ty(reducedMid.transform)) < 1, `the hero does not slide under reduced motion (translateY ${ty(reducedMid.transform).toFixed(2)}px)`);
    check(reducedMid.opacity < 0.75, `it crossfades instead (opacity ${reducedMid.opacity.toFixed(2)})`);
    await evaluate(cdp, sessionId, scrollToHeroProgress(0));
    await sleep(300);
    const restA = await evaluate(cdp, sessionId, sheenTransform("float"));
    const floatRestA = await evaluate(cdp, sessionId, wrapperTransform("float"));
    await sleep(1400);
    const restB = await evaluate(cdp, sessionId, sheenTransform("float"));
    const floatRestB = await evaluate(cdp, sessionId, wrapperTransform("float"));
    check(restA === restB, `the highlight holds still (${restA})`);
    check(floatRestA === floatRestB, `the hero holds still (${floatRestA})`);

    /* The demo keeps every state and drops every animation. */
    if (!(await open(cdp, sessionId, `${base}/concepts#rate-limiting`))) throw new Error("concepts never rendered");
    await evaluate(
      cdp,
      sessionId,
      `(() => {
        const demo = document.querySelector('[aria-label="rate limiter simulation"]');
        if (!demo) {
          const btn = [...document.querySelectorAll('button[aria-controls$="-panel"]')].find((b) =>
            (b.getAttribute("aria-controls") || "").includes("rate-limiting"),
          );
          btn?.click();
        }
        return true;
      })()`,
    );
    await sleep(900);
    await evaluate(
      cdp,
      sessionId,
      `(() => {
        const demo = document.querySelector('[aria-label="rate limiter simulation"]');
        [...demo.querySelectorAll("button")].find((b) => b.textContent.trim() === "Flood 8").click();
        return true;
      })()`,
    );
    const stillFrames = [];
    for (let index = 0; index < 40; index += 1) {
      stillFrames.push(await evaluate(cdp, sessionId, SAMPLE_DEMO));
      await sleep(45);
    }
    await sleep(400);
    const stillDemo = await evaluate(cdp, sessionId, SAMPLE_DEMO);
    const stillScales = stillFrames.flatMap((f) => f.rows.map((r) => scaleOf(r.rowTransform)));
    const stillShakes = stillFrames.flatMap((f) => f.rows.map((r) => Math.abs(tx(r.bodyTransform))));
    check(
      stillDemo.rows.filter((r) => r.status === "429").length >= 3,
      `the refusal is still in the log under reduced motion (${stillDemo.rows.filter((r) => r.status === "429").length} rows)`,
    );
    check(
      stillFrames.every((f) => f.meters.every((m) => m.rejected === "false")),
      "nothing shakes or flashes under reduced motion",
    );
    check(
      stillScales.every((s) => s === 1) && stillShakes.every((x) => x === 0),
      `requests do not spring in and refusals do not shake (scales ${Math.min(...stillScales)}..${Math.max(...stillScales)}, offsets max ${Math.max(...stillShakes)})`,
    );
    check(
      stillDemo.rows.filter((r) => r.refusedTint).length >= 3,
      `the refusal is shown as a still tint instead (${stillDemo.rows.filter((r) => r.refusedTint).length} tinted rows)`,
    );
    check(
      stillDemo.meters.find((m) => m.id === "anon")?.readout?.startsWith("5"),
      `the counter still reads the truth ("${stillDemo.meters.find((m) => m.id === "anon")?.readout}")`,
    );

    if (!(await open(cdp, sessionId, `${base}/concepts`))) throw new Error("concepts never rendered a cube");
    const reducedHeader = await evaluate(cdp, sessionId, CUBE_FACTS("track"));
    check(reducedHeader.clippers.length === 0, "the mark is still unclipped under reduced motion");
    await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: 900, y: 500, buttons: 0 }, sessionId);
    await sleep(400);
    const still = await evaluate(cdp, sessionId, wrapperTransform("track"));
    check(still === "none" || Math.abs(tx(still)) < 0.01, `the mark does not follow the pointer (${still})`);

    log(`\n${failures.length === 0 ? "Clean." : `${failures.length} problem(s).`}`);
    if (failures.length > 0) process.exitCode = 1;
    socket.close();
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  log(`verify-cube failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
