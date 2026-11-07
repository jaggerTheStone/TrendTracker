import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { bearer, emailOTP, oauthPopup } from "better-auth/plugins";
import { headers } from "next/headers";
import { getDb, type Db } from "./db/client";
import { account, session, user, verification } from "./db/schema";
import { env, googleEnabled } from "./env";
import { sendSignInCode } from "./mail";

const DEV_SECRET = "trendtracker-development-secret-change-me-in-production";

function createAuth(db: Db) {
  const { BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env();
  if (!BETTER_AUTH_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET est requis en production.");
  }
  return betterAuth({
    appName: "TrendTracker",
    secret: BETTER_AUTH_SECRET ?? DEV_SECRET,
    baseURL: BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
    socialProviders: googleEnabled()
      ? { google: { clientId: GOOGLE_CLIENT_ID!, clientSecret: GOOGLE_CLIENT_SECRET!, prompt: "select_account" } }
      : {},
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    telemetry: { enabled: false },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        async sendVerificationOTP({ email, otp }) {
          await sendSignInCode(email, otp);
        },
      }),
      oauthPopup(),
      bearer(),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __trendtrackerAuth?: Promise<Auth> };

/** The auth instance needs the database, which PGlite opens asynchronously. */
export function getAuth(): Promise<Auth> {
  globalForAuth.__trendtrackerAuth ??= getDb().then(createAuth);
  return globalForAuth.__trendtrackerAuth;
}

/** The signed-in user for this request, or null. */
export async function currentUser(requestHeaders?: Headers) {
  const auth = await getAuth();
  const result = await auth.api.getSession({ headers: requestHeaders ?? (await headers()) });
  return result?.user ?? null;
}
