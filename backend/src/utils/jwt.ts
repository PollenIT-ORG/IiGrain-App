import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import env from "../config/env.js";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwt.expiresIn as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwt.secret, options);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.jwt.secret) as JwtPayload & {
    kind?: string;
  };
  // A website token is signed with the same secret, so reject it here rather
  // than letting it through as an app user with an undefined role.
  if (decoded.kind === "website") {
    throw new Error("Not an app token.");
  }
  return decoded;
}

// Website accounts are a different audience from app users. The `kind` claim
// keeps the two apart, so a website token can never be used on an app route and
// the reverse.
export interface WebsiteJwtPayload {
  sub: string;
  email: string;
  kind: "website";
}

export function signWebsiteToken(payload: Omit<WebsiteJwtPayload, "kind">): string {
  const options: SignOptions = {
    expiresIn: env.jwt.expiresIn as SignOptions["expiresIn"],
  };
  return jwt.sign({ ...payload, kind: "website" }, env.jwt.secret, options);
}

export function verifyWebsiteToken(token: string): WebsiteJwtPayload {
  const decoded = jwt.verify(token, env.jwt.secret) as WebsiteJwtPayload;
  if (decoded.kind !== "website") {
    throw new Error("Not a website token.");
  }
  return decoded;
}
