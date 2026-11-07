import { z } from "zod";

const optional = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const schema = z.object({
  /** Postgres connection string (Neon, Supabase…). Unset → embedded PGlite on disk. */
  DATABASE_URL: optional,
  PGLITE_DIR: z.string().default(".data/pglite"),

  /** Any classic personal access token, no scope: 5,000 API calls/hour instead of 60, and live star counts. */
  GITHUB_TOKEN: optional,

  /** Signs sessions. Required in production. */
  BETTER_AUTH_SECRET: optional,
  /** Public URL of the app, e.g. https://trendtracker.example.com. */
  BETTER_AUTH_URL: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  /**
   * Sign-in codes by e-mail, through any SMTP server (Gmail with an app password, Brevo, OVH…)
   * or Resend. Without either, codes are printed in the server console (development only).
   */
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  RESEND_API_KEY: optional,
  /** Sender shown in the e-mail. Defaults to SMTP_USER. */
  MAIL_FROM: optional,

  /** Shared secret expected by POST /api/ingest. Optional in development only. */
  CRON_SECRET: optional,

  /** In-process scheduler for long-running servers (`next dev`, `next start`). 0 disables it. */
  INGEST_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(5),
  /** Star counts of the repositories on screen are refreshed this often (needs GITHUB_TOKEN). 0 disables it. */
  LIVE_INTERVAL_SECONDS: z.coerce.number().int().min(0).default(60),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  // In development `next dev` reloads .env.local without restarting: read it afresh each time.
  if (process.env.NODE_ENV !== "production") return schema.parse(process.env);
  cached ??= schema.parse(process.env);
  return cached;
}

export function googleEnabled(): boolean {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env();
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

export type MailTransport = "smtp" | "resend" | null;

export function mailTransport(): MailTransport {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, RESEND_API_KEY } = env();
  if (SMTP_HOST && SMTP_USER && SMTP_PASSWORD) return "smtp";
  if (RESEND_API_KEY) return "resend";
  return null;
}
