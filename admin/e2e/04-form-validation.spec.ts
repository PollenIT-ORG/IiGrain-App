import { test, expect, type Page } from "@playwright/test";
import { login, captureProblems, note, OUT, apiVia } from "./qa-utils";
import path from "path";

async function fieldErrors(page: Page): Promise<string[]> {
  return page.locator(".field-error, .text-danger").allInnerTexts();
}

async function submitAndRead(page: Page, buttonName: RegExp) {
  const btn = page.getByRole("button", { name: buttonName });
  if ((await btn.count()) === 0) {
    return { url: page.url(), errors: ["<submit button gone - form navigated away>"], toast: "" };
  }
  await btn.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return {
    url: page.url(),
    errors: (await fieldErrors(page)).map((e) => e.replace(/\s+/g, " ").trim()),
    toast: (await page.locator("body").innerText())
      .split("\n")
      .slice(0, 3)
      .join(" ")
      .trim(),
  };
}

test.describe("Create-form validation", () => {
  test.setTimeout(300_000);

  test("Add user form", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/users/new");
    await page.waitForTimeout(1500);

    r.emptySubmit = await submitAndRead(page, /Create user/);

    // invalid email + short password + bad phone
    await page.locator("#fullName").fill("QA Test User");
    await page.locator("#email").fill("bad-email-format");
    await page.locator("#password").fill("abc");
    await page.locator("#phone").fill("12");
    r.invalidValues = await submitAndRead(page, /Create user/);

    // password without a digit
    await page.locator("#email").fill("qa.test.user@example.com");
    await page.locator("#password").fill("onlyletters");
    r.passwordNoDigit = await submitAndRead(page, /Create user/);

    // very long name - is maxLength enforced?
    const long = "Q".repeat(500);
    await page.locator("#fullName").fill(long);
    r.longNameAccepted = (await page.locator("#fullName").inputValue()).length;
    r.longNameMaxAttr = await page.locator("#fullName").getAttribute("maxlength");

    // duplicate email (superadmin) -> backend 409, is it surfaced?
    await page.locator("#fullName").fill("QA Test Dup");
    await page.locator("#email").fill("superadmin@farmerapp.com");
    await page.locator("#password").fill("ValidPass123");
    r.duplicateEmail = await submitAndRead(page, /Create user/);
    await page.waitForTimeout(2000);
    r.duplicateEmailBody = (await page.locator("body").innerText())
      .replace(/\s+/g, " ")
      .slice(0, 300);
    await page.screenshot({ path: path.join(OUT, "user-form-duplicate.png"), fullPage: true });

    // Which roles can be picked?
    await page.getByRole("button", { name: /Farmer|Select|role/i }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    r.roleOptions = await page.locator("li[role=option]").allInnerTexts().catch(() => []);
    await page.keyboard.press("Escape");

    r.consoleErrors = consoleErrors.slice(0, 8);
    r.failedRequests = failedRequests.slice(0, 8);
    note("form-user.json", r);
    expect(r).toBeTruthy();
  });

  test("Add farm form", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/farms/new");
    await page.waitForTimeout(2000);

    r.emptySubmit = await submitAndRead(page, /Create farm/);

    // negative area
    await page.locator("#name").fill("QA Test Farm Validation");
    await page.locator("#area").fill("-50");
    r.negativeArea = await submitAndRead(page, /Create farm/);

    // zero area
    await page.locator("#area").fill("0");
    r.zeroArea = await submitAndRead(page, /Create farm/);

    // non numeric area - type it (fill() refuses on number inputs)
    await page.locator("#area").click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("abc");
    r.textAreaValue = await page.locator("#area").inputValue();
    r.numberInputAttrs = await page.locator("#area").evaluate((e: HTMLInputElement) => ({
      type: e.type,
      min: e.min,
      max: e.max,
      step: e.step,
    }));
    r.textArea = await submitAndRead(page, /Create farm/);

    // huge area
    await page.locator("#area").fill("999999999999");
    r.hugeArea = await submitAndRead(page, /Create farm/);

    r.consoleErrors = consoleErrors.slice(0, 8);
    r.failedRequests = failedRequests.slice(0, 8);
    note("form-farm.json", r);
    expect(r).toBeTruthy();
  });

  test("Add field form incl. soil values", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/fields/new");
    await page.waitForTimeout(2000);

    r.emptySubmit = await submitAndRead(page, /Create field/);

    await page.locator("#name").fill("QA Test Field Validation");
    await page.locator("#area").fill("-5");
    await page.locator("#ph").fill("99");           // pH out of range
    await page.locator("#organicMatter").fill("-3"); // negative
    await page.locator("#moisture").fill("500");     // % over 100
    await page.locator("#nitrogen").fill("-1");
    r.badSoil = await submitAndRead(page, /Create field/);

    // sowing date after harvest date
    await page.locator("#sowingDate").fill("2026-12-31");
    await page.locator("#expectedHarvest").fill("2026-01-01");
    await page.locator("#area").fill("10");
    await page.locator("#ph").fill("6.5");
    await page.locator("#organicMatter").fill("3");
    await page.locator("#moisture").fill("20");
    await page.locator("#nitrogen").fill("40");
    r.dateOrder = await submitAndRead(page, /Create field/);

    r.consoleErrors = consoleErrors.slice(0, 8);
    r.failedRequests = failedRequests.slice(0, 8);
    note("form-field.json", r);
    expect(r).toBeTruthy();
  });

  test("Add program form", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/programs/new");
    await page.waitForTimeout(1500);

    r.emptySubmit = await submitAndRead(page, /Create program/);

    await page.locator("#name").fill("QA Test Program Validation");
    await page.locator("#code").fill("QA-VAL-1");
    // end date before start date
    await page.locator("#startDate").fill("2026-12-31");
    await page.locator("#endDate").fill("2026-01-01");
    r.endBeforeStart = await submitAndRead(page, /Create program/);

    // enrolment limit negative (checkbox first)
    await page.locator("#startDate").fill("2026-01-01");
    await page.locator("#endDate").fill("2026-12-31");
    // "No Limit" is checked by default; uncheck it to enable the limit input.
    const cb = page.locator("input[type=checkbox]").first();
    if (await cb.isVisible()) {
      await cb.uncheck();
      await page.waitForTimeout(400);
      const limit = page.locator("input[type=number]").first();
      r.limitEnabledAfterUncheck = await limit.isEnabled();
      await limit.fill("-10");
      r.negativeLimit = await submitAndRead(page, /Create program/);
      await limit.fill("0");
      r.zeroLimit = await submitAndRead(page, /Create program/);
      await limit.fill("1.5");
      r.fractionalLimit = await submitAndRead(page, /Create program/);
    }

    // Did any of the invalid submissions actually create a program?
    const created = await apiVia(page, "GET", "/programs?limit=100&search=QA Test");
    r.programsMatchingQaTest = (created.json?.data?.programs ?? created.json?.data ?? [])
      .map((p: any) => ({ id: p.id, name: p.name, code: p.code, start: p.start_date, end: p.end_date }));

    r.consoleErrors = consoleErrors.slice(0, 8);
    r.failedRequests = failedRequests.slice(0, 8);
    note("form-program.json", r);
    expect(r).toBeTruthy();
  });

  test("Add organization form", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/organizations/new");
    await page.waitForTimeout(1500);

    r.emptySubmit = await submitAndRead(page, /Create organization/);

    await page.locator("#name").fill("QA Test Org Validation");
    await page.locator("#code").fill("QAORG1");
    await page.locator("#contactEmail").fill("not-an-email");
    await page.locator("#contactPhone").fill("1");
    r.badEmailPhone = await submitAndRead(page, /Create organization/);

    r.consoleErrors = consoleErrors.slice(0, 8);
    r.failedRequests = failedRequests.slice(0, 8);
    note("form-org.json", r);
    expect(r).toBeTruthy();
  });

  test("Add assessment category + question forms", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/assessments/categories/new");
    await page.waitForTimeout(1500);
    r.categoryEmptySubmit = await submitAndRead(page, /Create category/);
    r.categoryInputsHaveLabels = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main input, main textarea")).map((i) => ({
        id: (i as HTMLInputElement).id,
        hasLabel: !!document.querySelector(`label[for='${(i as HTMLInputElement).id}']`),
      }))
    );

    // Question form for the first category
    await page.goto("/assessments");
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /^Questions$/ }).first().click();
    await page.waitForTimeout(2500);
    r.questionsUrl = page.url();
    r.questionsControls = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main button")).map((b) =>
        (b.textContent || b.getAttribute("title") || "").trim()
      ).filter(Boolean)
    );
    await page.screenshot({ path: path.join(OUT, "questions-list.png"), fullPage: true });

    const addQ = page.getByRole("button", { name: /New Question|Add question/i }).first();
    if (await addQ.count()) {
      await addQ.click();
      await page.waitForTimeout(2000);
      r.questionFormUrl = page.url();
      r.questionEmptySubmit = await submitAndRead(page, /Create question|Save/i);
      await page.screenshot({ path: path.join(OUT, "question-form.png"), fullPage: true });
    }

    r.consoleErrors = consoleErrors.slice(0, 8);
    r.failedRequests = failedRequests.slice(0, 8);
    note("form-assessment.json", r);
    expect(r).toBeTruthy();
  });
});
