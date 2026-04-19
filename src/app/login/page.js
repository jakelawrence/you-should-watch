"use client";

import React, { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown } from "lucide-react";
import Image from "next/image";

export default function LandingPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [loginMode, setLoginMode] = useState("login"); // "login" or "signup"
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
      const endpoint = loginMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        loginMode === "signup"
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
        setError(data.error || `${loginMode === "signup" ? "Sign up" : "Login"} failed`);
        setIsLoading(false);
        return;
      }

      // Get return URL from query params, default to profile
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo") || "/";
      router.push(returnTo);
      return;
    } catch (err) {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleContinueWithout = () => {
    router.push("/scenarios");
  };

  return (
    <div className="min-h-screen">
      {/* Desktop Layout - Side by Side */}
        <div className="hidden lg:flex min-h-screen">
          {/* Left Side - Brand */}
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

        {/* Right Side - Auth Form */}
        <div className="w-1/2 flex items-center justify-center p-12">
          <div
            className={`w-full max-w-md transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-20"}`}
            style={{ transitionDelay: "200ms" }}
          >
            {/* Toggle between Login/Signup */}
            <div className="flex gap-2 mb-8">
              <button
                onClick={() => {
                  setLoginMode("login");
                  setError("");
                }}
                className={`flex-1 px-6 py-4 font-black uppercase border-2 border-fadedBlack/25 transition-all duration-200 ${
                  loginMode === "login" ? "bg-fadedBlack text-background border-fadedBlack" : "bg-background text-fadedBlack hover:bg-backgroundSecondary"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setLoginMode("signup");
                  setError("");
                }}
                className={`flex-1 px-6 py-4 font-black uppercase border-2 border-fadedBlack/25 transition-all duration-200 ${
                  loginMode === "signup" ? "bg-fadedBlack text-background border-fadedBlack" : "bg-background text-fadedBlack hover:bg-backgroundSecondary"
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
              {error && (
                <div className="bg-fadedBlack/5 border border-fadedBlack/20 p-4">
                  <p className="text-fadedBlack font-black uppercase text-sm">{error}</p>
                </div>
              )}

              {loginMode === "signup" && (
                <div>
                  <label htmlFor={`${inputId}-username-desktop`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    id={`${inputId}-username-desktop`}
                    className="w-full p-4 text-lg font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors"
                    placeholder="whatsinthebox123"
                  />
                </div>
              )}

              <div>
                <label htmlFor={`${inputId}-email-desktop`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  id={`${inputId}-email-desktop`}
                  className="w-full p-4 text-lg font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor={`${inputId}-password-desktop`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={loginMode === "signup" ? 8 : undefined}
                  id={`${inputId}-password-desktop`}
                  className="w-full p-4 text-lg font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors"
                  placeholder={loginMode === "signup" ? "Enter a password" : "Your password"}
                />
              </div>

              {loginMode === "signup" && (
                <div>
                  <label htmlFor={`${inputId}-confirm-desktop`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    id={`${inputId}-confirm-desktop`}
                    className="w-full p-4 text-lg font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors"
                    placeholder="Re-enter password"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full border-2 border-fadedBlack bg-fadedBlack text-background px-8 py-4 text-lg font-black uppercase hover:bg-fadedBlue transition-all duration-200"
              >
                {isLoading ? (loginMode === "signup" ? "Creating Account..." : "Logging in...") : loginMode === "signup" ? "Sign Up" : "Log In"}
              </button>
            </form>

            <p className="text-center text-sm font-bold text-fadedBlack/60 mt-4">
              {loginMode === "signup"
                ? "Save your films and get picks built around your taste."
                : "Access your saved films and recommendations."}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Scrolling Sections */}
      <div className="lg:hidden">
        {/* Auth Form */}
        <div id="auth-section" className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <Image src="/images/eye-black-and-white.png" alt="Logo" width={50} height={50} className="mx-auto mb-12" />
            {/* Toggle between Login/Signup */}
            <div className="flex gap-2 mb-8">
              <button
                onClick={() => {
                  setLoginMode("login");
                  setError("");
                }}
                className={`flex-1 px-4 py-3 font-black uppercase text-sm border-2 border-fadedBlack/25 transition-all duration-200 ${
                  loginMode === "login" ? "bg-fadedBlack text-background border-fadedBlack" : "bg-background text-fadedBlack hover:bg-backgroundSecondary"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setLoginMode("signup");
                  setError("");
                }}
                className={`flex-1 px-4 py-3 font-black uppercase text-sm border-2 border-fadedBlack/25 transition-all duration-200 ${
                  loginMode === "signup" ? "bg-fadedBlack text-background border-fadedBlack" : "bg-background text-fadedBlack hover:bg-backgroundSecondary"
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
              {error && (
                <div className="bg-fadedBlack/5 border border-fadedBlack/20 p-4">
                  <p className="text-fadedBlack font-black uppercase text-sm">{error}</p>
                </div>
              )}

              {loginMode === "signup" && (
                <div>
                  <label htmlFor={`${inputId}-username-mobile`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    id={`${inputId}-username-mobile`}
                    className="w-full p-3 text-base font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors"
                    placeholder="Your username"
                  />
                </div>
              )}

              <div>
                <label htmlFor={`${inputId}-email-mobile`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  id={`${inputId}-email-mobile`}
                  className="w-full p-3 text-base font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor={`${inputId}-password-mobile`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={loginMode === "signup" ? 8 : undefined}
                  id={`${inputId}-password-mobile`}
                  className="w-full p-3 text-base font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors"
                  placeholder={loginMode === "signup" ? "Enter a password" : "Your password"}
                />
              </div>

              {loginMode === "signup" && (
                <div>
                  <label htmlFor={`${inputId}-confirm-mobile`} className="block text-fadedBlack font-black uppercase mb-2 text-sm">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    id={`${inputId}-confirm-mobile`}
                    className="w-full p-3 text-base font-bold border-2 border-fadedBlack/30 bg-background focus:outline-none focus:border-fadedBlack/70 transition-colors"
                    placeholder="Re-enter password"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-fadedBlack text-background px-8 py-4 text-lg font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue transition-all duration-200"
              >
                {isLoading ? (loginMode === "signup" ? "Creating Account..." : "Logging in...") : loginMode === "signup" ? "Sign Up" : "Log In"}
              </button>
            </form>

            <p className="text-center text-sm font-bold text-fadedBlack/60 mt-4">
              {loginMode === "signup"
                ? "Save your films and get picks built around your taste."
                : "Access your saved films and recommendations."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
