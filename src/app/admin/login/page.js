// app/admin/login/page.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        setIsLoading(false);
        return;
      }

      // Redirect to admin dashboard
      router.push("/admin");
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
          <Lock className="mx-auto mb-6" size={48} strokeWidth={3} />
          <h1 className="text-5xl sm:text-6xl font-black text-black leading-none mb-2">admin</h1>
          <h2 className="text-5xl sm:text-6xl font-black text-black leading-none">login</h2>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-400 border-4 border-black p-4">
              <p className="text-black font-black uppercase">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-black font-black uppercase mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-black font-black uppercase mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
              placeholder="Enter your password"
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
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        <button onClick={() => router.push("/")} className="mt-8 text-black font-bold text-lg hover:underline w-full text-center">
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
