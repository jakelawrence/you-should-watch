"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import { X } from "lucide-react";
import { signIn } from "next-auth/react";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="16" height="18" viewBox="0 0 814 1000" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.7 0 248.7 0 123.7 0 55.5 23.4 0 66.1 0c40.7 0 66.8 29.2 98.3 29.2 64 0 94.7-29.2 169.1-29.2 40.7 0 130.3 30 174.4 111.2z"/>
    <path d="M549.7 0c17.6 0 67.2 19.8 99.5 57.8 27.6 32.9 54.7 90.2 54.7 147.5 0 3.9-.3 7.8-.6 11.8-31.2 9.2-107.6 62.2-107.6 182.2 0 3.5.1 7 .3 10.5-14.8-2.5-44.5-7.8-80.5-7.8-72 0-135.9 29-195.2 87.9V20.6C372.1 7.2 456.4 0 549.7 0z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
);

const oauthProviders = [
  { id: "google", label: "Continue with Google", Icon: GoogleIcon },
];

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const dialogRef = useRef(null);
  const inputId = useId();
  const [mode, setMode] = useState("signup"); // 'signup' or 'login'
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];

    first?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && focusable?.length) {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleOAuthSignIn = async (provider) => {
    setError("");
    await signIn(provider, { callbackUrl: "/" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (formData.password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === "signup") {
        // Create the account first
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.error || "Sign up failed");
          setIsLoading(false);
          return;
        }
      }

      // Sign in via NextAuth credentials
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setIsLoading(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" role="presentation">
      <div
        ref={dialogRef}
        className="bg-background border border-fadedBlack/15 max-w-md w-full max-h-[90vh] overflow-y-auto relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-background transition-colors" aria-label="Close dialog">
          <X size={24} strokeWidth={3} />
        </button>

        <div className="p-8">
          {/* Title */}
          <div className="text-center mb-8">
            <h2 id="auth-modal-title" className="text-4xl sm:text-5xl font-black text-fadedBlack leading-none mb-2">
              {mode === "signup" ? "create" : "welcome"}
            </h2>
            <h2 className="text-4xl sm:text-5xl font-black text-fadedBlack leading-none mb-4">{mode === "signup" ? "account" : "back"}</h2>
            <p className="text-base font-bold text-fadedBlack">
              {mode === "signup" ? "Sign up to save your streaming preferences" : "Log in to continue"}
            </p>
          </div>

          {error && (
            <div className="bg-fadedBlack/5 border border-fadedBlack/20 p-4 mb-4">
              <p className="text-fadedBlack font-black uppercase text-sm">{error}</p>
            </div>
          )}

          {/* OAuth providers */}
          <div className="space-y-2 mb-6">
            {oauthProviders.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => handleOAuthSignIn(id)}
                className="w-full border border-fadedBlack/25 bg-background px-4 py-3 text-sm font-bold text-fadedBlack flex items-center justify-center gap-3 hover:border-fadedBlack/60 transition-colors"
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 border-t border-fadedBlack/15" />
            <span className="text-xs font-bold text-fadedBlack/40 uppercase tracking-widest">or</span>
            <div className="flex-1 border-t border-fadedBlack/15" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor={`${inputId}-name`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  id={`${inputId}-name`}
                  className="w-full border-2 border-fadedBlack/30 bg-background p-3 text-base font-bold focus:outline-none focus:border-fadedBlack/70 transition-colors"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label htmlFor={`${inputId}-email`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                id={`${inputId}-email`}
                className="w-full border-2 border-fadedBlack/30 bg-background p-3 text-base font-bold focus:outline-none focus:border-fadedBlack/70 transition-colors"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor={`${inputId}-password`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={mode === "signup" ? 8 : undefined}
                id={`${inputId}-password`}
                className="w-full border-2 border-fadedBlack/30 bg-background p-3 text-base font-bold focus:outline-none focus:border-fadedBlack/70 transition-colors"
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              />
            </div>

            {mode === "signup" && (
              <div>
                <label htmlFor={`${inputId}-confirm`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  id={`${inputId}-confirm`}
                  className="w-full border-2 border-fadedBlack/30 bg-background p-3 text-base font-bold focus:outline-none focus:border-fadedBlack/70 transition-colors"
                  placeholder="Re-enter password"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-fadedBlack text-background px-8 py-4 text-lg font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:text-background transition-all duration-200 disabled:opacity-50"
              style={{
                boxShadow: "6px 6px 0px 0px rgba(31,27,23,0.2)",
              }}
            >
              {isLoading ? (mode === "signup" ? "Creating Account..." : "Logging in...") : mode === "signup" ? "Sign Up" : "Log In"}
            </button>
          </form>

          {/* Toggle between login/signup */}
          <div className="mt-6 text-center">
            <p className="text-fadedBlack font-bold mb-2 text-sm">{mode === "signup" ? "Already have an account?" : "Don't have an account?"}</p>
            <button
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setError("");
                setFormData({ email: "", password: "", confirmPassword: "", name: "" });
              }}
              className="text-fadedBlack font-black text-base hover:underline"
            >
              {mode === "signup" ? "Log In" : "Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
