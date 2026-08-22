import { test, expect, type Page } from "@playwright/test";
import { login, note, OUT, apiVia } from "./qa-utils";
import path from "path";

async function installToastRecorder(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __toasts: string[] }).__toasts = [];
    const push = () => {
      document.querySelectorAll("[role=status]").forEach((el) => {
        const t = (el.textContent || "").trim().replace(/\s+/g, " ");
        const arr = (window as unknown as { __toasts: string[] }).__toasts;
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
  // Loader components also use role=status; filter those out.
  const all: string[] = await page.evaluate(() => (window as any).__toasts ?? []);
  return all.filter((t) => !/^loading/i.test(t));
}
function trackApiErrors(page: Page) {
  const calls: Array<Record<string, unknown>> = [];
  page.on("response", async (res) => {
    if (!res.url().includes("/api/v1") || res.status() < 400) return;
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
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

test.describe("Programs, Assessments, Profile, Notifications", () => {
  test.setTimeout(300_000);

  test("Farm edit with a deleted owner (regression from 06-F)", async ({ page }) => {
    const api = trackApiErrors(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await login(page);

    const farms = await apiVia(page, "GET", "/farms?limit=100&search=QA%20Test%20Farm%20Alpha");
    const farm = (farms.json?.data?.farms ?? [])[0];
    r.farm = farm && { id: farm.id, owner_id: farm.owner_id, owner_name: farm.owner_name };

    if (farm) {
      // Is the owner still a live user?
      const owner = await apiVia(page, "GET", `/users/${farm.owner_id}`);
      r.ownerLookup = { status: owner.status, message: owner.json?.message };

      // Does the owner appear in the farmer list the form uses?
      const farmers = await apiVia(page, "GET", "/users?role=farmer&limit=200");
      const list = farmers.json?.data?.users ?? [];
      r.ownerInFarmerDropdown = list.some((u: any) => u.id === farm.owner_id);
      r.farmerDropdownSize = list.length;

      await page.goto(`/farms/${farm.id}/edit`);
      await page.waitForTimeout(3500);
      r.ownerSelectShows = await page.locator("button#owner").innerText();
      r.areaPrefilled = await page.locator("#area").inputValue();

      await resetToasts(page);
      const before = api.length;
      await page.locator("#area").fill("0.1");
      await page.getByRole("button", { name: /Save changes|Update farm/i }).click();
      await page.waitForTimeout(5000);
      r.saveWithStaleOwner = {
        toasts: await getToasts(page),
        inline: await page.locator(".field-error").allInnerTexts(),
        api: api.slice(before),
      };
      await page.screenshot({ path: path.join(OUT, "farm-edit-stale-owner.png"), fullPage: true });
    }
    note("prog-farm-owner.json", r);
    expect(r).toBeTruthy();
  });

  test("Program detail: enrollments, assessor, assessments, unenroll", async ({ page }) => {
    const api = trackApiErrors(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await login(page);

    // Use the pre-existing program that has submissions (read-only walk).
    const progs = await apiVia(page, "GET", "/programs?limit=50");
    const list = progs.json?.data?.programs ?? [];
    r.programs = list.map((p: any) => ({ id: p.id, name: p.name, code: p.code, enrolled: p.enrolled_count }));
    const withData = list.find((p: any) => (p.enrolled_count ?? 0) > 0) ?? list[0];
    r.chosen = { id: withData?.id, name: withData?.name };

    if (withData) {
      await page.goto(`/programs/${withData.id}`);
      await page.waitForTimeout(5000);
      r.detailBody = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 2500);
      r.detailControls = await page.evaluate(() =>
        Array.from(document.querySelectorAll("main button, main a")).map((b) =>
          (b.textContent || b.getAttribute("title") || "").trim()
        ).filter(Boolean)
      );
      await page.screenshot({ path: path.join(OUT, "program-detail.png"), fullPage: true });

      // Enrolled farmers page
      await page.goto(`/programs/${withData.id}/farmers`);
      await page.waitForTimeout(5000);
      r.farmersBody = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 2000);
      r.farmersControls = await page.evaluate(() =>
        Array.from(document.querySelectorAll("main button")).map((b) =>
          (b.textContent || b.getAttribute("title") || "").trim()
        ).filter(Boolean)
      );
      r.farmersRows = await page.locator("tbody tr").count();
      await page.screenshot({ path: path.join(OUT, "program-farmers.png"), fullPage: true });

      // Try an unenroll on a farmer whose field has a submitted assessment -> expect 409
      const unenrollBtn = page.getByRole("button", { name: /unenroll|remove/i }).first();
      if (await unenrollBtn.count()) {
        await resetToasts(page);
        const before = api.length;
        await unenrollBtn.click();
        await page.waitForTimeout(1000);
        r.unenrollDialog = await page
          .locator("[role=dialog]")
          .innerText()
          .then((t) => t.replace(/\s+/g, " "))
          .catch(() => "<no dialog>");
        const confirmBtn = page.getByRole("button", { name: /unenroll|remove|confirm/i }).last();
        await confirmBtn.click();
        await page.waitForTimeout(5000);
        r.unenrollResult = {
          toasts: await getToasts(page),
          api: api.slice(before),
        };
        await page.screenshot({ path: path.join(OUT, "program-unenroll.png"), fullPage: true });
      } else {
        r.unenrollResult = "<no unenroll control found>";
      }
    }
    r.apiErrors = api.slice(0, 15);
    note("prog-detail.json", r);
    expect(r).toBeTruthy();
  });

  test("Assessments: categories page, reorder, question CRUD, Excel import", async ({ page }) => {
    const api = trackApiErrors(page);
    await installToastRecorder(page);
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
    });
    const r: Record<string, unknown> = {};
    await login(page);

    await page.goto("/assessments");
    await page.waitForTimeout(4000);
    r.categoriesBody = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 1200);
    r.consoleErrorCount = consoleErrors.length;
    r.consoleErrorSample = consoleErrors.slice(0, 3);

    // Create a QA category
    await page.goto("/assessments/categories/new");
    await page.waitForTimeout(2000);
    await resetToasts(page);
    await page.locator("main input[type=text]").first().fill("QA Test Category");
    await page.getByRole("button", { name: /Create category/ }).click();
    await page.waitForTimeout(4000);
    r.createCategory = { toasts: await getToasts(page), url: page.url() };

    const cats = await apiVia(page, "GET", "/assessments/categories");
    const all = cats.json?.data ?? [];
    const mine = all.find((c: any) => c.name === "QA Test Category");
    r.createdCategoryId = mine?.id;
    r.categoryCount = all.length;

    if (mine) {
      // Add a question
      await page.goto(`/assessments/categories/${mine.id}/questions`);
      await page.waitForTimeout(3000);
      r.emptyQuestionsState = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 600);
      await page.screenshot({ path: path.join(OUT, "questions-empty.png"), fullPage: true });

      await page.getByRole("button", { name: /New Question/i }).first().click();
      await page.waitForTimeout(2500);
      r.questionFormInputs = await page.evaluate(() =>
        Array.from(document.querySelectorAll("main input, main textarea, main button")).map((e) => {
          const el = e as HTMLInputElement;
          return `${el.tagName}|${el.type || ""}|${el.id || ""}|${(el.placeholder || el.textContent || "").slice(0, 40)}`;
        })
      );
      await resetToasts(page);
      await page.getByRole("button", { name: /Create question|Save question|Save/i }).first().click();
      await page.waitForTimeout(2500);
      r.questionEmptyValidation = {
        toasts: await getToasts(page),
        inline: await page.locator(".field-error").allInnerTexts(),
      };
      await page.screenshot({ path: path.join(OUT, "question-empty-validation.png"), fullPage: true });
    }

    // Excel import with a non-Excel file - what error do we get?
    await page.goto("/assessments");
    await page.waitForTimeout(3000);
    await resetToasts(page);
    const before = api.length;
    await page.locator("input[type=file]").setInputFiles({
      name: "not-a-spreadsheet.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("this is not an excel file"),
    });
    await page.waitForTimeout(6000);
    r.badExcelImport = { toasts: await getToasts(page), api: api.slice(before) };
    await page.screenshot({ path: path.join(OUT, "excel-import-bad.png"), fullPage: true });

    note("assessments.json", r);
    expect(r).toBeTruthy();
  });

  test("Profile, change password, notifications bell, settings", async ({ page }) => {
    const api = trackApiErrors(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await login(page);

    // PROFILE
    await page.goto("/profile");
    await page.waitForTimeout(3000);
    r.profileBody = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 900);
    r.profileInputs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main input")).map((e) => {
        const el = e as HTMLInputElement;
        return { id: el.id, type: el.type, disabled: el.disabled, readOnly: el.readOnly, value: el.value.slice(0, 40) };
      })
    );
    await page.screenshot({ path: path.join(OUT, "profile.png"), fullPage: true });

    // Avatar upload from a real file
    await resetToasts(page);
    let before = api.length;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    await page.locator("input[type=file]").first().setInputFiles({
      name: "qa-avatar.png",
      mimeType: "image/png",
      buffer: png,
    });
    await page.waitForTimeout(6000);
    r.avatarUpload = { toasts: await getToasts(page), api: api.slice(before) };

    // Upload a non-image to the avatar input
    await resetToasts(page);
    before = api.length;
    await page.locator("input[type=file]").first().setInputFiles({
      name: "qa-not-an-image.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("nope"),
    });
    await page.waitForTimeout(5000);
    r.avatarBadFile = { toasts: await getToasts(page), api: api.slice(before) };

    // Save profile with empty name
    await resetToasts(page);
    before = api.length;
    await page.locator("#fullName").fill("");
    await page.getByRole("button", { name: /Save changes/i }).click();
    await page.waitForTimeout(3000);
    r.profileEmptyName = {
      toasts: await getToasts(page),
      inline: await page.locator(".field-error").allInnerTexts(),
      api: api.slice(before),
    };

    // CHANGE PASSWORD - wrong current password + mismatch + weak
    await page.goto("/profile/change-password");
    await page.waitForTimeout(2500);
    await resetToasts(page);
    await page.getByRole("button", { name: /Change password/i }).last().click();
    await page.waitForTimeout(1500);
    r.pwEmpty = {
      toasts: await getToasts(page),
      inline: await page.locator(".field-error").allInnerTexts(),
    };

    await resetToasts(page);
    await page.locator("#current").fill("WrongCurrent123");
    await page.locator("#new").fill("NewPassword123");
    await page.locator("#confirm").fill("DifferentPassword123");
    await page.getByRole("button", { name: /Change password/i }).last().click();
    await page.waitForTimeout(1500);
    r.pwMismatch = {
      toasts: await getToasts(page),
      inline: await page.locator(".field-error").allInnerTexts(),
    };

    await resetToasts(page);
    before = api.length;
    await page.locator("#confirm").fill("NewPassword123");
    await page.getByRole("button", { name: /Change password/i }).last().click();
    await page.waitForTimeout(5000);
    r.pwWrongCurrent = {
      toasts: await getToasts(page),
      inline: await page.locator(".field-error").allInnerTexts(),
      api: api.slice(before),
    };
    await page.screenshot({ path: path.join(OUT, "change-password.png"), fullPage: true });

    // NOTIFICATIONS BELL
    await page.goto("/dashboard");
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: /notification/i }).first().click();
    await page.waitForTimeout(3000);
    r.notificationPanel = await page.evaluate(() => {
      const txt = document.body.innerText;
      return txt.replace(/\s+/g, " ").slice(0, 800);
    });
    r.notificationControls = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button")).map((b) =>
        (b.textContent || b.getAttribute("aria-label") || "").trim()
      ).filter(Boolean).slice(0, 40)
    );
    await page.screenshot({ path: path.join(OUT, "notifications.png"), fullPage: true });

    // SETTINGS
    await page.goto("/settings");
    await page.waitForTimeout(3000);
    r.settingsBody = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 1200);
    r.settingsControls = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main button")).map((b) => (b.textContent || "").trim()).filter(Boolean)
    );
    await page.screenshot({ path: path.join(OUT, "settings.png"), fullPage: true });

    // Global search box in the topbar - does it do anything?
    await page.goto("/dashboard");
    await page.waitForTimeout(2500);
    const gs = page.getByPlaceholder(/Search farms, users, reports/i);
    r.globalSearchExists = await gs.count();
    if (await gs.count()) {
      await resetToasts(page);
      const beforeUrl = page.url();
      await gs.fill("Patel");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(3000);
      r.globalSearch = {
        urlBefore: beforeUrl,
        urlAfter: page.url(),
        didAnything: page.url() !== beforeUrl,
        toasts: await getToasts(page),
        anyDropdown: await page.locator("[role=listbox], [role=menu]").count(),
      };
    }

    note("profile-settings.json", r);
    expect(r).toBeTruthy();
  });
});
