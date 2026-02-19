"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, Settings, Film } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import Image from "next/image";

export default function Navbar({ isLoaded, currentPage }) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const dropdownRef = useRef(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Generate initials from email or name
  const getInitials = () => {
    if (!user) return "U";

    // If user has a name, use first letter of first and last name
    if (user.username) {
      return user.username[0].toUpperCase();
    }

    // Otherwise use first letter of email
    return user.email ? user.email[0].toUpperCase() : "U";
  };

  // Generate a color based on user email (consistent per user)
  const getAvatarColor = () => {
    if (!user?.email) return "hsl(0, 0%, 40%)";

    // Simple hash function to generate consistent color
    let hash = 0;
    for (let i = 0; i < user.email.length; i++) {
      hash = user.email.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  return (
    <nav className={`top-0 left-0 right-0 z-[100] bg-fadedBlack transition-all duration-500 ${isLoaded ? "opacity-100 " : "opacity-0"}`}>
      <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <button onClick={() => router.push("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image src="/images/eye-black-and-white.png" alt="Logo" width={32} height={32} className="" />
            <span className="font-black text-xl text-background hidden sm:block mb-1">you should watch</span>
          </button>
          <div className="hidden md:flex items-center gap-6 ml-8">
            <button
              onClick={() => router.push("/search")}
              className="text-sm font-bold text-background hover:opacity-60 hover:underline transition-opacity"
            >
              search
            </button>
            <button
              onClick={() => router.push("/scenario")}
              className="text-sm font-bold text-background hover:opacity-60 hover:underline transition-opacity"
            >
              scenario
            </button>
            <button
              onClick={() => router.push("/profile")}
              className={`text-sm font-bold text-background hover:opacity-60 hover:underline transition-opacity ${currentPage === "profile" ? "underline" : ""}`}
            >
              profile
            </button>
          </div>
          {/* Right side - Auth */}
          <div className="flex items-center gap-4">
            {/* Mobile hamburger - only visible on small screens */}
            <button
              onClick={() => setIsDrawerOpen((s) => !s)}
              className="md:hidden flex flex-col gap-1 p-2 items-center justify-center hover:cursor-pointer"
              aria-label="Open navigation"
            >
              <span className="block w-6 h-[2px] bg-background" />
              <span className="block w-6 h-[2px] bg-background" />
              <span className="block w-6 h-[2px] bg-background" />
            </button>
            {isAuthenticated ? (
              <div className="relative hidden md:block" ref={dropdownRef}>
                {/* Profile Button */}
                <button onClick={() => router.push("/profile")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-white font-black text-sm"
                    style={{ backgroundColor: getAvatarColor() }}
                  >
                    {getInitials()}
                  </div>

                  {/* User name/email on larger screens */}
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-black text-background">{user?.username || user?.email?.split("@")[0] || "User"}</p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => router.push("/login")}
                  className="px-6 py-2 font-bold text-background hover:opacity-60 hover:underline transition-opacity transition-all duration-200"
                >
                  sign in/up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Mobile Drawer + Backdrop (mounted always for smooth transitions) */}
      <div className={`md:hidden fixed inset-0 z-50 ${isDrawerOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        {/* Backdrop */}
        <div
          onClick={() => setIsDrawerOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isDrawerOpen ? "opacity-100" : "opacity-0"}`}
        />

        {/* Drawer */}
        <aside
          className={`absolute top-0 right-0 h-full w-4/5 bg-fadedBlack/95 p-6 z-50 transform transition-transform duration-300 pointer-events-auto ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}
          aria-hidden={!isDrawerOpen}
        >
          <div className="h-full flex flex-col">
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  router.push("/search");
                }}
                className="w-full text-left px-4 py-3 bg-background text-fadedBlack font-bold border-4 border-background"
              >
                search
              </button>
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  router.push("/scenario");
                }}
                className="w-full text-left px-4 py-3 bg-background text-fadedBlack font-bold border-4 border-background"
              >
                scenario
              </button>
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  router.push("/profile");
                }}
                className="w-full text-left px-4 py-3 bg-background text-fadedBlack font-bold border-4 border-background"
              >
                profile
              </button>
            </div>

            <div className="mt-auto">
              {!isAuthenticated ? (
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    router.push("/login");
                  }}
                  className="w-full text-left px-4 py-3 bg-background text-fadedBlack font-bold border-4 border-background"
                >
                  sign in/up
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-3 bg-red-500 text-white font-bold border-4 border-red-700"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </nav>
  );
}
