"use client";

import React, { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { credentialsSignIn } from "../actions/auth";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [loginMode, setLoginMode] = useState("login");
  const inputId = useId();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const getReturnUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("returnTo") || "/";
  };

  const handleGoogleSignIn = async () => {
    const returnTo = getReturnUrl();
    await signIn("google", { callbackUrl: returnTo });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (loginMode === "signup") {
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
      if (loginMode === "signup") {
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

      const result = await credentialsSignIn(formData.email, formData.password, getReturnUrl());

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      // On success the server action redirects — no router.push needed
    } catch (err) {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  // Reusable form block (used by both desktop and mobile)
  // Called as a function, not rendered as a component, to avoid React unmounting on re-render
  const renderAuthForm = (size = "md") => {
    const isLg = size === "lg";
    return (
      <>
        {/* Login / Sign Up toggle */}
        <div className="flex gap-2 mb-8">
          {["login", "signup"].map((m) => (
            <button
              key={m}
              onClick={() => { setLoginMode(m); setError(""); }}
              className={`flex-1 px-6 py-4 font-black uppercase border-2 border-fadedBlack/25 transition-all duration-200 ${isLg ? "text-base" : "text-sm"} ${
                loginMode === m
                  ? "bg-fadedBlack text-background border-fadedBlack"
                  : "bg-background text-fadedBlack hover:bg-backgroundSecondary"
              }`}
            >
              {m === "login" ? "Login" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleSignIn}
          className={`w-full border border-fadedBlack/25 bg-background flex items-center justify-center gap-3 font-bold text-fadedBlack hover:border-fadedBlack/60 transition-colors mb-6 ${isLg ? "px-4 py-4 text-base" : "px-4 py-3 text-sm"}`}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 border-t border-fadedBlack/15" />
          <span className="text-xs font-bold text-fadedBlack/40 uppercase tracking-widest">or</span>
          <div className="flex-1 border-t border-fadedBlack/15" />
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {error && (
            <div className="bg-fadedBlack/5 border border-fadedBlack/20 p-4">
              <p className="text-fadedBlack font-black uppercase text-sm">{error}</p>
            </div>
          )}

          {loginMode === "signup" && (
            <div>
              <label htmlFor={`${inputId}-name-${size}`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                id={`${inputId}-name-${size}`}
                className={`w-full font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors ${isLg ? "p-4 text-lg" : "p-3 text-base"}`}
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label htmlFor={`${inputId}-email-${size}`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              id={`${inputId}-email-${size}`}
              className={`w-full font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors ${isLg ? "p-4 text-lg" : "p-3 text-base"}`}
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor={`${inputId}-password-${size}`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={loginMode === "signup" ? 8 : undefined}
              id={`${inputId}-password-${size}`}
              className={`w-full font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors ${isLg ? "p-4 text-lg" : "p-3 text-base"}`}
              placeholder={loginMode === "signup" ? "At least 8 characters" : "Your password"}
            />
          </div>

          {loginMode === "signup" && (
            <div>
              <label htmlFor={`${inputId}-confirm-${size}`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                Confirm Password
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                id={`${inputId}-confirm-${size}`}
                className={`w-full font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors ${isLg ? "p-4 text-lg" : "p-3 text-base"}`}
                placeholder="Re-enter password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full border-2 border-fadedBlack bg-fadedBlack text-background font-black uppercase hover:bg-fadedBlue transition-all duration-200 disabled:opacity-50 ${isLg ? "px-8 py-4 text-lg" : "px-6 py-4 text-base"}`}
          >
            {isLoading
              ? loginMode === "signup" ? "Creating Account..." : "Logging in..."
              : loginMode === "signup" ? "Sign Up" : "Log In"}
          </button>
        </form>

        <p className="text-center text-sm font-bold text-fadedBlack/60">
          {loginMode === "signup"
            ? "Save your films and get picks built around your taste."
            : "Access your saved films and recommendations."}
        </p>
      </>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left — Brand */}
        <div className="w-1/2 bg-background flex items-center justify-center p-12 border-r border-fadedBlack/15">
          <div className={`text-center transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"}`}>
            <Image src="/images/eye-black-and-white.png" alt="Logo" width={100} height={100} className="mx-auto mb-4" />
            <h1 className="text-8xl xl:text-9xl font-black text-fadedBlack leading-none mb-4">you should</h1>
            <p className="text-8xl xl:text-9xl font-black text-fadedBlack leading-none mb-8">watch</p>
            <p className="text-2xl font-bold text-fadedBlack/70 max-w-lg mx-auto">
              Film recommendations built around your taste.
            </p>
          </div>
        </div>

        {/* Right — Auth */}
        <div className="w-1/2 flex items-center justify-center p-12">
          <div
            className={`w-full max-w-md transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-20"}`}
            style={{ transitionDelay: "200ms" }}
          >
            {renderAuthForm("lg")}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden">
        <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <Image src="/images/eye-black-and-white.png" alt="Logo" width={50} height={50} className="mx-auto mb-12" />
            {renderAuthForm("sm")}
          </div>
        </div>
      </div>
    </div>
  );
}
