import type { NextFunction, Request, Response } from "express";
import env from "../config/env.js";
import { broadcastToAdmins, type ChangedResource } from "../services/realtime.service.js";

interface Rule {
  prefix: string;
  only?: RegExp;
  skip?: RegExp;
  resources: ChangedResource[];
}

// Where a successful write tells the panel to reload. Services also announce their own changes, and the two merge into one message.
const RULES: Rule[] = [
  { prefix: "users", resources: ["users", "assignments"] },
  { prefix: "profile", skip: /^\/profile\/change-password$/, resources: ["users"] },
  { prefix: "auth", only: /^\/auth\/(login|register|verify-otp)$/, resources: ["login_logs", "users"] },
  { prefix: "organizations", resources: ["organizations"] },
  { prefix: "email-settings", skip: /\/test$/, resources: ["email_settings"] },
  { prefix: "farms", resources: ["farms", "dashboard"] },
  { prefix: "fields", resources: ["fields", "farms", "dashboard"] },
  { prefix: "programs", resources: ["programs", "enrollments", "dashboard"] },
  { prefix: "assessor-assignments", resources: ["assignments", "enrollments"] },
  { prefix: "assessments", only: /^\/assessments\/(templates|categories|questions)(\/|$)/, resources: ["assessments"] },
  { prefix: "assessments", only: /^\/assessments\/reviews(\/|$)/, resources: ["submissions", "dashboard"] },
  // A position is pushed every few seconds, so it travels on its own socket event instead.
  { prefix: "visits", skip: /\/location$/, resources: ["visits"] },
  { prefix: "faqs", resources: ["faqs"] },
  { prefix: "contact-enquiries", resources: ["contact_enquiries"] },
  { prefix: "program-admin-surveys", resources: ["program_admin_survey"] },
  { prefix: "program-admin-survey", resources: ["program_admin_survey"] },
];

const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"]);

function resourcesFor(path: string): ChangedResource[] {
  const first = path.split("/").filter(Boolean)[0];
  const out = new Set<ChangedResource>();
  for (const rule of RULES) {
    if (rule.prefix !== first) continue;
    if (rule.only && !rule.only.test(path)) continue;
    if (rule.skip?.test(path)) continue;
    for (const r of rule.resources) out.add(r);
  }
  return [...out];
}

/** After any successful write, tells the admin panels that the data behind these lists changed. */
export function broadcastLiveChanges(req: Request, res: Response, next: NextFunction): void {
  if (READ_ONLY.has(req.method)) {
    next();
    return;
  }
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    const url = req.originalUrl.split("?")[0];
    const path = env.apiPrefix && url.startsWith(env.apiPrefix) ? url.slice(env.apiPrefix.length) : url;
    for (const resource of resourcesFor(path)) broadcastToAdmins(resource);
  });
  next();
}
