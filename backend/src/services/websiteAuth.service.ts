import bcrypt from "bcryptjs";
import ApiError from "../utils/ApiError.js";
import { signWebsiteToken } from "../utils/jwt.js";
import {
  createWebsiteUser,
  websiteEmailExists,
  findWebsiteUserByEmail,
  findWebsiteUserById,
  touchWebsiteLogin,
  type PublicWebsiteUser,
} from "../models/websiteUser.model.js";

const SALT_ROUNDS = 10;

export interface WebsiteSession {
  token: string;
  user: PublicWebsiteUser;
}

export async function registerWebsiteUser(input: {
  fullName: string;
  email: string;
  password: string;
  phone?: string | null;
}): Promise<WebsiteSession> {
  const email = input.email.trim().toLowerCase();

  if (await websiteEmailExists(email)) {
    throw ApiError.conflict(
      "An account with this email already exists. Please log in instead."
    );
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await createWebsiteUser({
    fullName: input.fullName.trim(),
    email,
    passwordHash,
    phone: input.phone?.trim() || null,
  });

  return { token: signWebsiteToken({ sub: user.id, email: user.email }), user };
}

export async function loginWebsiteUser(
  email: string,
  password: string
): Promise<WebsiteSession> {
  const account = await findWebsiteUserByEmail(email.trim().toLowerCase());
  // Same message either way so the form does not reveal which emails exist.
  const invalid = ApiError.unauthorized("Invalid email or password.");
  if (!account) throw invalid;

  const ok = await bcrypt.compare(password, account.password_hash);
  if (!ok) throw invalid;

  await touchWebsiteLogin(account.id);

  return {
    token: signWebsiteToken({ sub: account.id, email: account.email }),
    user: {
      id: account.id,
      full_name: account.full_name,
      email: account.email,
      phone: account.phone,
      is_email_verified: account.is_email_verified,
      created_at: account.created_at,
    },
  };
}

export async function getWebsiteUser(id: string): Promise<PublicWebsiteUser> {
  const user = await findWebsiteUserById(id);
  if (!user) throw ApiError.notFound("Account not found.");
  return user;
}
