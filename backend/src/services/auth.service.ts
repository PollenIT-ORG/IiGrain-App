import bcrypt from "bcryptjs";
import ApiError from "../utils/ApiError.js";
import { signToken } from "../utils/jwt.js";
import { generateOtp, otpExpiry } from "../utils/otp.js";
import { findEnrollmentId } from "../models/enrollmentId.model.js";
import {
  sendVerifyEmail,
  sendSignInCodeEmail,
  sendResetPasswordEmail,
  sendPasswordChangedEmail,
} from "./mailer.service.js";
import {
  findByEmail,
  findById,
  findRoleByName,
  createUser,
  markLoggedIn,
  updatePassword,
  type UserWithRole,
} from "../models/user.model.js";
import { createOtp, findActiveOtp, consumeOtp } from "../models/otp.model.js";
import { recordLogin } from "../models/loginLog.model.js";
import { getDefaultOrgId } from "./tenancy.service.js";
import {
  createRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
} from "../models/refreshToken.model.js";
import type { LoginMethod } from "../types/index.js";

const SALT_ROUNDS = 10;

interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

interface AuthResult {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    fullName: string | null;
    email: string;
    phone: string | null;
    role: string;
    avatar_url: string | null;
  };
}

async function buildAuthResult(user: UserWithRole): Promise<AuthResult> {
  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role_name,
  });
  const refreshToken = await createRefreshToken(user.id);

  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role_name,
      // Included so a client can render the avatar straight after sign-in
      // without a follow-up profile request.
      avatar_url: user.avatar_url,
    },
  };
}

interface RegisterParams {
  fullName?: string;
  email: string;
  phone?: string;
  password: string;
  /** From the acceptance email. Nobody registers without one. */
  enrollmentId: string;
}

/** Self-registration only ever creates a farmer. */
const SELF_REGISTER_ROLE = "farmer";

interface RegisterResult {
  email: string;
  verificationRequired: true;
  code?: string;
}

export interface EmailAvailability {
  email: string;
  exists: boolean;
  /** Whether registration can proceed with this email. */
  available: boolean;
}

// Mirrors what register() actually allows: a verified account blocks signup, but
// an existing UNVERIFIED account can still complete registration (it just gets a
// fresh verification code), so that email is still reported as available.
export async function checkEmailAvailability(
  rawEmail: string
): Promise<EmailAvailability> {
  const email = rawEmail.trim().toLowerCase();
  const existing = await findByEmail(email);
  if (!existing) return { email, exists: false, available: true };
  return {
    email,
    exists: true,
    available: !existing.is_email_verified,
  };
}

export async function register(
  params: RegisterParams
): Promise<RegisterResult> {
  const email = params.email.trim().toLowerCase();

  const existing = await findByEmail(email);
  if (existing) {
    if (!existing.is_email_verified) {
      const code = generateOtp();
      await createOtp(email, code, otpExpiry());
      await sendVerifyEmail({ to: email, fullName: existing.full_name, code });
      return { email, verificationRequired: true, code };
    }
    // Somebody coming back with the Enrollment ID for a second program does
    // not need another account, so say so plainly rather than "email taken".
    throw ApiError.conflict(
      "You are already registered. Please log in instead."
    );
  }

  // An Enrollment ID is what proves this person completed a survey and was
  // accepted. It has to exist, and it has to belong to the address they are
  // registering with, otherwise anyone could sign up with someone else's ID.
  const holder = await findEnrollmentId(params.enrollmentId);
  if (!holder) {
    throw ApiError.badRequest(
      "That Enrollment ID was not found. Please check the ID in your email."
    );
  }
  if (holder.email !== email) {
    throw ApiError.badRequest(
      "That Enrollment ID belongs to a different email address. Register with the address the ID was sent to."
    );
  }

  const role = await findRoleByName(SELF_REGISTER_ROLE);
  if (!role) {
    throw ApiError.badRequest(
      `The "${SELF_REGISTER_ROLE}" role is missing. Make sure roles are seeded (DB_SEED=true).`
    );
  }

  const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);

  const orgId = await getDefaultOrgId();

  await createUser({
    roleId: role.id,
    fullName: params.fullName ?? null,
    email,
    phone: params.phone ?? null,
    passwordHash,
    orgId,
  });

  const code = generateOtp();
  await createOtp(email, code, otpExpiry());
  await sendVerifyEmail({ to: email, fullName: params.fullName ?? null, code });

  return { email, verificationRequired: true, code };
}

export async function loginWithPassword(
  email: string,
  password: string,
  ctx: RequestContext
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findByEmail(normalizedEmail);

  const fail = async (reason: string): Promise<never> => {
    await recordLogin({
      userId: user?.id ?? null,
      email: normalizedEmail,
      method: "password",
      status: "failed",
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      reason,
    });
    throw ApiError.unauthorized("Invalid email or password.");
  };

  if (!user || !user.password_hash) {
    return fail(user ? "no_password_set" : "user_not_found");
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return fail("invalid_password");
  }

  const blocked = async (
    reason: string,
    message: string
  ): Promise<never> => {
    await recordLogin({
      userId: user.id,
      email: normalizedEmail,
      method: "password",
      status: "failed",
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      reason,
    });
    throw ApiError.forbidden(message);
  };

  if (!user.is_active) {
    return blocked(
      "account_inactive",
      "Your account is inactive. Please contact an administrator to reactivate it."
    );
  }

  if (!user.is_email_verified) {
    return blocked(
      "email_not_verified",
      "Your email is not verified yet. Request a verification code to continue."
    );
  }

  await markLoggedIn(user.id);
  await recordLogin({
    userId: user.id,
    email: normalizedEmail,
    method: "password",
    status: "success",
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    reason: null,
  });

  return buildAuthResult(user);
}

export async function requestOtp(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await findByEmail(normalizedEmail);
  if (!user) {
    throw ApiError.notFound("No account found with this email.");
  }
  if (!user.is_active) {
    throw ApiError.forbidden(
      "Your account is inactive. Please contact an administrator to reactivate it."
    );
  }

  const code = generateOtp();
  await createOtp(normalizedEmail, code, otpExpiry());
  await sendSignInCodeEmail(normalizedEmail, code);
  return code;
}

export async function verifyOtp(
  email: string,
  code: string,
  ctx: RequestContext
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const method: LoginMethod = "otp";

  const fail = async (
    reason: string,
    userId: string | null
  ): Promise<never> => {
    await recordLogin({
      userId,
      email: normalizedEmail,
      method,
      status: "failed",
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      reason,
    });
    throw ApiError.unauthorized("Invalid or expired code.");
  };

  const otp = await findActiveOtp(normalizedEmail);
  if (!otp || otp.code !== code) {
    return fail("invalid_or_expired_otp", null);
  }

  const user = await findByEmail(normalizedEmail);
  if (!user) {
    return fail("user_not_found", null);
  }
  if (!user.is_active) {
    await recordLogin({
      userId: user.id,
      email: normalizedEmail,
      method,
      status: "failed",
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      reason: "account_inactive",
    });
    throw ApiError.forbidden(
      "Your account is inactive. Please contact an administrator to reactivate it."
    );
  }

  await consumeOtp(otp.id);

  await markLoggedIn(user.id);
  await recordLogin({
    userId: user.id,
    email: normalizedEmail,
    method,
    status: "success",
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    reason: null,
  });

  return buildAuthResult(user);
}

export async function forgotPassword(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await findByEmail(normalizedEmail);
  if (!user) {
    throw ApiError.notFound("No account found with this email.");
  }
  if (!user.is_active) {
    throw ApiError.forbidden(
      "Your account is inactive. Please contact an administrator to reactivate it."
    );
  }

  const code = generateOtp();
  await createOtp(normalizedEmail, code, otpExpiry());
  await sendResetPasswordEmail(normalizedEmail, code);
  return code;
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  const otp = await findActiveOtp(normalizedEmail);
  if (!otp || otp.code !== code) {
    throw ApiError.unauthorized("Invalid or expired code.");
  }

  const user = await findByEmail(normalizedEmail);
  if (!user) {
    throw ApiError.notFound("No account found with this email.");
  }
  if (!user.is_active) {
    throw ApiError.forbidden(
      "Your account is inactive. Please contact an administrator to reactivate it."
    );
  }

  await consumeOtp(otp.id);
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updatePassword(user.id, passwordHash);

  void sendPasswordChangedEmail({ to: normalizedEmail, fullName: user.full_name });
}

// Checks a password-reset code WITHOUT consuming it, so the app can keep the user
// on the OTP screen when the code is wrong instead of advancing to the new
// password screen and only failing on submit. reset-password re-checks and
// consumes the same code when the new password is finally submitted.
export async function verifyResetCode(
  email: string,
  code: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  const otp = await findActiveOtp(normalizedEmail);
  if (!otp || otp.code !== code) {
    throw ApiError.unauthorized("Invalid or expired code.");
  }

  const user = await findByEmail(normalizedEmail);
  if (!user) {
    throw ApiError.notFound("No account found with this email.");
  }
  if (!user.is_active) {
    throw ApiError.forbidden(
      "Your account is inactive. Please contact an administrator to reactivate it."
    );
  }
  // Deliberately does not consume the OTP - reset-password will.
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ token: string }> {
  const stored = await findValidRefreshToken(refreshToken);
  if (!stored) {
    throw ApiError.unauthorized("Invalid or expired refresh token.");
  }

  const user = await findById(stored.user_id);
  if (!user || !user.is_active) {
    await revokeRefreshToken(refreshToken);
    throw ApiError.unauthorized(
      "Your session is no longer valid. Please sign in again."
    );
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role_name,
  });
  return { token };
}

export async function logout(refreshToken: string): Promise<void> {
  await revokeRefreshToken(refreshToken);
}
