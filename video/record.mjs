// Records the demo video in real Chrome against a running web app and MCP server.
// Usage: OUT=<dir> WEB=http://localhost:3100 MCP=http://127.0.0.1:8788 node video/record.mjs
// Writes <OUT>/frames/*.jpg with <OUT>/frames.txt (an ffmpeg concat list, timed from Chrome's
// screencast) and <OUT>/beats.json (each beat's start time in seconds).
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS } from "./cards.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT;
const WEB = process.env.WEB || "http://localhost:3100";
const MCP = process.env.MCP || "http://127.0.0.1:8788";
if (!OUT) throw new Error("Set OUT to the output directory.");

const narration = JSON.parse(readFileSync(join(here, "narration.json"), "utf8"));
const durations = JSON.parse(readFileSync(join(OUT, "durations.json"), "utf8").replace(/^﻿/, ""));
const SIZE = { width: 1440, height: 810 };

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: SIZE });
await context.addInitScript({ path: join(here, "overlay.js") });
const page = await context.newPage();
const t0 = Date.now();

// Chrome sends a frame only when the picture changes; each frame keeps its wall-clock time.
const frameDir = join(OUT, "frames");
mkdirSync(frameDir, { recursive: true });
const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const name = `${String(frames.length).padStart(5, "0")}.jpg`;
  writeFileSync(join(frameDir, name), Buffer.from(data, "base64"));
  frames.push({ name, at: metadata.timestamp - t0 / 1000 });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
const startCast = () => cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: SIZE.width, maxHeight: SIZE.height, everyNthFrame: 1 });
await startCast();
const beats = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const testId = (id) => page.getByTestId(id);
const card = (id) => page.frameLocator('[data-testid="widget-frame"]').getByTestId(id);

async function caption(text) {
  await page.evaluate((t) => { const c = document.getElementById("fb-caption"); if (c) c.textContent = t; }, text).catch(() => {});
}

/** Shows the narration as captions, one sentence at a time, paced by sentence length. */
function captions(text, seconds) {
  const parts = text.replace(/M C P/g, "MCP").replace(/H T T P/g, "HTTP").replace(/M I T/g, "MIT")
    .match(/[^.:]+[.:]?/g).map((s) => s.trim()).filter(Boolean);
  const total = parts.reduce((n, p) => n + p.length, 0);
  let cancelled = false;
  (async () => {
    for (const p of parts) {
      if (cancelled) return;
      await caption(p);
      await sleep((seconds * 1000 * p.length) / total);
    }
  })();
  return () => { cancelled = true; };
}

async function beat(id, act) {
  const start = (Date.now() - t0) / 1000;
  beats.push({ id, start });
  const text = narration.find((n) => n.id === id).text;
  const stop = captions(text, durations[id]);
  await act();
  const left = durations[id] * 1000 + 700 - (Date.now() - t0 - start * 1000);
  if (left > 0) await sleep(left);
  stop();
  await caption("");
}

async function moveTo(locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d))));
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  await sleep(150);
}

async function click(locator) {
  await moveTo(locator);
  await locator.click();
}

async function say(utterance, wait = true) {
  const replies = testId("turn-assistant");
  const before = await replies.count();
  const input = testId("utterance-input");
  await click(input);
  await input.fill("");
  await input.pressSequentially(utterance, { delay: 28 });
  await sleep(250);
  await click(testId("utterance-send"));
  if (wait) await replies.nth(before).waitFor({ timeout: 30_000 });
}

async function showCard(name, ms) {
  await page.evaluate((html) => {
    const f = document.createElement("iframe");
    f.id = "fb-card";
    f.srcdoc = html;
    f.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;background:#1e1b1a";
    document.body.appendChild(f);
  }, CARDS[name]);
  if (ms) await sleep(ms);
}

async function hideCard() {
  await page.evaluate(() => document.getElementById("fb-card")?.remove());
}

async function waitText(locator, text) {
  await locator.filter({ hasText: text }).first().waitFor({ timeout: 30_000 });
}

// Reset the demo data so every run records the same story.
const reset = await page.request.post(`${MCP}/admin/reset-demo`);
if (!reset.ok()) throw new Error(`reset-demo failed: ${reset.status()}`);

await page.goto(`${WEB}/sim`);
await testId("server-status").filter({ hasText: "Connected" }).waitFor({ timeout: 30_000 });
await showCard("title");

await beat("title", async () => {});
await hideCard();

await beat("open", async () => {
  await moveTo(testId("sim-banner"));
  await sleep(2500);
  await moveTo(testId("mode-badge"));
  await sleep(2000);
  await moveTo(page.getByText("MCP traffic").first());
});

await beat("lena", async () => {
  await say("Lena's last formula");
  await waitText(card("card-total"), "100 g");
});

await beat("scale", async () => {
  await say("Make it one and a half times");
  await waitText(card("card-total"), "150 g");
});

await beat("marta", async () => {
  await say("Colour Marta: 30 grams 6N and 20 grams 7.1, 20 volume, one to one and a half");
  await waitText(card("card-total"), "125 g");
});

await beat("session", async () => {
  await click(testId("new-session"));
  await testId("server-status").filter({ hasText: "Connected" }).waitFor({ timeout: 30_000 });
  await say("Marta's last formula");
  await waitText(card("card-total"), "125 g");
});

await beat("priya", async () => {
  await say("Priya's last formula", false);
  const dialog = testId("elicit-dialog");
  await dialog.waitFor({ timeout: 30_000 });
  await sleep(2200);
  await click(dialog.getByRole("button", { name: /Shah/ }));
  await waitText(card("card-client"), "Priya Shah");
});

await beat("rohan", async () => {
  await say("Rohan's last formula");
  await waitText(testId("spoken-reply"), "no formula for Rohan");
});

await beat("devices", async () => {
  await click(testId("device-mobile"));
  await sleep(3500);
  await click(testId("device-speaker"));
  await say("Lena's last formula");
  await waitText(testId("spoken-reply"), "40 grams 5N");
  await moveTo(testId("spoken-reply"));
});

await beat("claude", async () => {
  await click(testId("device-echo-show-8"));
  const odd = "Lena has thick hair today, go for twice the amount";
  await say(odd);
  await sleep(1500);
  await click(testId("chooser-select"));
  await testId("chooser-select").selectOption("claude");
  await say(odd);
  await waitText(card("card-total"), "200 g");
  await moveTo(testId("chooser-badge"));
});

/** Waits until the assistant has stopped adding replies for a moment (Claude's loop has finished). */
async function settle(quietMs = 2500, maxMs = 30_000) {
  const replies = testId("turn-assistant");
  const end = Date.now() + maxMs;
  let count = await replies.count();
  let quietSince = Date.now();
  while (Date.now() < end && Date.now() - quietSince < quietMs) {
    await sleep(300);
    const now = await replies.count();
    if (now !== count) {
      count = now;
      quietSince = Date.now();
    }
  }
}

await beat("orchestrate", async () => {
  await moveTo(testId("diary-status"));
  await sleep(1200);
  await say("Who's booked in today? Get their bowls ready");
  await page.locator('[data-testid="traffic-row"]', { hasText: "list_appointments" }).first().waitFor({ timeout: 30_000 });
  await settle();
  await moveTo(page.getByText("MCP traffic").first());
});

await showCard("prior");
await beat("prior", async () => {});
await hideCard();

await beat("plan", async () => {
  await testId("chooser-select").selectOption("rules");
  await click(testId("salon-select"));
  await testId("salon-select").selectOption({ label: "Booth 12 (capped)" });
  await testId("server-status").filter({ hasText: "Connected" }).waitFor({ timeout: 30_000 });
  await waitText(testId("usage-count"), "50 of 50");
  await say("Colour Ines: 30 grams 6N, 20 volume, one to one");
  await waitText(testId("spoken-reply"), "free plan holds 50 formulas");
  await moveTo(testId("usage-count"));
  const email = testId("waitlist-email");
  await click(email);
  await email.pressSequentially("owner@salon.example", { delay: 28 });
  await click(testId("waitlist-submit"));
  await testId("waitlist-success").waitFor({ timeout: 10_000 });
  await moveTo(testId("waitlist-count"));
});

await beat("open-source", async () => {
  await page.goto(`${WEB}/site/index.html`);
  await startCast().catch(() => {});
  await sleep(2600);
  for (let i = 0; i < 10; i += 1) {
    await page.mouse.wheel(0, 500);
    await sleep(700);
  }
});

await showCard("end");
await beat("end", async () => {});
await sleep(800);

const end = (Date.now() - t0) / 1000;
await cdp.send("Page.stopScreencast").catch(() => {});
await context.close();
await browser.close();

const list = frames.map((f, i) => {
  const next = i + 1 < frames.length ? frames[i + 1].at : end;
  return `file 'frames/${f.name}'\nduration ${Math.max(0.001, next - f.at).toFixed(3)}`;
});
list.unshift(`file 'frames/${frames[0].name}'\nduration ${Math.max(0.001, frames[0].at).toFixed(3)}`);
list.push(`file 'frames/${frames[frames.length - 1].name}'`);
writeFileSync(join(OUT, "frames.txt"), list.join("\n") + "\n");
console.log(`frames ${frames.length}, length ${end.toFixed(1)} s`);
writeFileSync(join(OUT, "beats.json"), JSON.stringify(beats, null, 2));
console.log(JSON.stringify(beats));
