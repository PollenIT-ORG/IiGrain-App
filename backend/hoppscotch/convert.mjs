/**
 * Postman -> Hoppscotch collection converter.
 *
 * Reads the Postman collection and writes Hoppscotch-native collection files
 * (which import cleanly, unlike the Postman format which only makes an empty
 * "untitled folder"). Outputs:
 *   - hoppscotch/full-collection.json      (everything)
 *   - hoppscotch/<folder-slug>.json        (one file per top-level folder,
 *                                            so you can import just the new day)
 *
 * Run:  node hoppscotch/convert.mjs
 *
 * Variables: Postman {{var}} are converted to Hoppscotch <<var>>. Set baseUrl
 * and token in a Hoppscotch *environment* after importing.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTMAN = join(__dirname, "..", "postman", "farmer-app.postman_collection.json");
const OUT_DIR = __dirname;

// Use the original stable request schema ("1"). Newer versions (e.g. "17")
// can make Hoppscotch ignore the name on import (shows "Untitled").
const COLLECTION_V = 1;
const REQUEST_V = "1";

/** Convert Postman {{x}} placeholders to Hoppscotch <<x>>. */
function vars(str) {
  return (str ?? "").replace(/\{\{(\w+)\}\}/g, "<<$1>>");
}

/**
 * The Postman collection splits the base into {{baseUrl}}{{apiPrefix}}.
 * Collapse both into a single <<baseUrl>> so the Hoppscotch environment only
 * needs ONE variable (set baseUrl = https://api.farmer.tcqitsolution.com/api/v1).
 */
function collapseBase(endpoint) {
  return endpoint
    .replace("<<baseUrl>><<apiPrefix>>", "<<baseUrl>>")
    .replace("<<apiPrefix>>", "");
}

/** Build a Hoppscotch request from a Postman item.request. */
function toHoppRequest(item) {
  const r = item.request;
  const method = r.method ?? "GET";

  // URL: prefer raw; strip the query string (params live separately).
  const rawUrl = vars(typeof r.url === "string" ? r.url : r.url?.raw ?? "");
  const endpoint = collapseBase(rawUrl.split("?")[0]);

  // Params (from Postman url.query).
  const params = (r.url?.query ?? []).map((q) => ({
    key: q.key ?? "",
    value: vars(q.value ?? ""),
    active: !q.disabled,
    description: q.description ?? "",
  }));

  // Headers - drop the Bearer auth header (auth is handled separately).
  const headers = (r.header ?? [])
    .filter((h) => h.key?.toLowerCase() !== "authorization")
    .map((h) => ({
      key: h.key ?? "",
      value: vars(h.value ?? ""),
      active: !h.disabled,
      description: h.description ?? "",
    }));

  // Body.
  let body = { contentType: null, body: null };
  if (r.body?.mode === "raw" && r.body.raw) {
    body = { contentType: "application/json", body: vars(r.body.raw) };
  }

  // Auth - if any header was an Authorization: Bearer {{token}}, use bearer auth.
  const authHeader = (r.header ?? []).find(
    (h) => h.key?.toLowerCase() === "authorization"
  );
  let auth = { authType: "none", authActive: true };
  if (authHeader) {
    const token = vars((authHeader.value ?? "").replace(/^Bearer\s+/i, ""));
    auth = { authType: "bearer", authActive: true, token };
  }

  // Test script - convert Postman pm.* token-saving to Hoppscotch pw.*.
  let testScript = "";
  const ev = (item.event ?? []).find((e) => e.listen === "test");
  const exec = ev?.script?.exec?.join("\n") ?? "";
  if (/data\.token/.test(exec)) {
    testScript =
      'pw.test("save tokens", () => {\n' +
      "  const d = pw.response.body.data;\n" +
      "  if (d && d.token) pw.env.set('token', d.token);\n" +
      "  if (d && d.refreshToken) pw.env.set('refreshToken', d.refreshToken);\n" +
      "});";
  } else if (/user\.id/.test(exec)) {
    testScript =
      'pw.test("save userId", () => {\n' +
      "  const d = pw.response.body.data;\n" +
      "  if (d && d.user && d.user.id) pw.env.set('userId', d.user.id);\n" +
      "});";
  }

  return {
    v: REQUEST_V,
    name: item.name ?? "Request",
    method,
    endpoint,
    headers,
    params,
    body,
    auth,
    preRequestScript: "",
    testScript,
  };
}

/** Recursively convert a Postman folder item into a Hoppscotch folder. */
function toHoppFolder(item) {
  const folders = [];
  const requests = [];
  for (const child of item.item ?? []) {
    if (child.item) folders.push(toHoppFolder(child));
    else if (child.request) requests.push(toHoppRequest(child));
  }
  return {
    v: COLLECTION_V,
    name: item.name,
    folders,
    requests,
  };
}

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Run ──
const postman = JSON.parse(readFileSync(POSTMAN, "utf8"));
mkdirSync(OUT_DIR, { recursive: true });

const topFolders = (postman.item ?? []).filter((i) => i.item);

// 1. Full collection (everything).
const full = {
  v: COLLECTION_V,
  name: postman.info?.name ?? "Farmer App",
  folders: topFolders.map(toHoppFolder),
  requests: [],
};
writeFileSync(
  join(OUT_DIR, "full-collection.json"),
  JSON.stringify(full, null, 2)
);
console.log("full-collection.json");

// 2. One file per top-level folder (import just the new day's APIs).
for (const folder of topFolders) {
  const hopp = toHoppFolder(folder);
  // Wrap as a top-level collection so it imports as its own collection.
  const file = { ...hopp };
  const name = `${slug(folder.name)}.json`;
  writeFileSync(join(OUT_DIR, name), JSON.stringify(file, null, 2));
  console.log(`${name}`);
}

// 3. Environment file (import under Environments → Import).
const env = {
  v: 1,
  name: "Farmer App (local)",
  variables: [
    { key: "baseUrl", value: "https://api.farmer.tcqitsolution.com/api/v1", secret: false },
    { key: "token", value: "", secret: false },
    { key: "refreshToken", value: "", secret: false },
    { key: "userId", value: "", secret: false },
  ],
};
writeFileSync(
  join(OUT_DIR, "environment.json"),
  JSON.stringify(env, null, 2)
);
console.log("environment.json");

console.log("\nImport into Hoppscotch:");
console.log("  1. Environments → Import → environment.json (sets baseUrl etc.)");
console.log("  2. Collections → Import → Hoppscotch → pick the file you need.");
