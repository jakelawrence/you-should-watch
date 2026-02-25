"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
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

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Sign up failed");
        setIsLoading(false);
        return;
      }

      // Redirect to streaming services page
      router.push("/streaming-service");
    } catch (err) {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
      <div className={`w-full max-w-md transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
        {/* Title */}
        <div className="text-center mb-12">
          <User className="mx-auto mb-6" size={48} strokeWidth={3} />
          <h1 className="text-5xl sm:text-6xl font-black text-black leading-none mb-2">create</h1>
          <h2 className="text-5xl sm:text-6xl font-black text-black leading-none">account</h2>
          <p className="text-lg font-bold text-black mt-4">Sign up to save your preferences</p>
        </div>

        {/* Sign Up Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-400 border-4 border-black p-4">
              <p className="text-black font-black uppercase text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-black font-black uppercase mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
              placeholder="beauisafraid123"
            />
          </div>

          <div>
            <label className="block text-black font-black uppercase mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
              placeholder="rickdalton1969@gmail.com"
            />
          </div>

          <div>
            <label className="block text-black font-black uppercase mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
              className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-black font-black uppercase mb-2">Confirm Password</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
              placeholder="Re-enter password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white px-8 py-6 text-xl font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-50"
            style={{
              boxShadow: "8px 8px 0px 0px #000000",
            }}
          >
            {isLoading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-8 text-center">
          <p className="text-black font-bold mb-2">Already have an account?</p>
          <button onClick={() => router.push("/login")} className="text-black font-black text-lg hover:underline">
            Log In
          </button>
        </div>

        <button onClick={() => router.push("/")} className="mt-8 text-black font-bold text-lg hover:underline w-full text-center">
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
