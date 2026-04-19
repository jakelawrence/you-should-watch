"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const router = useRouter();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      // Validation
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
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        mode === "signup"
          ? {
              email: formData.email,
              password: formData.password,
              name: formData.name,
            }
          : {
              email: formData.email,
              password: formData.password,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || `${mode === "signup" ? "Sign up" : "Login"} failed`);
        setIsLoading(false);
        return;
      }

      // Success! Call the onSuccess callback
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-fadedBlack/5 border border-fadedBlack/20 p-4">
                <p className="text-fadedBlack font-black uppercase text-sm">{error}</p>
              </div>
            )}

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
                setFormData({
                  email: "",
                  password: "",
                  confirmPassword: "",
                  name: "",
                });
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
