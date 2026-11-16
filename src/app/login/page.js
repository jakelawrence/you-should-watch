"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import EmailAuthForm from "../components/auth/EmailAuthForm";
import { googleSignIn, safeReturnTo } from "../lib/authClient";
import { useAuth } from "../hooks/useAuth";

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
  const [error, setError] = useState("");
  const { refreshAuth } = useAuth();

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const getReturnUrl = () => safeReturnTo(new URLSearchParams(window.location.search).get("returnTo"));

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      await googleSignIn(getReturnUrl());
    } catch {
      setError("Couldn't start Google sign-in. Please try again.");
    }
  };

  const handleSignedIn = async () => {
    await refreshAuth();
    router.push(getReturnUrl());
    router.refresh();
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
              className={`flex-1 px-6 py-3.5 font-dmSans uppercase tracking-[0.12em] border transition-colors duration-200 ${isLg ? "text-[11px]" : "text-[10px]"} ${
                loginMode === m
                  ? "bg-fadedBlack text-background border-fadedBlack"
                  : "bg-background text-fadedBlack/70 border-fadedBlack/15 hover:bg-backgroundSecondary"
              }`}
            >
              {m === "login" ? "Login" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleSignIn}
          className={`w-full border border-fadedBlack/20 bg-background flex items-center justify-center gap-3 font-dmSans text-fadedBlack hover:border-fadedBlack/50 transition-colors mb-6 ${isLg ? "px-4 py-4 text-sm" : "px-4 py-3 text-sm"}`}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 border-t border-fadedBlack/10" />
          <span className="font-dmSans text-[9px] text-fadedBlack/70 uppercase tracking-[0.22em]">or</span>
          <div className="flex-1 border-t border-fadedBlack/10" />
        </div>

        {/* Email / password form */}
        {error && (
          <div className="bg-danger/10 border border-danger/30 p-4 mb-4" role="alert">
            <p className="font-dmSans text-danger text-sm">{error}</p>
          </div>
        )}
        <EmailAuthForm mode={loginMode} size={size} onSignedIn={handleSignedIn} />

        <p className="text-center font-dmSans text-sm text-fadedBlack/70 leading-relaxed">
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
          <div className={`text-center transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <Image src="/images/eye-black-and-white.png" alt="Logo" width={72} height={72} className="mx-auto mb-8" />
            <h1 className="font-dmSerifDisplay text-5xl xl:text-6xl text-fadedBlack leading-[0.95] mb-6">
              you should<br />watch
            </h1>
            <p className="font-dmSans text-base text-fadedBlack/70 max-w-sm mx-auto leading-relaxed">
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
