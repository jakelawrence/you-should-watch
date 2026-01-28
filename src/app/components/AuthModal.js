"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const router = useRouter();
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white border-4 border-black max-w-md w-full max-h-[90vh] overflow-y-auto relative">
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 transition-colors">
          <X size={24} strokeWidth={3} />
        </button>

        <div className="p-8">
          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-4xl sm:text-5xl font-black text-black leading-none mb-2">{mode === "signup" ? "create" : "welcome"}</h2>
            <h2 className="text-4xl sm:text-5xl font-black text-black leading-none mb-4">{mode === "signup" ? "account" : "back"}</h2>
            <p className="text-base font-bold text-black">
              {mode === "signup" ? "Sign up to save your streaming preferences" : "Log in to continue"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-400 border-4 border-black p-4">
                <p className="text-black font-black uppercase text-sm">{error}</p>
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-black font-black uppercase mb-2 text-sm">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full border-4 border-black p-3 text-base font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="block text-black font-black uppercase mb-2 text-sm">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full border-4 border-black p-3 text-base font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-black font-black uppercase mb-2 text-sm">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={mode === "signup" ? 8 : undefined}
                className="w-full border-4 border-black p-3 text-base font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              />
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-black font-black uppercase mb-2 text-sm">Confirm Password</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className="w-full border-4 border-black p-3 text-base font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                  placeholder="Re-enter password"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black text-white px-8 py-4 text-lg font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-50"
              style={{
                boxShadow: "6px 6px 0px 0px #000000",
              }}
            >
              {isLoading ? (mode === "signup" ? "Creating Account..." : "Logging in...") : mode === "signup" ? "Sign Up" : "Log In"}
            </button>
          </form>

          {/* Toggle between login/signup */}
          <div className="mt-6 text-center">
            <p className="text-black font-bold mb-2 text-sm">{mode === "signup" ? "Already have an account?" : "Don't have an account?"}</p>
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
              className="text-black font-black text-base hover:underline"
            >
              {mode === "signup" ? "Log In" : "Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
