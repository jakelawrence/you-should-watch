"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import Image from "next/image";

export function Navbar({ isLoaded, currentPage }) {
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

  // Generate a consistent avatar color from design tokens based on user email
  const AVATAR_COLORS = ["#4f6f8a", "#5b7c66", "#b25b5b", "#d7c7a3", "#1f1b17"];
  const avatarColor = useMemo(() => {
    if (!user?.email) return "#1f1b17";
    let hash = 0;
    for (let i = 0; i < user.email.length; i++) {
      hash = user.email.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }, [user?.email]);

  return (
    <>
      <nav
        className={`top-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur border-b border-fadedBlack/15 transition-all duration-500 ${
          isLoaded ? "opacity-100 " : "opacity-0"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Brand */}
            <button onClick={() => router.push("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Image src="/images/eye-black-and-white.png" alt="Logo" width={32} height={32} className="" />
              <span className="font-black text-xl text-fadedBlack hidden sm:block mb-1">you should watch</span>
            </button>
            <div className="hidden md:flex items-center gap-6 ml-8">
              <button
                onClick={() => router.push("/search")}
                className="text-sm font-bold text-fadedBlack hover:opacity-60 hover:underline transition-opacity"
              >
                search
              </button>
              <button
                onClick={() => router.push("/scenarios")}
                className="text-sm font-bold text-fadedBlack hover:opacity-60 hover:underline transition-opacity"
              >
                scenarios
              </button>
              <button
                onClick={() => router.push("/profile")}
                className={`text-sm font-bold text-fadedBlack hover:opacity-60 hover:underline transition-opacity ${
                  currentPage === "profile" ? "underline" : ""
                }`}
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
                <span className="block w-6 h-[2px] bg-fadedBlack" />
                <span className="block w-6 h-[2px] bg-fadedBlack" />
                <span className="block w-6 h-[2px] bg-fadedBlack" />
              </button>
              {isAuthenticated ? (
                <div className="relative hidden md:block" ref={dropdownRef}>
                  {/* Profile Button */}
                  <button onClick={() => router.push("/profile")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full border-2 border-fadedBlack flex items-center justify-center text-background font-black text-sm"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {getInitials()}
                    </div>

                    {/* User name/email on larger screens */}
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-black text-fadedBlack">{user?.username || user?.email?.split("@")[0] || "User"}</p>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <button
                    onClick={() => router.push("/login")}
                    className="px-6 py-2 font-bold text-fadedBlack hover:opacity-60 hover:underline transition-opacity transition-all duration-200"
                  >
                    sign in/up
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      {/* Mobile Drawer + Backdrop (mounted always for smooth transitions) */}
      <div className={`md:hidden fixed inset-0 z-[200] ${isDrawerOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        {/* Backdrop */}
        <div
          onClick={() => setIsDrawerOpen(false)}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${isDrawerOpen ? "opacity-100" : "opacity-0"}`}
        />

        {/* Drawer */}
        <aside
          className={`absolute top-0 right-0 h-full w-4/5 bg-background p-6 z-[201] shadow-2xl border-l border-fadedBlack/15 transform transition-transform duration-300 pointer-events-auto ${
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
          aria-hidden={!isDrawerOpen}
        >
          <div className="h-full flex flex-col overflow-y-auto">
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  router.push("/search");
                }}
                className="w-full text-left px-4 py-3 bg-background text-fadedBlack font-bold border border-fadedBlack/15 hover:bg-backgroundSecondary transition-colors"
              >
                search
              </button>
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  router.push("/scenarios");
                }}
                className="w-full text-left px-4 py-3 bg-background text-fadedBlack font-bold border border-fadedBlack/15 hover:bg-backgroundSecondary transition-colors"
              >
                scenarios
              </button>
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  router.push("/profile");
                }}
                className="w-full text-left px-4 py-3 bg-background text-fadedBlack font-bold border border-fadedBlack/15 hover:bg-backgroundSecondary transition-colors"
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
                  className="w-full text-left px-4 py-3 bg-background text-fadedBlack font-bold border border-fadedBlack/15 hover:bg-backgroundSecondary transition-colors"
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
                    className="w-full text-left px-4 py-3 bg-danger text-background font-bold border border-danger hover:opacity-90 transition-opacity"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
