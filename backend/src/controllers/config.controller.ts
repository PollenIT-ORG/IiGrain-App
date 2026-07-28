import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import env from "../config/env.js";
import { findDefaultOrgBranding } from "../models/organization.model.js";

export const getConfig = asyncHandler(async (_req, res) => {
  // Public branding so the logo/favicon can be applied app-wide, including on
  // the login screen before authentication, and by the marketing website.
  const org = await findDefaultOrgBranding();
  return ApiResponse.send(res, 200, "Config fetched.", {
    saasEnabled: env.saasEnabled,
    branding: {
      appName: org?.name ?? null,
      logoUrl: org?.logo_url ?? null,
      faviconUrl: org?.favicon_url ?? null,
    },
    // Shown on the website contact page. Null means the website falls back to
    // its built-in defaults.
    contact: {
      email: org?.contact_email ?? null,
      phone: org?.contact_phone ?? null,
      hours: org?.contact_hours ?? null,
      address: org?.address ?? null,
    },
  });
});
