import { randomInt } from "node:crypto";
import env from "../config/env.js";

export function generateOtp(): string {
  const length = env.otp.length;
  let code = "";
  for (let i = 0; i < length; i++) {
    code += randomInt(0, 10).toString();
  }
  return code;
}

export function otpExpiry(): Date {
  return new Date(Date.now() + env.otp.expiryMinutes * 60 * 1000);
}
