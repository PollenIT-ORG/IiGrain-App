import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const EMAIL = process.env.ADMIN_EMAIL ?? "superadmin@farmerapp.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "SuperSecret!123";
const API = process.env.API_URL ?? "http://localhost:5001/api/v1";

// A tiny valid 1x1 PNG.
const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d4944415478da6360f8cf000000ff00ff9f9f2c380000000049454e44ae426082",
  "hex"
);

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}

async function apiToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  return (await res.json()).data.token;
}

test("uploaded favicon shows instantly on refresh (no flash of default)", async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  const orgRes = await request.get(`${API}/organizations/current`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const orgId = (await orgRes.json()).data.organization.id;

  // upload a favicon so branding is set
  const up = await request.post(`${API}/organizations/${orgId}/favicon`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: { name: "f.png", mimeType: "image/png", buffer: TINY_PNG },
    },
  });
  const faviconUrl = (await up.json()).data.organization.favicon_url as string;
  expect(faviconUrl).toContain("cloudinary");

  try {
    // load the app once so the config is fetched and the branding is cached
    await login(page);
    await expect
      .poll(async () =>
        page.evaluate(() => localStorage.getItem("app_branding"))
      )
      .toContain("cloudinary");

    // reload - the cached favicon must be applied synchronously, so the icon
    // link already points at the custom favicon right after reload
    await page.reload();
    const href = await page
      .locator('link[rel="icon"]')
      .first()
      .getAttribute("href");
    expect(href).toBe(faviconUrl);
  } finally {
    // cleanup: remove the favicon
    await request.delete(`${API}/organizations/${orgId}/favicon`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});
