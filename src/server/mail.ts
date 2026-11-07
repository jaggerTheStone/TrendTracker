import { createTransport, type Transporter } from "nodemailer";
import { env, mailTransport } from "./env";

const globalForMail = globalThis as unknown as { __trendtrackerSmtp?: { key: string; transport: Transporter } };

/** One pooled transport per set of credentials, so editing .env.local takes effect. */
function smtp(): Transporter {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = env();
  const key = [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD].join("|");
  if (globalForMail.__trendtrackerSmtp?.key === key) return globalForMail.__trendtrackerSmtp.transport;
  const transport = createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    // Google shows app passwords in groups of four ("abcd efgh …"): the spaces are not part of it.
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD?.replace(/\s+/g, "") },
  });
  globalForMail.__trendtrackerSmtp = { key, transport };
  return transport;
}

/** MAIL_FROM may be a full address or just a display name sent from the SMTP account. */
function sender(): string {
  const { MAIL_FROM, SMTP_USER } = env();
  if (MAIL_FROM?.includes("@")) return MAIL_FROM;
  return `${MAIL_FROM || "TrendTracker"} <${SMTP_USER}>`;
}

/** Checks the SMTP login without sending anything. */
export async function verifySmtp(): Promise<void> {
  await smtp().verify();
}

function message(code: string) {
  return {
    subject: `${code} est ton code TrendTracker`,
    text: `Ton code de connexion TrendTracker : ${code}\n\nIl expire dans 10 minutes. Si tu n'as rien demandé, ignore cet e-mail.`,
    html: `<div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1f2328">
<p style="font-size:15px;margin:0 0 16px">Ton code de connexion TrendTracker :</p>
<p style="font-size:32px;font-weight:600;letter-spacing:8px;margin:0 0 16px;padding:14px 0;text-align:center;background:#f6f8fa;border:1px solid #d1d9e0;border-radius:8px">${code}</p>
<p style="font-size:13px;color:#59636e;margin:0">Il expire dans 10 minutes. Si tu n'as rien demandé, ignore cet e-mail.</p>
</div>`,
  };
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends an e-mail by SMTP or Resend. Returns false when no transport is configured
 * (development: the caller decides what to print instead).
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const transport = mailTransport();
  const { MAIL_FROM, RESEND_API_KEY } = env();

  if (transport === "smtp") {
    try {
      await smtp().sendMail({ from: sender(), ...mail });
    } catch (error) {
      console.error("[mail]", error);
      throw new Error("L'e-mail n'a pas pu être envoyé. Vérifie la configuration SMTP.");
    }
    return true;
  }

  if (transport === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM ?? "TrendTracker <onboarding@resend.dev>", ...mail }),
    });
    if (!res.ok) {
      console.error("[mail] Resend", res.status, await res.text().catch(() => ""));
      throw new Error("L'e-mail n'a pas pu être envoyé.");
    }
    return true;
  }

  if (process.env.NODE_ENV === "production") throw new Error("Envoi d'e-mails non configuré sur ce serveur.");
  return false;
}

/** Sends the sign-in code. In development without a transport, prints it in the console. */
export async function sendSignInCode(email: string, code: string): Promise<void> {
  if (!(await sendMail({ to: email, ...message(code) }))) {
    console.log(`\n[auth] Code de connexion pour ${email} : ${code} (aucun envoi : SMTP non configuré)\n`);
  }
}
