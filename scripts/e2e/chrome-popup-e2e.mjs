/**
 * Chrome end-to-end check for the built extension UI.
 *
 * Launches real Chrome, installs the unpacked build over the DevTools pipe
 * (`--load-extension` is gone from branded Chrome 137+), then drives the popup and the
 * run window: signed-out gate, seeded portal, language choice, file selection, consents,
 * and the Start button. Any console error, uncaught exception, or emptied root fails.
 *
 * Usage: node scripts/e2e/chrome-popup-e2e.mjs [--keep-open]
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const extensionDir = path.join(root, "apps/extension/.output/chrome-mv3");
const keepOpen = process.argv.includes("--keep-open");
const shotFlagIndex = process.argv.indexOf("--shots");
const shotDir = shotFlagIndex === -1 ? "" : path.resolve(process.argv[shotFlagIndex + 1] || "e2e-shots");

const CHROME_CANDIDATES = [
  path.join(process.env["ProgramFiles"] || "", "Google/Chrome/Application/chrome.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "", "Google/Chrome/Application/chrome.exe"),
  path.join(process.env["LOCALAPPDATA"] || "", "Google/Chrome/Application/chrome.exe"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Chrome was not found. Add its path to CHROME_CANDIDATES.");
}

/** CDP over the DevTools pipe: NUL-delimited JSON on fd 3 (write) and fd 4 (read). */
class PipeCdp {
  constructor(child) {
    this.child = child;
    this.out = child.stdio[3];
    this.in = child.stdio[4];
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.in.on("data", (chunk) => this.#consume(chunk));
  }

  #consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    let index;
    while ((index = this.buffer.indexOf(0)) !== -1) {
      const raw = this.buffer.subarray(0, index).toString("utf8");
      this.buffer = this.buffer.subarray(index + 1);
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        continue;
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.method || ""} ${JSON.stringify(message.error)}`));
        else resolve(message.result);
        continue;
      }
      for (const listener of this.listeners) listener(message);
    }
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params, ...(sessionId ? { sessionId } : {}) };
    this.out.write(`${JSON.stringify(payload)}\0`);
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

async function openPage(cdp, url, label) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const problems = [];
  cdp.on((message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params?.exceptionDetails;
      problems.push(`${label} exception: ${details?.exception?.description || details?.text}`);
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
      const text = (message.params.args || []).map((arg) => arg.value ?? arg.description ?? "").join(" ");
      problems.push(`${label} console.error: ${text}`);
    }
  });
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("DOM.enable", {}, sessionId);
  await cdp.send("Page.navigate", { url }, sessionId);

  const page = {
    label,
    sessionId,
    problems,
    async eval(expression) {
      const result = await cdp.send(
        "Runtime.evaluate",
        { expression, awaitPromise: true, returnByValue: true },
        sessionId,
      );
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      }
      return result.result?.value;
    },
    async waitFor(expression, { timeoutMs = 15000, label: what = expression } = {}) {
      const started = Date.now();
      let last = "";
      while (Date.now() - started < timeoutMs) {
        try {
          if (await page.eval(`Boolean(${expression})`)) return true;
        } catch (error) {
          last = String(error.message || error);
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      throw new Error(`Timed out waiting for ${what}${last ? ` (last error: ${last})` : ""}`);
    },
    async text() {
      return String(await page.eval("document.body.innerText")).replace(/\s+/g, " ").trim();
    },
    async setFiles(selector, files) {
      const doc = await cdp.send("DOM.getDocument", { depth: -1 }, sessionId);
      const node = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector }, sessionId);
      if (!node.nodeId) throw new Error(`No element matched ${selector}`);
      await cdp.send("DOM.setFileInputFiles", { files, nodeId: node.nodeId }, sessionId);
    },
    async click(selector) {
      await page.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error("missing"); el.click(); return true; })()`,
      );
    },
    async shoot(filePath, width) {
      const height = Math.min(
        2400,
        Math.max(400, Number(await page.eval("document.documentElement.scrollHeight")) + 8),
      );
      await cdp.send(
        "Emulation.setDeviceMetricsOverride",
        { width, height, deviceScaleFactor: 2, mobile: false },
        sessionId,
      );
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
      fs.writeFileSync(filePath, Buffer.from(shot.data, "base64"));
      await cdp.send("Emulation.clearDeviceMetricsOverride", {}, sessionId);
    },
  };
  return page;
}

const EMAIL = "e2e@pairproof.test";
const USER_ID = "usr_e2e_1";

/** Storage writes that move the gate forward one step at a time. */
const seed = {
  session: `chrome.storage.local.set({
    "moss.auth.session": {
      email: ${JSON.stringify(EMAIL)},
      userId: ${JSON.stringify(USER_ID)},
      accessToken: "e2e-access-token",
      refreshToken: "e2e-refresh-token",
      signedInAt: Date.now(),
    },
    "moss.auth.deviceId": "dev_e2e_fixed_device_identifier",
  })`,
  entitlement: `chrome.storage.local.set({
    "moss.demo.entitlement": {
      remaining: 5,
      total: 15,
      maxFilesPerRun: 2,
      purchasedAt: Date.now(),
      planId: "pair",
      mode: "pair",
      allowsDirectory: false,
      ownerUserId: ${JSON.stringify(USER_ID)},
      ownerEmail: ${JSON.stringify(EMAIL)},
    },
  })`,
  moss: `(() => {
    const salt = "moss-local-vault-v1";
    const mixed = Array.from("936770554", (ch, i) =>
      String.fromCharCode(ch.charCodeAt(0) ^ salt.charCodeAt(i % salt.length)),
    ).join("");
    return chrome.storage.local.set({
      "moss.demo.mossCredential": {
        display: "*****0554",
        connectedAt: Date.now(),
        registrationEmail: ${JSON.stringify(EMAIL)},
        localCipher: btoa(salt + ":" + mixed),
        ownerUserId: ${JSON.stringify(USER_ID)},
        ownerEmail: ${JSON.stringify(EMAIL)},
      },
    });
  })()`,
};

async function main() {
  if (!fs.existsSync(path.join(extensionDir, "manifest.json"))) {
    throw new Error(`Build the extension first — no manifest.json in ${extensionDir}`);
  }
  const chromePath = findChrome();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "pairproof-e2e-"));
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "pairproof-files-"));
  const fileA = path.join(fixtureDir, "alpha.py");
  const fileB = path.join(fixtureDir, "beta.py");
  const fileC = path.join(fixtureDir, "gamma.py");
  fs.writeFileSync(fileA, "def total(items):\n    return sum(items)\n");
  fs.writeFileSync(fileB, "def total(values):\n    return sum(values)\n");
  fs.writeFileSync(fileC, "def total(rows):\n    return sum(rows) + 1\n");

  const chrome = spawn(
    chromePath,
    [
      `--user-data-dir=${profileDir}`,
      "--remote-debugging-pipe",
      "--enable-unsafe-extension-debugging",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-search-engine-choice-screen",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
  );

  const cdp = new PipeCdp(chrome);
  try {
    await cdp.send("Browser.getVersion");
    const loaded = await cdp.send("Extensions.loadUnpacked", { path: extensionDir });
    const extensionId = String(loaded.id || "");
    check("unpacked build installs in Chrome", Boolean(extensionId), extensionId);
    if (!extensionId) throw new Error("extension did not install");

    // ---------- popup surface ----------
    const popup = await openPage(cdp, `chrome-extension://${extensionId}/popup.html`, "popup");
    await popup.waitFor(`document.querySelector(".shell")`, { label: "popup shell" });
    const signedOutText = await popup.text();
    check(
      "popup renders the account gate when signed out",
      signedOutText.includes("Account required"),
      signedOutText.slice(0, 90),
    );

    const reload = async (waitText, label) => {
      await popup.eval("location.reload()");
      await popup.waitFor(`document.querySelector(".shell")`, { label: `${label} shell` });
      await popup.waitFor(`document.body.innerText.includes(${JSON.stringify(waitText)})`, { label });
    };
    if (shotDir) {
      fs.mkdirSync(shotDir, { recursive: true });
      await popup.shoot(path.join(shotDir, "1-popup-account.png"), 380);
    }

    // A fresh account must meet pricing before Moss ID, and Moss ID before any run.
    await popup.eval(seed.session);
    await reload("Choose a plan", "paywall gate");
    const paywallText = await popup.text();
    check(
      "a signed-in account without a plan sees pricing first",
      /Free demo/.test(paywallText) && /\$15/.test(paywallText) && /\$50/.test(paywallText),
      paywallText.slice(0, 120),
    );
    if (shotDir) await popup.shoot(path.join(shotDir, "2-popup-pricing.png"), 380);

    await popup.eval(seed.entitlement);
    await reload("Connect Moss User ID", "moss id gate");
    check("a plan without a Moss User ID lands on Moss onboarding", true, await popup.eval(`document.querySelector("#status-heading").textContent`));
    if (shotDir) await popup.shoot(path.join(shotDir, "3-popup-moss-id.png"), 380);

    await popup.eval(seed.moss);
    await reload("runs left", "portal gate");
    check("plan plus Moss User ID unlocks the portal", true, await popup.eval(`document.querySelector("#status-heading").textContent`));

    // A browser-action popup is destroyed the moment the OS file chooser takes focus,
    // so the popup must hand file work to the run window instead of hosting pickers.
    const popupFileInputs = await popup.eval(`document.querySelectorAll('input[type="file"]').length`);
    check(
      "popup hosts no file inputs (a file chooser would kill the popup)",
      popupFileInputs === 0,
      `${popupFileInputs} inputs`,
    );
    check(
      "popup offers the run window",
      await popup.eval(
        `Array.from(document.querySelectorAll("button")).some((b) => /Open run window/i.test(b.textContent || ""))`,
      ),
    );

    // ---------- run window surface ----------
    const page = await openPage(cdp, `chrome-extension://${extensionId}/workspace.html`, "window");
    await page.waitFor(`document.querySelector(".shell")`, { label: "run window shell" });
    await page.waitFor(`document.body.innerText.includes("runs left")`, { label: "run window portal" });
    check("run window opens straight into the portal", true, await page.eval(`document.querySelector("#status-heading").textContent`));

    const languageValue = await page.eval(
      `(() => {
        const select = document.querySelector("#workspace-language");
        select.value = "python";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return select.value;
      })()`,
    );
    check("language dropdown applies immediately", languageValue === "python", languageValue);
    check(
      "no separate language confirmation step",
      !(await page.eval(`/Confirm language/i.test(document.body.innerText)`)),
    );
    check(
      "no language search field",
      await page.eval(`document.querySelector("#language-search") === null`),
    );

    await page.setFiles(`input[aria-label="Choose first file"]`, [fileA]);
    await page.waitFor(`document.body.innerText.includes("alpha.py")`, { label: "first file listed" });
    check(
      "UI survives the first file selection",
      await page.eval(`Boolean(document.querySelector(".shell")) && document.getElementById("root").children.length > 0`),
    );

    await page.setFiles(`input[aria-label="Choose second file"]`, [fileB]);
    await page.waitFor(`document.body.innerText.includes("beta.py")`, { label: "second file listed" });
    check(
      "UI survives the second file selection",
      await page.eval(`Boolean(document.querySelector(".shell")) && document.getElementById("root").children.length > 0`),
    );

    const consents = await page.eval(
      `(() => {
        const boxes = Array.from(document.querySelectorAll('.consent-row input[type="checkbox"]'));
        boxes.forEach((box) => { if (!box.checked) box.click(); });
        return boxes.length;
      })()`,
    );
    check("consent checkboxes tick", consents >= 2, `${consents} boxes`);
    if (shotDir) {
      await popup.shoot(path.join(shotDir, "4-popup-ready.png"), 380);
      await page.shoot(path.join(shotDir, "5-run-window-ready.png"), 620);
    }

    const startButtons = await page.eval(
      `Array.from(document.querySelectorAll("button"))
        .filter((b) => /^Start (Pair|Batch) Check$/.test((b.textContent || "").trim()))
        .map((b) => ({ disabled: b.disabled, afterConsent: Boolean(b.closest("[data-start-position=\\"footer\\"]")) }))`,
    );
    check("a Start button also sits after the consents", startButtons.some((b) => b.afterConsent), JSON.stringify(startButtons));
    check("Start is enabled once files, language and consents are ready", startButtons.some((b) => !b.disabled), JSON.stringify(startButtons));

    // Picking into a filled Pair tile swaps that one file; it must not append a third.
    await page.setFiles(`input[aria-label="Choose second file"]`, [fileC]);
    await page.waitFor(`document.body.innerText.includes("gamma.py")`, { label: "file 2 replaced" });
    const slots = await page.eval(
      `Array.from(document.querySelectorAll(".file-button__name")).map((n) => n.textContent.trim())`,
    );
    check(
      "choosing again in a filled tile replaces that file",
      slots.length === 2 && slots[0] === "alpha.py" && slots[1] === "gamma.py",
      JSON.stringify(slots),
    );
    check(
      "consents reset after the file change",
      await page.eval(
        `Array.from(document.querySelectorAll('.consent-row input[type="checkbox"]')).every((b) => !b.checked)`,
      ),
    );

    const cleared = await page.eval(
      `(() => {
        const button = Array.from(document.querySelectorAll("button")).find((b) => /Clear both files/i.test(b.textContent || ""));
        if (!button) return "no clear button";
        button.click();
        return "clicked";
      })()`,
    );
    await page.waitFor(`!document.body.innerText.includes("gamma.py")`, { label: "files cleared" });
    check("clearing the files keeps the UI alive", await page.eval(`Boolean(document.querySelector(".shell"))`), cleared);

    if (shotDir) {
      await page.shoot(path.join(shotDir, "6-run-window-after-clear.png"), 620);
      console.log(`\nscreenshots written to ${shotDir}`);
    }

    const problems = [...popup.problems, ...page.problems].filter(
      (entry) => !/Failed to load resource|net::ERR|favicon|Unchecked runtime\.lastError/i.test(entry),
    );
    check("no console errors or uncaught exceptions", problems.length === 0, problems.join(" | "));

    if (keepOpen) {
      console.log("\n--keep-open set; Chrome stays up. Ctrl+C to stop.");
      await new Promise(() => {});
    }
  } finally {
    if (!keepOpen) chrome.kill();
  }

  const failed = results.filter((entry) => !entry.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\nharness error: ${error?.stack || error}`);
  process.exitCode = 1;
});
