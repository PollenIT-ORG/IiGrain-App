import { apiSlice } from "../api";
import type { ApiSuccess } from "../../types";

// Where the platform's email goes out from. Only admins reach this - whoever
// holds these credentials can send as the platform.

export type EmailProvider = "smtp" | "resend";

export interface EmailSettings {
  primaryProvider: EmailProvider;
  fallbackEnabled: boolean;
  fromName: string;
  fromEmail: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  /** Whether a password is stored, and its last few characters. Never the password. */
  smtpPassSet: boolean;
  smtpPassHint: string | null;
  resendEnabled: boolean;
  resendKeySet: boolean;
  resendKeyHint: string | null;
  usingEnvFallback: boolean;
  updatedAt: string | null;
}

export interface SaveEmailSettingsBody {
  primaryProvider: EmailProvider;
  fallbackEnabled: boolean;
  fromName: string;
  fromEmail: string;
  smtpEnabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  /** Left out keeps the stored password; "" clears it. */
  smtpPass?: string;
  resendEnabled: boolean;
  resendApiKey?: string;
}

export const emailSettingsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getEmailSettings: build.query<EmailSettings, void>({
      query: () => ({ url: "/email-settings", method: "GET" }),
      transformResponse: (res: ApiSuccess<{ emailSettings: EmailSettings }>) =>
        res.data.emailSettings,
      providesTags: ["EmailSettings"],
    }),

    saveEmailSettings: build.mutation<EmailSettings, SaveEmailSettingsBody>({
      query: (data) => ({ url: "/email-settings", method: "PUT", data }),
      transformResponse: (res: ApiSuccess<{ emailSettings: EmailSettings }>) =>
        res.data.emailSettings,
      invalidatesTags: ["EmailSettings"],
    }),

    // Sends one real message and reports what the provider answered.
    sendTestEmail: build.mutation<
      { provider: EmailProvider },
      { to: string; provider?: EmailProvider }
    >({
      query: (data) => ({ url: "/email-settings/test", method: "POST", data }),
      transformResponse: (res: ApiSuccess<{ provider: EmailProvider }>) =>
        res.data,
    }),
  }),
});

export const {
  useGetEmailSettingsQuery,
  useSaveEmailSettingsMutation,
  useSendTestEmailMutation,
} = emailSettingsApi;
