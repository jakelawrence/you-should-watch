"use client";

import { useEffect, useId, useState } from "react";
import {
  authErrorMessage,
  confirmEmail,
  emailSignIn,
  emailSignUp,
  finishPasswordReset,
  resendCode,
  startPasswordReset,
} from "../../lib/authClient";

const EMPTY = { name: "", email: "", password: "", confirmPassword: "", code: "" };

/**
 * Email/password sign-in and sign-up against Cognito, including email verification and password reset.
 *
 * `mode` is "login" or "signup" (owned by the parent so it can render its own toggle).
 * `onSignedIn` runs once the user has a session.
 */
export default function EmailAuthForm({ mode, size = "md", onSignedIn }) {
  const inputId = useId();
  const isLg = size === "lg";
  // credentials → (confirm) for sign-up/unverified; forgot → reset for password recovery.
  const [step, setStep] = useState("credentials");
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setStep("credentials");
    setError("");
    setNotice("");
  }, [mode]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const run = async (action) => {
    setError("");
    setNotice("");
    setIsLoading(true);
    try {
      await action();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const finish = async (result) => {
    if (result === "done") return onSignedIn?.();
    if (result === "confirm") {
      setStep("confirm");
      setNotice(`We sent a verification code to ${form.email}.`);
    } else if (result === "reset") {
      await startPasswordReset(form.email);
      setStep("reset");
      setNotice(`Your password needs resetting. We sent a code to ${form.email}.`);
    } else if (result === "signin") {
      setStep("credentials");
      setNotice("Email verified. Log in to continue.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (step === "credentials") {
      if (mode === "signup") {
        if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
        if (form.password.length < 8) return setError("Password must be at least 8 characters.");
        return run(async () => finish(await emailSignUp(form)));
      }
      return run(async () => finish(await emailSignIn(form.email, form.password)));
    }

    if (step === "confirm") {
      return run(async () => {
        const result = await confirmEmail(form.email, form.code);
        // If auto sign-in isn't available (e.g. verifying from the login form), sign in directly.
        if (result === "signin" && form.password) return finish(await emailSignIn(form.email, form.password));
        return finish(result);
      });
    }

    if (step === "forgot") {
      return run(async () => {
        await startPasswordReset(form.email);
        setStep("reset");
        setNotice(`If an account exists for ${form.email}, we sent it a reset code.`);
      });
    }

    if (step === "reset") {
      if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
      if (form.password.length < 8) return setError("Password must be at least 8 characters.");
      return run(async () => {
        await finishPasswordReset(form.email, form.code, form.password);
        finish(await emailSignIn(form.email, form.password));
      });
    }
  };

  const labelClass = "block font-dmSans text-[9px] uppercase tracking-[0.22em] text-fadedBlack/70 mb-2";
  const inputClass = `w-full font-dmSans text-fadedBlack placeholder-fadedBlack/65 border-2 border-fadedBlack/50 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors ${
    isLg ? "p-4 text-base" : "p-3 text-base"
  }`;
  const linkClass =
    "font-dmSans text-fadedBlack/70 text-sm underline underline-offset-4 decoration-fadedBlack/30 hover:text-fadedBlue hover:decoration-fadedBlue transition-colors";

  const field = (name, label, props) => (
    <div>
      <label htmlFor={`${inputId}-${name}`} className={labelClass}>
        {label}
      </label>
      <input id={`${inputId}-${name}`} value={form[name]} onChange={update(name)} className={inputClass} {...props} />
    </div>
  );

  const submitLabel = {
    credentials: mode === "signup" ? ["Sign Up", "Creating account…"] : ["Log In", "Logging in…"],
    confirm: ["Verify email", "Verifying…"],
    forgot: ["Send reset code", "Sending…"],
    reset: ["Set new password", "Saving…"],
  }[step];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-6" noValidate={false}>
      {error && (
        <div className="bg-danger/10 border border-danger/30 p-4" role="alert">
          <p className="font-dmSans text-danger text-sm">{error}</p>
        </div>
      )}
      {notice && !error && (
        <p className="font-dmSans text-sm text-fadedBlack/70" role="status">
          {notice}
        </p>
      )}

      {step === "credentials" && (
        <>
          {mode === "signup" && field("name", "Name", { type: "text", required: true, autoComplete: "name", placeholder: "Your name" })}
          {field("email", "Email", { type: "email", required: true, autoComplete: "email", placeholder: "your@email.com" })}
          {field("password", "Password", {
            type: "password",
            required: true,
            minLength: mode === "signup" ? 8 : undefined,
            autoComplete: mode === "signup" ? "new-password" : "current-password",
            placeholder: mode === "signup" ? "At least 8 characters" : "Your password",
          })}
          {mode === "signup" &&
            field("confirmPassword", "Confirm Password", { type: "password", required: true, autoComplete: "new-password", placeholder: "Re-enter password" })}
        </>
      )}

      {step === "confirm" &&
        field("code", "Verification code", { type: "text", required: true, inputMode: "numeric", autoComplete: "one-time-code", placeholder: "6-digit code" })}

      {step === "forgot" && field("email", "Email", { type: "email", required: true, autoComplete: "email", placeholder: "your@email.com" })}

      {step === "reset" && (
        <>
          {field("code", "Reset code", { type: "text", required: true, inputMode: "numeric", autoComplete: "one-time-code", placeholder: "6-digit code" })}
          {field("password", "New password", { type: "password", required: true, minLength: 8, autoComplete: "new-password", placeholder: "At least 8 characters" })}
          {field("confirmPassword", "Confirm new password", { type: "password", required: true, autoComplete: "new-password", placeholder: "Re-enter password" })}
        </>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className={`w-full border border-fadedBlack bg-fadedBlack text-background font-dmSans uppercase tracking-[0.12em] hover:bg-fadedBlue hover:border-fadedBlue transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
          isLg ? "px-8 py-4 text-[11px]" : "px-6 py-4 text-[10px]"
        }`}
      >
        {isLoading ? submitLabel[1] : submitLabel[0]}
      </button>

      <div className="flex justify-between gap-4">
        {step === "credentials" && mode === "login" && (
          <button type="button" className={linkClass} onClick={() => { setStep("forgot"); setError(""); setNotice(""); }}>
            Forgot password?
          </button>
        )}
        {step === "confirm" && (
          <button type="button" className={linkClass} onClick={() => run(async () => { await resendCode(form.email); setNotice(`New code sent to ${form.email}.`); })}>
            Resend code
          </button>
        )}
        {step !== "credentials" && (
          <button type="button" className={`${linkClass} ml-auto`} onClick={() => { setStep("credentials"); setError(""); setNotice(""); }}>
            Back
          </button>
        )}
      </div>
    </form>
  );
}
