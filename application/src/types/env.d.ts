// Keys declared here must exist in .env; values arrive as strings.
declare module '@env' {
  export const API_ENV: string;
  export const API_BASE_URL_DEVELOPMENT: string;
  export const API_BASE_URL_PRODUCTION: string;
  export const API_BASE_URL: string;
  export const API_PREFIX: string;
  export const API_TIMEOUT: string;
}
