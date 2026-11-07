"use client";

import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { Overview } from "@/lib/types";
import { GoogleMark } from "./glyphs";
import { Sheet } from "./sheet";

type Step = { kind: "start" } | { kind: "code"; email: string };

export function AuthSheet({
  open,
  onClose,
  onSignedIn,
  features,
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn: () => void;
  features: Overview["features"];
}) {
  const [step, setStep] = useState<Step>({ kind: "start" });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "mail" | "code" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    onClose();
    setTimeout(() => {
      setStep({ kind: "start" });
      setError(null);
      setBusy(null);
    }, 300);
  };

  const google = async () => {
    if (!features.google) {
      setError("Google n'est pas encore configuré sur ce serveur.");
      return;
    }
    setBusy("google");
    setError(null);
    const result = await authClient.signIn.popup({ provider: "google" });
    setBusy(null);
    if (result.error) {
      if (result.error.code !== "POPUP_CLOSED") setError("Connexion Google interrompue.");
      return;
    }
    onSignedIn();
  };

  const sendCode = async (address = email) => {
    setBusy("mail");
    setError(null);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email: address.trim(), type: "sign-in" });
    setBusy(null);
    if (err) {
      setError(err.message || "Envoi impossible.");
      return;
    }
    setStep({ kind: "code", email: address.trim() });
  };

  const verify = async (code: string) => {
    if (step.kind !== "code") return;
    setBusy("code");
    setError(null);
    const { error: err } = await authClient.signIn.emailOtp({ email: step.email, otp: code });
    setBusy(null);
    if (err) {
      setError("Code incorrect ou expiré.");
      return;
    }
    onSignedIn();
    setTimeout(() => setStep({ kind: "start" }), 300);
  };

  return (
    <Sheet open={open} onClose={close} title={step.kind === "start" ? "Connexion" : "Vérifie tes e-mails"}>
      <AnimatePresence mode="wait" initial={false}>
        {step.kind === "start" ? (
          <motion.div
            key="start"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-3"
          >
            <button type="button" onClick={google} disabled={busy !== null} className="btn h-10 w-full text-[15px]">
              {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark size={18} />}
              Continuer avec Google
            </button>

            <div className="my-1 flex items-center gap-3 text-[12.5px] text-faint">
              <span className="h-px flex-1 bg-line-muted" />
              ou par e-mail
              <span className="h-px flex-1 bg-line-muted" />
            </div>

            <form
              className="flex flex-col gap-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
            >
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="ton@email.com"
                aria-label="Adresse e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
              <button
                type="submit"
                disabled={busy !== null || !email.includes("@")}
                className="btn btn-primary h-10 w-full text-[15px]"
              >
                {busy === "mail" && <Loader2 className="size-4 animate-spin" />}
                Recevoir un code
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="code"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4"
          >
            <p className="text-[14px] text-muted">
              Code envoyé à <span className="font-semibold text-fg">{step.email}</span>
              {features.devMail && (
                <span className="mt-1 block text-[12.5px] text-attention">
                  Envoi d&apos;e-mails non configuré : le code est affiché dans le terminal du serveur.
                </span>
              )}
            </p>
            <CodeInput disabled={busy === "code"} onComplete={verify} />
            <div className="flex items-center justify-between text-[13.5px]">
              <button type="button" onClick={() => setStep({ kind: "start" })} className="text-accent hover:underline">
                Changer d&apos;adresse
              </button>
              <button
                type="button"
                onClick={() => void sendCode(step.email)}
                className="text-accent hover:underline"
                disabled={busy !== null}
              >
                Renvoyer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p
          className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[13.5px] text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </Sheet>
  );
}

/** One real input (so paste and e-mail autofill work) drawn as six boxes. */
function CodeInput({ onComplete, disabled }: { onComplete: (code: string) => void; disabled: boolean }) {
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(true);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <label className="relative grid grid-cols-6 gap-2" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={code}
        disabled={disabled}
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Code à 6 chiffres"
        maxLength={6}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, 6);
          setCode(next);
          if (next.length === 6) onComplete(next);
        }}
        className="absolute inset-0 z-10 w-full cursor-text opacity-0"
      />
      {Array.from({ length: 6 }, (_, i) => {
        const active = focused && (i === code.length || (i === 5 && code.length === 6));
        return (
          <span
            key={i}
            className={`grid h-12 min-w-0 place-items-center rounded-lg border bg-subtle text-[22px] font-semibold tabular-nums transition-colors ${
              active ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-line"
            } ${disabled ? "opacity-60" : ""}`}
          >
            {code[i] ?? (active ? <span className="h-5 w-px animate-pulse bg-fg" /> : "")}
          </span>
        );
      })}
    </label>
  );
}
