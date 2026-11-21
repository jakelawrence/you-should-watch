"use client";

import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import EmailAuthForm from "./auth/EmailAuthForm";
import { googleSignIn } from "../lib/authClient";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const oauthProviders = [
  { id: "google", label: "Continue with Google", Icon: GoogleIcon },
];

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const dialogRef = useRef(null);
  const [mode, setMode] = useState("signup"); // 'signup' or 'login'
  const [error, setError] = useState("");

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

  // Hooks above must run on every render, so the early return comes after them.
  if (!isOpen) return null;

  const handleOAuthSignIn = async () => {
    setError("");
    try {
      // Return to this page after Google sign-in.
      await googleSignIn(`${window.location.pathname}${window.location.search}`);
    } catch {
      setError("Couldn't start Google sign-in. Please try again.");
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
        <button onClick={onClose} className="absolute top-4 right-4 h-11 w-11 flex items-center justify-center hover:bg-background transition-colors" aria-label="Close dialog">
          <X size={20} strokeWidth={2} className="text-fadedBlack/50" />
        </button>

        <div className="p-8">
          {/* Title */}
          <div className="text-center mb-8">
            <h2 id="auth-modal-title" className="font-dmSerifDisplay text-4xl sm:text-5xl text-fadedBlack leading-[0.95] mb-4">
              {mode === "signup" ? "Create account" : "Welcome back"}
            </h2>
            <p className="font-dmSans text-sm text-fadedBlack/70 leading-relaxed">
              {mode === "signup" ? "Sign up to save your streaming preferences" : "Log in to continue"}
            </p>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 p-4 mb-4">
              <p className="font-dmSans text-danger text-sm">{error}</p>
            </div>
          )}

          {/* OAuth providers */}
          <div className="space-y-2 mb-6">
            {oauthProviders.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={handleOAuthSignIn}
                className="w-full border border-fadedBlack/20 bg-background px-4 py-3 text-sm font-dmSans text-fadedBlack flex items-center justify-center gap-3 hover:border-fadedBlack/50 transition-colors"
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 border-t border-fadedBlack/10" />
            <span className="font-dmSans text-[9px] text-fadedBlack/70 uppercase tracking-[0.22em]">or</span>
            <div className="flex-1 border-t border-fadedBlack/10" />
          </div>

          {/* Email / password form */}
          <EmailAuthForm mode={mode} size="md" onSignedIn={onSuccess} />

          {/* Toggle between login/signup */}
          <div className="mt-6 text-center">
            <p className="font-dmSans text-fadedBlack/70 mb-2 text-sm">{mode === "signup" ? "Already have an account?" : "Don't have an account?"}</p>
            <button
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setError("");
              }}
              className="font-dmSans text-fadedBlack text-sm uppercase tracking-[0.12em] border-b border-fadedBlack hover:text-fadedBlue hover:border-fadedBlue transition-colors pb-0.5"
            >
              {mode === "signup" ? "Log In" : "Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
