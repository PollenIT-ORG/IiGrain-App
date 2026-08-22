import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as settings from "../services/emailSettings.service.js";
import { deliver } from "../services/mailer.service.js";
import { testEmailContent } from "../services/emailTemplates.js";
import type {
  UpdateEmailSettingsBody,
  TestEmailBody,
} from "../validators/emailSettings.schema.js";

export const getEmailSettings = asyncHandler(async (_req, res) => {
  const emailSettings = await settings.getPublicEmailSettings();
  return ApiResponse.send(res, 200, "Email settings fetched.", { emailSettings });
});

export const updateEmailSettings = asyncHandler(async (req, res) => {
  const body = req.body as UpdateEmailSettingsBody;
  const emailSettings = await settings.saveEmailSettings(body, req.user!.sub);
  return ApiResponse.send(res, 200, "Email settings saved.", { emailSettings });
});

/**
 * Sends one real message, and says exactly what the provider answered.
 *
 * Credentials that log in fine can still refuse to send - an exhausted
 * allowance, an unverified sender - so the only honest check is to send one.
 */
export const sendTestEmail = asyncHandler(async (req, res) => {
  const { to, provider } = req.body as TestEmailBody;
  const result = await deliver({
    to,
    ...testEmailContent(provider),
    // Proving one provider means that one only, with no quiet fallback.
    ...(provider ? { only: provider } : {}),
  });
  if (!result.sent) {
    throw ApiError.badRequest(
      result.error || "The message could not be sent."
    );
  }
  return ApiResponse.send(res, 200, `Test email sent to ${to}.`, {
    provider: result.provider,
  });
});
