import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "chrome",
  headless: true,
});
const errors = [],
  results = [];
async function page(options = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    ...options,
  });
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:4173");
  await p.waitForSelector("#hand .card");
  return p;
}
const enabled = async (p, id) => p.locator(id).isEnabled();
async function until(fn, ms = 15000) {
  const start = Date.now();
  while (!(await fn())) {
    if (Date.now() - start > ms) throw Error("Condition timed out");
    await new Promise((r) => setTimeout(r, 80));
  }
}
try {
  const p = await page();
  assert.equal(await p.locator("#hand .card").count(), 13);
  assert.ok(await p.locator("#three-stage canvas").count());
  await p.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  await p.locator("#rules-open").click();
  assert.ok(await p.locator("#rules-dialog").isVisible());
  await p.keyboard.press("Escape");
  await p.locator("#cpu-count").selectOption("1");
  await p.locator("#start").click();
  await until(() => enabled(p, "#hint"));
  await p.locator("#hint").click();
  if (await enabled(p, "#play")) {
    const before = await p.locator("#hand button").count();
    const n = await p.locator("#hand .selected").count();
    await p.locator("#play").click();
    await until(
      async () => (await p.locator("#hand button").count()) === before - n,
    );
  }
  let steps = 0;
  while (!(await p.locator("#result-dialog").isVisible()) && steps++ < 400) {
    if (await enabled(p, "#hint")) {
      await p.locator("#hint").click();
      if (await enabled(p, "#play")) await p.locator("#play").click();
      else if (await enabled(p, "#pass")) await p.locator("#pass").click();
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(
    await p.locator("#result-dialog").isVisible(),
    "CPU match finishes",
  );
  assert.equal(await p.locator("#played").textContent(), "1");
  await p.locator("#result-dialog [data-close]").click();
  await p.locator("#log-open").click();
  assert.ok(await p.locator("#distribution svg").count());
  await p.keyboard.press("Escape");
  results.push(
    "Desktop: WebGL, rules modal, hint, play, full 2-player CPU match, record, d3 chart",
  );
  const mobile = await page({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mobile.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await mobile.locator("#start").tap();
  await until(() => enabled(mobile, "#hint"));
  await mobile.locator("#hint").tap();
  assert.ok(
    (await mobile.locator("#hand .selected").count()) > 0 ||
      (await enabled(mobile, "#pass")),
  );
  await mobile.screenshot({
    path: "artifacts/mobile-game.png",
    fullPage: true,
  });
  results.push(
    "Mobile 390px: no horizontal overflow, touch start and selection",
  );
  const host = await page(),
    guests = [];
  await host.locator("#online-mode").click();
  await host.locator("#room-open").click();
  await host.locator("#host-room").click();
  for (let i = 0; i < 3; i++) {
    const guest = await page();
    guests.push(guest);
    await guest.locator("#online-mode").click();
    await guest.locator("#room-open").click();
    await guest.locator("#join-room").click();
    await host.locator("#invite").click();
    await until(
      async () => !!(await host.locator("#code-out").inputValue()),
      20000,
    );
    const offer = await host.locator("#code-out").inputValue();
    await guest.locator("#code-in").fill(offer);
    await guest.locator("#apply-code").click();
    await until(
      async () => !!(await guest.locator("#code-out").inputValue()),
      20000,
    );
    const answer = await guest.locator("#code-out").inputValue();
    await host.locator("#code-in").fill(answer);
    await host.locator("#apply-code").click();
    await until(() => enabled(host, "#online-start"), 15000);
  }
  await host.locator("#online-start").click();
  const all = [host, ...guests];
  await until(async () => {
    const counts = await Promise.all(
      all.map((p) => p.locator("#hand button").count()),
    );
    return counts.every((n) => n === 13);
  });
  let actor = -1;
  await until(async () => {
    for (let i = 0; i < all.length; i++)
      if (await enabled(all[i], "#hint")) {
        actor = i;
        return true;
      }
    return false;
  });
  const ids = (
    await Promise.all(
      all.map((p) =>
        p
          .locator("#hand button")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.card)),
      ),
    )
  ).flat();
  assert.equal(new Set(ids).size, 52);
  await all[actor].locator("#hint").click();
  await all[actor].locator("#play").click();
  await until(async () => {
    const text = await Promise.all(
      all.map((p) => p.locator("#table-caption").textContent()),
    );
    return new Set(text).size === 1 && text[0].includes("人過牌");
  });
  await host.screenshot({ path: "artifacts/online-game.png", fullPage: true });
  results.push(
    "4-page real WebRTC: 3 offer/answer exchanges, 52 unique cards, synchronized first action",
  );
  let onlineSteps = 0;
  while (
    !(await host.locator("#result-dialog").isVisible()) &&
    onlineSteps++ < 350
  ) {
    for (const p of all) {
      if (await enabled(p, "#hint")) {
        await p.locator("#hint").click();
        if (await enabled(p, "#play")) await p.locator("#play").click();
        else if (await enabled(p, "#pass")) await p.locator("#pass").click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  await until(async () => {
    const shown = await Promise.all(
      all.map((p) => p.locator("#result-dialog").isVisible()),
    );
    return shown.every(Boolean);
  });
  const scores = await Promise.all(
    all.map((p) => p.locator("#result-scores").textContent()),
  );
  assert.equal(new Set(scores).size, 1);
  results.push(
    "4-player online match finishes with identical scores on all clients",
  );
  await host.locator("#again").click();
  await until(async () => {
    const counts = await Promise.all(
      all.map((p) => p.locator("#hand button").count()),
    );
    return counts.every((n) => n === 13);
  });
  results.push("Host rematch deals 13 cards to all clients");
  await guests[2].close();
  for (const p of [host, guests[0], guests[1]]) {
    await until(async () =>
      /中斷|離線/.test(await p.locator("#status").textContent()),
    );
    assert.ok(!(await enabled(p, "#play")));
    assert.ok(!(await enabled(p, "#hint")));
  }
  results.push("Guest disconnect locks host and every remaining guest");
  assert.deepEqual(errors, []);
  results.push("No uncaught browser JavaScript errors");
  await writeFile(
    "artifacts/browser-results.json",
    JSON.stringify(
      { date: new Date().toISOString(), results, errors },
      null,
      2,
    ),
  );
  console.log(results.join("\n"));
} finally {
  await browser.close();
}
