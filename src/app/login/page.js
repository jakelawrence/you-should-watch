"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown } from "lucide-react";
import Image from "next/image";

export default function LandingPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [loginMode, setLoginMode] = useState("login"); // "login" or "signup"
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
      console.log("Auth response data:", data);
      if (!response.ok) {
        setError(data.error || `${loginMode === "signup" ? "Sign up" : "Login"} failed`);
        setIsLoading(false);
        return;
      }

      // Get return URL from query params, default to profile
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo") || "/";
      console.log("Redirecting to:", returnTo);
      router.push(returnTo);
      return;
    } catch (err) {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleContinueWithout = () => {
    router.push("/scenario");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Layout - Side by Side */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left Side - Brand */}
        <div className="w-1/2 bg-fadedBlack flex items-center justify-center p-12">
          <div className={`text-center transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"}`}>
            <Image src="/images/eye-white.png" alt="Logo" width={100} height={100} className="mx-auto mb-4" />
            <h1 className="text-8xl xl:text-9xl font-black text-white leading-none mb-4">you should</h1>
            <h1 className="text-8xl xl:text-9xl font-black text-white leading-none mb-8">watch</h1>

            <p className="text-2xl font-bold text-white max-w-lg mx-auto">Discover your next favorite movie with personalized recommendations</p>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="w-1/2 bg-white flex items-center justify-center p-12">
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
                className={`flex-1 px-6 py-4 font-black uppercase border-4 border-fadedBlack transition-all duration-200 ${
                  loginMode === "login" ? "bg-fadedBlue text-white" : "bg-white text-fadedBlack hover:bg-gray-100"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setLoginMode("signup");
                  setError("");
                }}
                className={`flex-1 px-6 py-4 font-black uppercase border-4 border-fadedBlack transition-all duration-200 ${
                  loginMode === "signup" ? "bg-fadedBlue text-white" : "bg-white text-fadedBlack hover:bg-gray-100"
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
              {error && (
                <div className="bg-red-400 border-4 border-fadedBlack p-4">
                  <p className="text-fadedBlack font-black uppercase text-sm">{error}</p>
                </div>
              )}

              {loginMode === "signup" && (
                <div>
                  <label className="block text-fadedBlack font-black uppercase mb-2 text-sm">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    className="w-full border-4 border-fadedBlack p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                    placeholder="whatsinthebox123"
                  />
                </div>
              )}

              <div>
                <label className="block text-fadedBlack font-black uppercase mb-2 text-sm">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full border-4 border-fadedBlack p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-fadedBlack font-black uppercase mb-2 text-sm">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={loginMode === "signup" ? 8 : undefined}
                  className="w-full border-4 border-fadedBlack p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                  placeholder={loginMode === "signup" ? "At least 8 characters" : "Your password"}
                />
              </div>

              {loginMode === "signup" && (
                <div>
                  <label className="block text-fadedBlack font-black uppercase mb-2 text-sm">Confirm Password</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className="w-full border-4 border-fadedBlack p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                    placeholder="Re-enter password"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-fadedGreen text-fadedBlack px-8 py-4 text-xl font-black uppercase border-4 border-fadedBlack hover:bg-fadedBlack hover:text-white transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? (loginMode === "signup" ? "Creating Account..." : "Logging in...") : loginMode === "signup" ? "Sign Up" : "Log In"}
              </button>
            </form>

            {/* Continue Without Login */}
            {loginMode !== "signup" && (
              <button
                onClick={handleContinueWithout}
                className="w-full bg-fadedBlue text-white px-8 py-4 text-lg font-black uppercase border-4 border-fadedBlack hover:bg-white hover:text-fadedBlack transition-all duration-200"
              >
                Continue Without Account
              </button>
            )}
            <p className="text-center text-sm font-bold text-gray-600 mt-4">
              {loginMode === "signup"
                ? "Create an account to save preferences and get personalized recommendations"
                : "Log in to access your saved preferences and recommendations"}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Scrolling Sections */}
      <div className="lg:hidden">
        {/* Section 1: Brand Hero */}
        <div className="min-h-screen bg-fadedBlack flex flex-col items-center justify-center px-4 relative">
          <div className={`text-center transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <Image src="/images/eye-white.png" alt="Logo" width={100} height={100} className="mx-auto mb-4" />
            <h1 className="text-8xl sm:text-9xl font-black text-white leading-none transition-all duration-700" style={{ transitionDelay: "0ms" }}>
              you
            </h1>
            <h1 className="text-8xl sm:text-9xl font-black text-white leading-none transition-all duration-700" style={{ transitionDelay: "200ms" }}>
              should
            </h1>
            <h1
              className="text-8xl sm:text-9xl font-black text-white leading-none mb-8 transition-all duration-700"
              style={{ transitionDelay: "400ms" }}
            >
              watch
            </h1>

            <p className="text-xl font-bold text-white max-w-md mx-auto mb-12 transition-all duration-700" style={{ transitionDelay: "600ms" }}>
              Discover your next favorite movie with personalized recommendations
            </p>

            {/* Get Started Button */}
            {/* <button
              onClick={handleGetStarted}
              className={`group relative bg-transparent border-none p-0 cursor-pointer outline-offset-4 select-none touch-manipulation hover:brightness-110 transition-all duration-700 ${
                isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              style={{
                transitionDelay: "800ms",
              }}
            >
              <span className="absolute top-0 left-0 w-full h-full rounded-xl bg-fadedBlack/25 will-change-transform translate-y-[2px] transition-transform duration-[600ms] group-hover:translate-y-1 group-active:translate-y-[1px]"></span>
              <span className="absolute top-0 left-0 w-full h-full rounded-xl bg-gradient-to-l from-[hsl(340,100%,16%)] via-[hsl(340,100%,32%)] to-[hsl(340,100%,16%)]"></span>
              <span className="block relative px-12 py-6 rounded-xl text-2xl font-black uppercase text-white bg-[hsl(345,100%,47%)] will-change-transform -translate-y-1 transition-transform duration-[600ms] group-hover:-translate-y-[6px] group-active:-translate-y-[2px]">
                Get Started
              </span>
            </button> */}
          </div>

          {/* Scroll Indicator */}
          <div
            className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
            style={{ transitionDelay: "1000ms" }}
          >
            <div className="flex flex-col items-center gap-2 animate-bounce">
              <p className="text-white font-bold text-sm uppercase">Scroll Down</p>
              <ArrowDown className="text-white" size={24} strokeWidth={3} />
            </div>
          </div>
        </div>

        {/* Section 2: Auth Form */}
        <div id="auth-section" className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <Image src="/images/eye.png" alt="Logo" width={50} height={50} className="mx-auto mb-12" />
            {/* Toggle between Login/Signup */}
            <div className="flex gap-2 mb-8">
              <button
                onClick={() => {
                  setLoginMode("login");
                  setError("");
                }}
                className={`flex-1 px-4 py-3 font-black uppercase text-sm border-4 border-fadedBlack transition-all duration-200 ${
                  loginMode === "login" ? "bg-fadedBlue text-white" : "bg-white text-fadedBlack hover:bg-gray-100"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setLoginMode("signup");
                  setError("");
                }}
                className={`flex-1 px-4 py-3 font-black uppercase text-sm border-4 border-fadedBlack transition-all duration-200 ${
                  loginMode === "signup" ? "bg-fadedBlue text-white" : "bg-white text-fadedBlack hover:bg-gray-100"
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
              {error && (
                <div className="bg-red-400 border-4 border-fadedBlack p-4">
                  <p className="text-fadedBlack font-black uppercase text-sm">{error}</p>
                </div>
              )}

              {loginMode === "signup" && (
                <div>
                  <label className="block text-fadedBlack font-black uppercase mb-2 text-sm">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    className="w-full border-4 border-fadedBlack p-3 text-base font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                    placeholder="Your username"
                  />
                </div>
              )}

              <div>
                <label className="block text-fadedBlack font-black uppercase mb-2 text-sm">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full border-4 border-fadedBlack p-3 text-base font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-fadedBlack font-black uppercase mb-2 text-sm">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={loginMode === "signup" ? 8 : undefined}
                  className="w-full border-4 border-fadedBlack p-3 text-base font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                  placeholder={loginMode === "signup" ? "At least 8 characters" : "Your password"}
                />
              </div>

              {loginMode === "signup" && (
                <div>
                  <label className="block text-fadedBlack font-black uppercase mb-2 text-sm">Confirm Password</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className="w-full border-4 border-fadedBlack p-3 text-base font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                    placeholder="Re-enter password"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-fadedGreen text-fadedBlack px-8 py-4 text-lg font-black uppercase border-4 border-fadedBlack hover:bg-fadedBlack hover:text-white transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? (loginMode === "signup" ? "Creating Account..." : "Logging in...") : loginMode === "signup" ? "Sign Up" : "Log In"}
              </button>
            </form>

            {/* Continue Without Login */}
            {loginMode !== "signup" && (
              <button
                onClick={handleContinueWithout}
                className="w-full bg-fadedBlue text-white px-8 py-4 text-lg font-black uppercase border-4 border-fadedBlack hover:bg-white hover:text-fadedBlack transition-all duration-200"
              >
                Continue Without Account
              </button>
            )}
            <p className="text-center text-sm font-bold text-gray-600 mt-4">
              {loginMode === "signup"
                ? "Create an account to save preferences and get personalized recommendations"
                : "Log in to access your saved preferences and recommendations"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
