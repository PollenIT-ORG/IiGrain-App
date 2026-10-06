// Builds the master Postman and Hoppscotch collections from the route files.
// Run from backend/:  npx tsx postman/build-collections.ts
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const ROUTES = resolve(here, "..", "src", "routes");
const VALIDATORS = resolve(here, "..", "src", "validators");
const POSTMAN_DIR = here;
const HOPPSCOTCH_DIR = resolve(here, "..", "hoppscotch");
const COLLECTION_NAME = "Farmer App - Master Collection";
const LOCAL_BASE_URL = "http://localhost:5000/api/v1";

type Method = "get" | "post" | "put" | "patch" | "delete";
type Part = "body" | "query" | "params";

interface Schema {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  anyOf?: Schema[];
  oneOf?: Schema[];
  format?: string;
  minLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  minItems?: number;
  description?: string;
}

interface Endpoint {
  method: Method;
  path: string;
  title: string;
  handler: string;
  access: string;
  isPublic: boolean;
  schemas: Partial<Record<Part, string>>;
  dynamicBody: boolean;
  upload: { field: string; multiple: boolean } | null;
  folder: string;
  group: string;
}

// ---------------------------------------------------------------------------
// Reading the route files
// ---------------------------------------------------------------------------

/** Reads from an opening parenthesis to its match. Strings are kept and comments are dropped. */
function readBalanced(src: string, open: number): { inner: string; end: number } {
  let depth = 0;
  let out = "";
  let i = open;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i = src.indexOf("*/", i + 2) + 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      out += c;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") {
          out += src[i];
          i++;
        }
        out += src[i];
        i++;
      }
      out += q;
      i++;
      continue;
    }
    if (c === "(") depth++;
    if (c === ")") {
      depth--;
      if (depth === 0) return { inner: out.slice(1), end: i + 1 };
    }
    out += c;
    i++;
  }
  throw new Error("Unbalanced parenthesis");
}

interface RawRoute {
  method: Method;
  path: string;
  args: string;
  pos: number;
}


function rawRoutes(src: string): { routes: RawRoute[]; guards: { pos: number; args: string }[] } {
  const routes: RawRoute[] = [];
  const guards: { pos: number; args: string }[] = [];
  const re = /\brouter\s*\.\s*(get|post|put|patch|delete|route|use)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const kind = m[1];
    const open = m.index + m[0].length - 1;
    const { inner, end } = readBalanced(src, open);
    if (kind === "use") {
      guards.push({ pos: m.index, args: inner });
      re.lastIndex = end;
      continue;
    }
    if (kind === "route") {
      const path = /^\s*["'`]([^"'`]*)["'`]/.exec(inner)?.[1] ?? "";
      let cursor = end;
      for (;;) {
        const rest = /^\s*\.\s*(get|post|put|patch|delete)\s*\(/.exec(src.slice(cursor));
        if (!rest) break;
        const o = cursor + rest[0].length - 1;
        const r = readBalanced(src, o);
        routes.push({ method: rest[1] as Method, path, args: r.inner, pos: m.index });
        cursor = r.end;
      }
      re.lastIndex = cursor;
      continue;
    }
    const path = /^\s*["'`]([^"'`]*)["'`]/.exec(inner)?.[1] ?? "";
    routes.push({ method: kind as Method, path, args: inner.replace(/^\s*["'`][^"'`]*["'`]\s*,?/, ""), pos: m.index });
    re.lastIndex = end;
  }
  return { routes, guards };
}

/** Top level `const name = ...;` statements, for guards kept in variables. */
function constantsOf(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^const\s+(\w+)\s*=\s*/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = re.lastIndex;
    let depth = 0;
    let text = "";
    while (i < src.length) {
      const c = src[i];
      if (c === "(" || c === "[" || c === "{") depth++;
      if (c === ")" || c === "]" || c === "}") depth--;
      if (c === ";" && depth === 0) break;
      text += c;
      i++;
    }
    out[m[1]] = text;
  }
  return out;
}

function rolesIn(text: string): string[] {
  const roles: string[] = [];
  const re = /authorize\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    for (const r of m[1].matchAll(/["'](\w+)["']/g)) roles.push(r[1]);
  }
  return roles;
}

function expand(text: string, consts: Record<string, string>): string {
  let out = text;
  for (const id of new Set(text.match(/\b[A-Za-z_]\w*\b/g) ?? [])) {
    if (consts[id]) out += "\n" + consts[id];
  }
  return out;
}

// Folder names that read better than the path.
const FOLDER_NAMES: Record<string, string> = {
  "/faqs": "FAQs",
  "/assessor": "Assessor Assessments",
  "/program-admin-surveys": "Program Survey (Admin)",
  "/program-admin-survey": "Program Survey (Public Link)",
};

// The route files and where each one is mounted.
function mounts(): { prefix: string; file: string }[] {
  const index = readFileSync(join(ROUTES, "index.ts"), "utf8");
  const files: Record<string, string> = {};
  for (const m of index.matchAll(/import\s+(\w+)\s+from\s+"\.\/([\w.]+)\.js"/g)) files[m[1]] = m[2] + ".ts";
  const out: { prefix: string; file: string }[] = [];
  for (const m of index.matchAll(/router\.use\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g)) {
    if (files[m[2]]) out.push({ prefix: m[1], file: files[m[2]] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

function sentence(camel: string): string {
  const words = camel.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function singular(word: string): string {
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("ses")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function camelOf(slug: string): string {
  return slug.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}

/** The variable a path parameter is written as: `:id` after `farms` is `{{farmId}}`. */
function variableFor(segments: string[], index: number): string {
  const name = segments[index].slice(1).replace(/\(.*\)$/, "");
  if (name !== "id") return name;
  const before = index > 0 && !segments[index - 1].startsWith(":") ? segments[index - 1] : "";
  return before ? camelOf(singular(before)) + "Id" : "id";
}

function pathWithVariables(path: string): { raw: string; vars: string[] } {
  const segments = path.split("/").filter(Boolean);
  const vars: string[] = [];
  const mapped = segments.map((s, i) => {
    if (!s.startsWith(":")) return s;
    const v = variableFor(segments, i);
    vars.push(v);
    return `{{${v}}}`;
  });
  return { raw: mapped.join("/"), vars };
}

// ---------------------------------------------------------------------------
// Examples from the validators
// ---------------------------------------------------------------------------

const validatorCache = new Map<string, Record<string, unknown>>();

async function validatorModule(file: string): Promise<Record<string, unknown>> {
  const cached = validatorCache.get(file);
  if (cached) return cached;
  const mod = (await import(pathToFileURL(join(VALIDATORS, file)).href)) as Record<string, unknown>;
  validatorCache.set(file, mod);
  return mod;
}

async function jsonSchemaOf(name: string, imports: Record<string, string>): Promise<Schema | null> {
  const file = imports[name];
  if (!file) return null;
  try {
    const mod = await validatorModule(file);
    const schema = mod[name];
    if (!schema || typeof schema !== "object") return null;
    return z.toJSONSchema(schema as z.ZodType, { unrepresentable: "any", io: "input" }) as Schema;
  } catch {
    return null;
  }
}

function nonNull(s: Schema): Schema {
  const options = s.anyOf ?? s.oneOf;
  if (!options) return s;
  return options.find((o) => o.type !== "null" && !(o.const === "")) ?? options[0];
}

function example(schema: Schema, key: string): unknown {
  const s = nonNull(schema);
  if (s.default !== undefined) return s.default;
  if (s.const !== undefined) return s.const;
  if (s.enum?.length) return s.enum[0];
  const type = Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type;
  if (type === "object" || s.properties) {
    const out: Record<string, unknown> = {};
    for (const name of s.required ?? []) {
      const child = s.properties?.[name];
      out[name] = child ? example(child, name) : "string";
    }
    return out;
  }
  if (type === "array") return s.items ? [example(s.items, /Ids$/.test(key) ? key.slice(0, -1) : key)] : [];
  if (type === "boolean") return true;
  if (type === "integer" || type === "number") {
    let n = s.minimum ?? (s.exclusiveMinimum !== undefined ? s.exclusiveMinimum + 1 : 1);
    if (/lat/i.test(key)) n = 41.5;
    if (/lng|lon/i.test(key)) n = -93.6;
    if (s.maximum !== undefined && n > s.maximum) n = s.maximum;
    return n;
  }
  const k = key.toLowerCase();
  if (s.format === "email" || k.includes("email")) return "user@example.com";
  if (s.format === "uuid" || /id$/.test(k)) return `{{${/id$/i.test(key) ? key : "id"}}}`;
  if (s.format === "date-time") return "2026-01-15T09:00:00.000Z";
  if (s.format === "date" || k.includes("date")) return "2026-01-15";
  if (k.includes("password")) return "Passw0rd!123";
  if (k.includes("phone")) return "+14155550123";
  if (k === "token" || k.endsWith("token")) return `{{${key}}}`;
  if (k.includes("url")) return "https://example.com/file.jpg";
  const min = s.minLength ?? 1;
  const base = k.includes("name") ? "Sample name" : "sample";
  return base.length >= min ? base : base.padEnd(min, "x");
}

function bodyText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function describeFields(schema: Schema | null): string {
  if (!schema?.properties) return "";
  const required = new Set(schema.required ?? []);
  const optional = Object.keys(schema.properties).filter((k) => !required.has(k));
  const parts: string[] = [];
  if (required.size) parts.push(`Required: ${[...required].join(", ")}.`);
  if (optional.length) parts.push(`Optional: ${optional.join(", ")}.`);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Build the endpoint list
// ---------------------------------------------------------------------------

interface Built {
  endpoint: Endpoint;
  body: unknown;
  bodySchema: Schema | null;
  query: { key: string; value: string; required: boolean }[];
  vars: string[];
}

async function collect(): Promise<Built[]> {
  const result: Built[] = [];
  for (const { prefix, file } of mounts()) {
    const src = readFileSync(join(ROUTES, file), "utf8");
    const consts = constantsOf(src);
    const { routes, guards } = rawRoutes(src);

    const imports: Record<string, string> = {};
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\.\/validators\/([\w.]+)\.js"/g)) {
      for (const name of m[1].split(",").map((n) => n.trim()).filter(Boolean)) imports[name.split(/\s+as\s+/)[0]] = m[2] + ".ts";
    }

    const folder = FOLDER_NAMES[prefix] ?? titleCase(prefix.replace(/^\//, "").replace(/\/.*$/, ""));
    for (const r of routes) {
      const text = expand(r.args, consts);
      const fileGuards = guards.filter((g) => g.pos < r.pos).map((g) => expand(g.args, consts)).join("\n");
      const all = `${text}\n${fileGuards}`;
      const isPublic = !/\bauthenticate\b/.test(all);
      const roles = [...new Set(rolesIn(all))];
      const access = isPublic ? "Public" : roles.length ? roles.join(", ") : "Any signed in user";

      const schemas: Partial<Record<Part, string>> = {};
      for (const v of r.args.matchAll(/\bvalidate\(\s*(\w+)\s*(?:,\s*"(params|query|body)")?\s*\)/g)) {
        schemas[(v[2] as Part | undefined) ?? "body"] = v[1];
      }
      const dynamicBody = /\bvalidateWith\(/.test(r.args);

      const up = /(\w*Upload)\.(single|array)\(\s*"(\w+)"/.exec(r.args);
      const full = ("/" + [prefix, r.path].join("/")).replace(/\/+/g, "/").replace(/\/$/, "") || "/";
      const handler = /(\w+)\s*,?\s*$/.exec(r.args.trim())?.[1] ?? "request";
      const first = full.split("/").filter(Boolean)[1] ?? "";
      const endpoint: Endpoint = {
        method: r.method,
        path: full,
        title: sentence(handler),
        handler,
        access,
        isPublic,
        schemas,
        dynamicBody,
        upload: up ? { field: up[3], multiple: up[2] === "array" } : null,
        folder,
        group: first && !first.startsWith(":") ? titleCase(first) : "General",
      };

      const bodySchema = schemas.body ? await jsonSchemaOf(schemas.body, imports) : null;
      const querySchema = schemas.query ? await jsonSchemaOf(schemas.query, imports) : null;
      const query = Object.entries(querySchema?.properties ?? {}).map(([key, s]) => ({
        key,
        value: String(example(s, key)),
        required: (querySchema?.required ?? []).includes(key),
      }));
      result.push({
        endpoint,
        body: bodySchema ? example(bodySchema, "body") : undefined,
        bodySchema,
        query,
        vars: pathWithVariables(full).vars,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Names that repeat inside one folder get their path added
// ---------------------------------------------------------------------------

function uniqueTitles(items: Built[]): void {
  const seen = new Map<string, number>();
  for (const b of items) {
    const key = `${b.endpoint.folder}|${b.endpoint.title}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const b of items) {
    const key = `${b.endpoint.folder}|${b.endpoint.title}`;
    if ((seen.get(key) ?? 0) > 1) b.endpoint.title = `${b.endpoint.title} (${b.endpoint.method.toUpperCase()} ${b.endpoint.path})`;
  }
}

// ---------------------------------------------------------------------------
// Special bodies for sign in
// ---------------------------------------------------------------------------

function overrideBody(b: Built): unknown {
  const p = b.endpoint.path;
  const m = b.endpoint.method;
  if (m === "post" && p === "/auth/login") return { email: "{{adminEmail}}", password: "{{adminPassword}}" };
  if (m === "post" && (p === "/auth/refresh" || p === "/auth/logout")) return { refreshToken: "{{refreshToken}}" };
  return b.body;
}

function description(b: Built): string {
  const e = b.endpoint;
  const lines = [`${e.method.toUpperCase()} {{baseUrl}}/${pathWithVariables(e.path).raw}`, `Who can call it: ${e.access}.`];
  const fields = describeFields(b.bodySchema);
  if (fields) lines.push(fields + " The example body holds the required fields only.");
  if (e.upload) lines.push(`Send as form-data. Attach ${e.upload.multiple ? "the files" : "the file"} in the field "${e.upload.field}".`);
  if (e.dynamicBody) lines.push("The body depends on the module in the path. Send the fields of that module.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Postman
// ---------------------------------------------------------------------------

const POSTMAN_TEST = [
  "// Saves the token and the ids in the response, so the next request can use them.",
  "try {",
  "  const json = pm.response.json();",
  "  const d = json && json.data;",
  "  if (d && typeof d === 'object') {",
  "    if (d.token) pm.environment.set('token', d.token);",
  "    if (d.refreshToken) pm.environment.set('refreshToken', d.refreshToken);",
  "    Object.keys(d).forEach(function (k) {",
  "      const v = d[k];",
  "      if (v && typeof v === 'object' && !Array.isArray(v) && v.id) pm.environment.set(k + 'Id', v.id);",
  "    });",
  "  }",
  "} catch (e) {}",
];

function postmanItem(b: Built) {
  const e = b.endpoint;
  const { raw } = pathWithVariables(e.path);
  const url: Record<string, unknown> = {
    raw: `{{baseUrl}}/${raw}`,
    host: ["{{baseUrl}}"],
    path: raw.split("/").filter(Boolean),
  };
  if (b.query.length) {
    const q = b.query.map((x) => ({ key: x.key, value: x.value, disabled: !x.required }));
    url.query = q;
    url.raw = `${url.raw}?${q.filter((x) => !x.disabled).map((x) => `${x.key}=${x.value}`).join("&")}`.replace(/\?$/, "");
  }
  const request: Record<string, unknown> = {
    method: e.method.toUpperCase(),
    header: [] as unknown[],
    url,
    description: description(b),
  };
  if (e.isPublic) request.auth = { type: "noauth" };

  if (e.upload) {
    request.body = {
      mode: "formdata",
      formdata: [{ key: e.upload.field, type: "file", src: [] }],
    };
  } else if (b.body !== undefined && e.method !== "get") {
    (request.header as unknown[]).push({ key: "Content-Type", value: "application/json" });
    request.body = {
      mode: "raw",
      raw: bodyText(overrideBody(b)),
      options: { raw: { language: "json" } },
    };
  } else if (e.dynamicBody) {
    (request.header as unknown[]).push({ key: "Content-Type", value: "application/json" });
    request.body = { mode: "raw", raw: "{}", options: { raw: { language: "json" } } };
  }
  return { name: e.title, request, response: [] as unknown[] };
}

function group<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const i of items) {
    const k = key(i);
    out.set(k, [...(out.get(k) ?? []), i]);
  }
  return out;
}

const COMMON_VARS = ["baseUrl", "token", "refreshToken", "adminEmail", "adminPassword"];

function variableNames(all: Built[]): string[] {
  const names = new Set<string>(COMMON_VARS);
  for (const b of all) for (const v of b.vars) names.add(v);
  for (const b of all) {
    const text = JSON.stringify(b.body ?? "") + JSON.stringify(b.query);
    for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) names.add(m[1]);
  }
  return [...names];
}

function envDefault(name: string): string {
  if (name === "baseUrl") return LOCAL_BASE_URL;
  if (name === "adminEmail") return "superadmin@farmerapp.com";
  if (name === "adminPassword") return "change_this_strong_password";
  return "";
}

function buildPostman(all: Built[]): void {
  const items = [...group(all, (b) => b.endpoint.folder)].map(([folder, list]) => {
    const groups = group(list, (b) => b.endpoint.group);
    if (list.length <= 12 || groups.size === 1) {
      return { name: folder, item: list.map(postmanItem) };
    }
    return {
      name: folder,
      item: [...groups].map(([name, rows]) => ({ name, item: rows.map(postmanItem) })),
    };
  });

  const collection = {
    info: {
      name: COLLECTION_NAME,
      description: `Every REST endpoint of the Farmer App API (${all.length} requests). Choose the Farmer App environment, run Auth, Login first, then call anything else. See postman/README.md.`,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{token}}", type: "string" }] },
    event: [{ listen: "test", script: { type: "text/javascript", exec: POSTMAN_TEST } }],
    variable: [{ key: "baseUrl", value: LOCAL_BASE_URL }],
    item: items,
  };
  writeFileSync(join(POSTMAN_DIR, "farmer-app.master.postman_collection.json"), JSON.stringify(collection, null, 2) + "\n");

  const environment = {
    id: "farmer-app-master-env",
    name: "Farmer App - Local",
    values: variableNames(all).map((key) => ({
      key,
      value: envDefault(key),
      type: key === "token" || key === "refreshToken" || key === "adminPassword" ? "secret" : "default",
      enabled: true,
    })),
    _postman_variable_scope: "environment",
  };
  writeFileSync(join(POSTMAN_DIR, "farmer-app.master.postman_environment.json"), JSON.stringify(environment, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Hoppscotch
// ---------------------------------------------------------------------------

const HOPP_TEST = [
  'pw.test("saves the token and the ids", () => {',
  "  const body = pw.response.body;",
  "  const d = body && body.data;",
  "  if (d && typeof d === 'object') {",
  "    if (d.token) pw.env.set('token', d.token);",
  "    if (d.refreshToken) pw.env.set('refreshToken', d.refreshToken);",
  "    Object.keys(d).forEach(function (k) {",
  "      const v = d[k];",
  "      if (v && typeof v === 'object' && !Array.isArray(v) && v.id) pw.env.set(k + 'Id', v.id);",
  "    });",
  "  }",
  "});",
].join("\n");

const hopp = (text: string): string => text.replace(/\{\{(\w+)\}\}/g, "<<$1>>");

function hoppRequest(b: Built) {
  const e = b.endpoint;
  const { raw } = pathWithVariables(e.path);
  let body: { contentType: string | null; body: unknown } = { contentType: null, body: null };
  if (e.upload) {
    body = { contentType: "multipart/form-data", body: [{ key: e.upload.field, value: [], active: true, isFile: true }] };
  } else if (b.body !== undefined && e.method !== "get") {
    body = { contentType: "application/json", body: hopp(bodyText(overrideBody(b))) };
  } else if (e.dynamicBody) {
    body = { contentType: "application/json", body: "{}" };
  }
  return {
    v: "1",
    name: e.title,
    method: e.method.toUpperCase(),
    endpoint: `<<baseUrl>>/${hopp(raw)}`,
    headers: [],
    params: b.query.map((q) => ({ key: q.key, value: hopp(q.value), active: q.required, description: "" })),
    body,
    auth: e.isPublic ? { authType: "none", authActive: true } : { authType: "bearer", authActive: true, token: "<<token>>" },
    preRequestScript: "",
    testScript: HOPP_TEST,
  };
}

interface HoppFolder {
  v: number;
  name: string;
  folders: HoppFolder[];
  requests: unknown[];
}

function buildHoppscotch(all: Built[]): void {
  const folders: HoppFolder[] = [...group(all, (b) => b.endpoint.folder)].map(([folder, list]) => {
    const groups = group(list, (b) => b.endpoint.group);
    if (list.length <= 12 || groups.size === 1) {
      return { v: 1, name: folder, folders: [], requests: list.map(hoppRequest) };
    }
    return {
      v: 1,
      name: folder,
      folders: [...groups].map(([name, rows]) => ({ v: 1, name, folders: [], requests: rows.map(hoppRequest) })),
      requests: [],
    };
  });
  const collection = { v: 1, name: COLLECTION_NAME, folders, requests: [] };
  writeFileSync(join(HOPPSCOTCH_DIR, "master-collection.json"), JSON.stringify(collection, null, 2) + "\n");

  const environment = {
    v: 1,
    name: "Farmer App (local)",
    variables: variableNames(all).map((key) => ({ key, value: envDefault(key), secret: false })),
  };
  writeFileSync(join(HOPPSCOTCH_DIR, "master-environment.json"), JSON.stringify(environment, null, 2) + "\n");
}

// ---------------------------------------------------------------------------

const built = await collect();
uniqueTitles(built);
buildPostman(built);
buildHoppscotch(built);

const perFolder = [...group(built, (b) => b.endpoint.folder)].map(([k, v]) => `${k}: ${v.length}`);
console.log(`${built.length} endpoints`);
console.log(perFolder.join("\n"));
const noSchema = built.filter((b) => b.endpoint.schemas.body && b.body === undefined).map((b) => `${b.endpoint.method} ${b.endpoint.path}`);
if (noSchema.length) console.log(`\nBody schema could not be read for:\n${noSchema.join("\n")}`);
