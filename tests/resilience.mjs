import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "chrome",
  headless: true,
});
const results = [],
  errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 },
  });
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:4173");
  await p.waitForSelector("#hand .card");
  await p.locator("#start").click();
  await p.waitForTimeout(280);
  await p.screenshot({ path: "artifacts/shuffle.png", fullPage: true });
  assert.ok(!(await p.locator("#hint").isEnabled()));
  await p.waitForTimeout(540);
  await p.screenshot({ path: "artifacts/deal.png", fullPage: true });
  await p.locator("#online-mode").click();
  await p.waitForTimeout(1600);
  assert.equal(await p.locator("#hand button").count(), 0);
  assert.ok(await p.locator("#table-announcement").isVisible());
  results.push(
    "Normal animation: shuffle/deal screenshots, controls locked, switching mode cancels old deal",
  );
  await p.locator("#room-open").click();
  await p.locator("#host-room").click();
  await p.locator("#invite").click();
  await p.waitForFunction(() => !!document.querySelector("#code-out").value);
  await p.locator("#cancel-invite").click();
  await p.waitForTimeout(200);
  assert.match(await p.locator("#network-status").textContent(), /已取消/);
  await p.locator("#invite").click();
  await p.waitForFunction(() => !!document.querySelector("#code-out").value);
  await p.locator("#code-in").fill("invalid");
  await p.locator("#apply-code").click();
  assert.match(await p.locator("#network-status").textContent(), /無效|不符/);
  await p.locator("#leave-room").click();
  results.push(
    "Cancel invitation and invite again; invalid code produces recovery message",
  );
  const fallbackContext = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    reducedMotion: "reduce",
  });
  await fallbackContext.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type.startsWith("webgl")) return null;
      return original.call(this, type, ...args);
    };
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("Storage blocked");
      },
    });
  });
  const f = await fallbackContext.newPage();
  f.on("pageerror", (e) => errors.push(e.message));
  await f.goto("http://127.0.0.1:4173");
  await f.waitForSelector("#hand .card");
  assert.equal(await f.locator("#three-stage canvas").count(), 0);
  await f.locator("#cpu-count").selectOption("1");
  await f.locator("#start").click();
  await f.waitForFunction(() => !document.querySelector("#hint").disabled);
  await f.locator("#hint").click();
  await f.locator("#play").click();
  await f.waitForFunction(
    () => document.querySelectorAll("#played-cards .card").length > 0,
  );
  assert.ok(await f.locator("#played-cards").isVisible());
  assert.ok(
    await f.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await f.screenshot({ path: "artifacts/fallback-tablet.png", fullPage: true });
  results.push(
    "820px tablet, WebGL unavailable and localStorage blocked: game plays with visible HTML table cards",
  );
  await f.locator("#rules-open").click();
  assert.equal(
    await f.evaluate(() => document.activeElement.getAttribute("aria-label")),
    "關閉桌規",
  );
  await f.keyboard.press("Tab");
  await f.keyboard.press("Shift+Tab");
  const focused = await f.evaluate(() =>
    document.activeElement.getAttribute("aria-label"),
  );
  assert.equal(focused, "關閉桌規");
  await f.keyboard.press("Enter");
  assert.ok(!(await f.locator("#rules-dialog").isVisible()));
  results.push("Keyboard: initial modal focus, Tab/Shift+Tab and Enter close");
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/resilience-results.json",
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
