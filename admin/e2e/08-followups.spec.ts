import { test, expect, type Page } from "@playwright/test";
import { login, note, OUT, apiVia } from "./qa-utils";
import path from "path";

async function installToastRecorder(page: Page) {
  await page.addInitScript(() => {
    (window as any).__toasts = [];
    const push = () => {
      document.querySelectorAll("[role=status]").forEach((el) => {
        const t = (el.textContent || "").trim().replace(/\s+/g, " ");
        const arr = (window as any).__toasts;
        if (t && arr[arr.length - 1] !== t) arr.push(t);
      });
    };
    const start = () =>
      new MutationObserver(push).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  });
}
async function resetToasts(page: Page) {
  await page.evaluate(() => ((window as any).__toasts = []));
}
async function getToasts(page: Page): Promise<string[]> {
  const all: string[] = await page.evaluate(() => (window as any).__toasts ?? []);
  return all.filter((t) => !/^loading/i.test(t));
}
function trackApi(page: Page) {
  const calls: Array<Record<string, unknown>> = [];
  page.on("response", async (res) => {
    if (!res.url().includes("/api/v1")) return;
    let body: any = null;
    if (res.status() >= 400) {
      try {
        body = await res.json();
      } catch {
        /* ignore */
      }
    }
    calls.push({
      status: res.status(),
      method: res.request().method(),
      url: res.url().replace("http://localhost:5001/api/v1", ""),
      backendMessage: body?.message ?? null,
    });
  });
  return calls;
}

test.describe("Follow-ups: slow loads, dead controls, assessments, reorder", () => {
  test.setTimeout(300_000);

  test("Do the 'Loading...' screens ever finish? (20s budget)", async ({ page }) => {
    const r: Record<string, unknown> = {};
    await login(page);

    const targets: Array<[string, string]> = [
      ["settings", "/settings"],
      ["profile", "/profile"],
    ];
    const progs = await apiVia(page, "GET", "/programs?limit=50");
    const withData = (progs.json?.data?.programs ?? []).find((p: any) => (p.enrolled_count ?? 0) > 0);
    if (withData) {
      targets.push(["programDetail", `/programs/${withData.id}`]);
      targets.push(["enrolledFarmers", `/programs/${withData.id}/farmers`]);
    }
    const farms = await apiVia(page, "GET", "/farms?limit=5");
    const farm = (farms.json?.data?.farms ?? [])[0];
    if (farm) targets.push(["farmDetail", `/farms/${farm.id}`]);
    const fields = await apiVia(page, "GET", "/fields?limit=5");
    const field = (fields.json?.data?.fields ?? [])[0];
    if (field) targets.push(["fieldDetail", `/fields/${field.id}`]);

    const out: Record<string, unknown> = {};
    for (const [name, url] of targets) {
      await page.goto(url);
      const samples: Record<string, boolean> = {};
      for (const t of [2000, 5000, 10000, 20000]) {
        await page.waitForTimeout(t === 2000 ? 2000 : t - Number(Object.keys(samples).pop() ?? 0));
        const txt = await page.locator("main").innerText().catch(() => "");
        samples[String(t)] = /loading/i.test(txt);
      }
      const finalTxt = await page.locator("main").innerText().catch(() => "");
      out[name] = {
        url,
        stillLoadingAt: samples,
        finalText: finalTxt.replace(/\s+/g, " ").slice(0, 700),
      };
      await page.screenshot({ path: path.join(OUT, `slow-${name}.png`), fullPage: true });
    }
    r.targets = out;
    note("slow-loads.json", r);
    expect(r).toBeTruthy();
  });

  test("Dead controls: global search, dashboard export, notification click", async ({ page }) => {
    const api = trackApi(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/dashboard");
    await page.waitForTimeout(5000);

    // Global search in the topbar
    const gs = page.getByPlaceholder(/Search farms, users, reports/i);
    await resetToasts(page);
    let before = api.length;
    await gs.fill("Patel");
    await page.waitForTimeout(1500);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);
    r.globalSearch = {
      url: page.url(),
      toasts: await getToasts(page),
      newApiCalls: api.slice(before).map((c) => c.url),
      dropdowns: await page.locator("[role=listbox],[role=menu]").count(),
      isInsideForm: await gs.evaluate((e) => !!e.closest("form")),
    };

    // Dashboard "Export report"
    await resetToasts(page);
    before = api.length;
    const dl = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
    await page.getByRole("button", { name: /Export report/i }).click();
    await page.waitForTimeout(6000);
    const download = await dl;
    r.exportReport = {
      downloadStarted: !!download,
      downloadName: download ? download.suggestedFilename() : null,
      toasts: await getToasts(page),
      newApiCalls: api.slice(before).map((c) => `${c.status} ${c.url}`),
      urlChanged: page.url(),
    };
    await page.screenshot({ path: path.join(OUT, "dashboard-export.png"), fullPage: true });

    // Notification item click
    await page.getByRole("button", { name: /notification/i }).first().click();
    await page.waitForTimeout(2500);
    const items = page.locator("button").filter({ hasText: /submitted an assessment/i });
    r.notificationItemCount = await items.count();
    if (await items.count()) {
      const urlBefore = page.url();
      await items.first().click();
      await page.waitForTimeout(3000);
      r.notificationClick = { urlBefore, urlAfter: page.url(), navigated: page.url() !== urlBefore };
    }

    // "View more" / "View all login activity" links on dashboard
    await page.goto("/dashboard");
    await page.waitForTimeout(4000);
    r.dashboardLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main button, main a")).map((b) => ({
        text: (b.textContent || "").trim().slice(0, 40),
        tag: b.tagName,
        href: b.getAttribute("href"),
      })).filter((x) => x.text)
    );

    note("dead-controls.json", r);
    expect(r).toBeTruthy();
  });

  test("Assessments: create category, question validation, reorder, bad Excel", async ({ page }) => {
    const api = trackApi(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await login(page);

    // CREATE category (input has no type attribute, so match on placeholder)
    await page.goto("/assessments/categories/new");
    await page.waitForTimeout(3000);
    await resetToasts(page);
    await page.getByPlaceholder(/Biodiversity/i).fill("QA Test Category");
    await page.getByRole("button", { name: /Create category/ }).click();
    await page.waitForTimeout(5000);
    r.createCategory = { toasts: await getToasts(page), url: page.url() };

    // Empty-name validation
    await page.goto("/assessments/categories/new");
    await page.waitForTimeout(2500);
    await resetToasts(page);
    await page.getByRole("button", { name: /Create category/ }).click();
    await page.waitForTimeout(2000);
    r.categoryEmptyValidation = {
      toasts: await getToasts(page),
      inline: await page.locator(".field-error").allInnerTexts(),
    };

    const cats = await apiVia(page, "GET", "/assessments/categories");
    const all = cats.json?.data?.categories ?? cats.json?.data ?? [];
    const mine = all.find((c: any) => c.name === "QA Test Category");
    r.createdCategoryId = mine?.id;

    if (mine) {
      await page.goto(`/assessments/categories/${mine.id}/questions`);
      await page.waitForTimeout(4000);
      r.emptyQuestionsState = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 700);
      await page.screenshot({ path: path.join(OUT, "questions-empty.png"), fullPage: true });

      await page.getByRole("button", { name: /New Question/i }).first().click();
      await page.waitForTimeout(3000);
      r.questionFormUrl = page.url();
      r.questionFormFields = await page.evaluate(() =>
        Array.from(document.querySelectorAll("main input, main textarea")).map((e) => {
          const el = e as HTMLInputElement;
          return `${el.tagName}|${el.id}|${el.placeholder}`;
        })
      );
      await resetToasts(page);
      const btn = page.getByRole("button", { name: /Create question|Save/i }).first();
      await btn.click();
      await page.waitForTimeout(2500);
      r.questionEmptyValidation = {
        toasts: await getToasts(page),
        inline: await page.locator(".field-error").allInnerTexts(),
      };
      await page.screenshot({ path: path.join(OUT, "question-form.png"), fullPage: true });
    }

    // Bad Excel import
    await page.goto("/assessments");
    await page.waitForTimeout(4000);
    await resetToasts(page);
    const before = api.length;
    await page.locator("input[type=file]").setInputFiles({
      name: "not-a-spreadsheet.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("this is not an excel file"),
    });
    await page.waitForTimeout(8000);
    r.badExcelImport = {
      toasts: await getToasts(page),
      api: api.slice(before).filter((c) => Number(c.status) >= 400),
    };
    await page.screenshot({ path: path.join(OUT, "excel-import-bad.png"), fullPage: true });

    // Reorder via drag: does it persist?
    await page.goto("/assessments");
    await page.waitForTimeout(4000);
    r.orderBefore = await page.locator("tbody tr").evaluateAll((rows) =>
      rows.map((x) => (x.querySelectorAll("td")[2]?.textContent || "").trim().slice(0, 30))
    );
    const handles = page.locator("tbody tr td:first-child button");
    if ((await handles.count()) >= 2) {
      const a = handles.nth(0);
      const b = handles.nth(1);
      const boxA = await a.boundingBox();
      const boxB = await b.boundingBox();
      if (boxA && boxB) {
        await resetToasts(page);
        const before2 = api.length;
        await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
        await page.mouse.down();
        await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2 + 10, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(4000);
        r.reorder = {
          toasts: await getToasts(page),
          apiCalls: api.slice(before2).map((c) => `${c.status} ${c.method} ${c.url}`),
          orderAfter: await page.locator("tbody tr").evaluateAll((rows) =>
            rows.map((x) => (x.querySelectorAll("td")[2]?.textContent || "").trim().slice(0, 30))
          ),
        };
        await page.reload();
        await page.waitForTimeout(4000);
        r.orderAfterReload = await page.locator("tbody tr").evaluateAll((rows) =>
          rows.map((x) => (x.querySelectorAll("td")[2]?.textContent || "").trim().slice(0, 30))
        );
      }
    }

    note("assessments2.json", r);
    expect(r).toBeTruthy();
  });

  test("Double submit check + program unenroll 409 on the program detail page", async ({ page }) => {
    const api = trackApi(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await login(page);

    // Change password: one click -> how many requests?
    await page.goto("/profile/change-password");
    await page.waitForTimeout(3000);
    await page.locator("#current").fill("WrongCurrent123");
    await page.locator("#new").fill("NewPassword123");
    await page.locator("#confirm").fill("NewPassword123");
    await resetToasts(page);
    const before = api.length;
    await page.getByRole("button", { name: /Change password/i }).last().click();
    await page.waitForTimeout(7000);
    r.changePasswordOneClick = {
      requests: api.slice(before).filter((c) => String(c.url).includes("change-password")),
      toasts: await getToasts(page),
    };

    // Unenroll on the program detail page (where the control actually lives)
    const progs = await apiVia(page, "GET", "/programs?limit=50");
    const withData = (progs.json?.data?.programs ?? []).find((p: any) => (p.enrolled_count ?? 0) > 0);
    if (withData) {
      await page.goto(`/programs/${withData.id}`);
      await page.waitForTimeout(8000);
      r.enrolledHeading = await page
        .locator("main")
        .innerText()
        .then((t) => (t.match(/ENROLLED FARMERS \(\d+\)/i) || [""])[0]);

      const un = page.getByRole("button", { name: /^Unenroll$/i }).first();
      r.unenrollFound = await un.count();
      if (await un.count()) {
        await resetToasts(page);
        const b2 = api.length;
        await un.click();
        await page.waitForTimeout(1200);
        r.unenrollDialog = await page
          .locator("[role=dialog]")
          .innerText()
          .then((t) => t.replace(/\s+/g, " "))
          .catch(() => "<no confirmation dialog>");
        // confirm
        const yes = page.locator("[role=dialog]").getByRole("button", { name: /unenroll|remove|confirm|yes/i }).last();
        if (await yes.count()) await yes.click();
        await page.waitForTimeout(6000);
        r.unenrollResult = {
          toasts: await getToasts(page),
          api: api.slice(b2).filter((c) => Number(c.status) >= 400),
          allCalls: api.slice(b2).map((c) => `${c.status} ${c.method} ${c.url}`).slice(0, 8),
        };
        await page.screenshot({ path: path.join(OUT, "program-unenroll.png"), fullPage: true });
      }
    }

    note("followup-misc.json", r);
    expect(r).toBeTruthy();
  });
});
