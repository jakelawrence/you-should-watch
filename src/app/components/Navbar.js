"use client";

import React, { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import Image from "next/image";

export function Navbar({ isLoaded, currentPage }) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const dropdownRef = useRef(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const getInitials = () => {
    if (!user) return "U";
    if (user.username) return user.username[0].toUpperCase();
    return user.email ? user.email[0].toUpperCase() : "U";
  };

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
        className={`sticky top-0 left-0 right-0 z-[100] bg-background/90 backdrop-blur-md border-b border-fadedBlack/10 transition-all duration-500 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="max-w-screen-2xl mx-auto px-6 sm:px-12 lg:px-20">
          <div className="flex items-center justify-between h-14">
            {/* Brand */}
            <button onClick={() => router.push("/")} className="flex items-center gap-2.5 hover:opacity-60 transition-opacity">
              <Image src="/images/eye-black-and-white.png" alt="Logo" width={24} height={24} />
              <span className="font-dmSerifDisplay font-extrabold text-lg text-fadedBlack">you should watch</span>
            </button>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => router.push("/search")}
                className="font-dmSans font-normal text-sm tracking-wide text-fadedBlack hover:opacity-40 transition-opacity cursor-pointer"
              >
                search
              </button>
              <button
                onClick={() => router.push("/scenarios")}
                className="font-dmSans font-normal text-sm tracking-wide text-fadedBlack hover:opacity-40 transition-opacity cursor-pointer"
              >
                scenarios
              </button>
              <button
                onClick={() => router.push("/profile")}
                className={`font-dmSans font-normal text-sm tracking-wide text-fadedBlack hover:opacity-40 transition-opacity cursor-pointer ${
                  currentPage === "profile" ? "opacity-40" : ""
                }`}
              >
                profile
              </button>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Mobile hamburger */}
              <button
                onClick={() => setIsDrawerOpen((s) => !s)}
                className="md:hidden flex flex-col gap-[5px] p-2 items-center justify-center cursor-pointer"
                aria-label="Open navigation"
              >
                <span className="block w-5 h-px bg-fadedBlack" />
                <span className="block w-5 h-px bg-fadedBlack" />
                <span className="block w-5 h-px bg-fadedBlack" />
              </button>

              {isAuthenticated ? (
                <div className="relative hidden md:block" ref={dropdownRef}>
                  <button onClick={() => router.push("/profile")} className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
                    <div
                      className="w-8 h-8 rounded-full border border-fadedBlack/25 flex items-center justify-center text-background font-black text-xs"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {getInitials()}
                    </div>
                    <p className="font-dmSans font-normal text-sm text-fadedBlack hidden lg:block">
                      {user?.username || user?.email?.split("@")[0] || "User"}
                    </p>
                  </button>
                </div>
              ) : (
                <div className="hidden md:flex items-center">
                  <button
                    onClick={() => router.push("/login")}
                    className="font-dmSans font-normal text-sm tracking-wide text-fadedBlack hover:opacity-40 transition-opacity"
                  >
                    sign in
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer + Backdrop */}
      <div className={`md:hidden fixed inset-0 z-[200] ${isDrawerOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        {/* Backdrop */}
        <div
          onClick={() => setIsDrawerOpen(false)}
          className={`absolute inset-0 bg-fadedBlack/30 transition-opacity duration-300 ${isDrawerOpen ? "opacity-100" : "opacity-0"}`}
        />

        {/* Drawer */}
        <aside
          className={`absolute top-0 right-0 h-full w-64 bg-background px-8 py-10 z-[201] border-l border-fadedBlack/10 transform transition-transform duration-300 pointer-events-auto ${
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
          aria-hidden={!isDrawerOpen}
        >
          <div className="h-full flex flex-col">
            <div className="flex flex-col gap-7">
              {["search", "scenarios", "profile"].map((page) => (
                <button
                  key={page}
                  onClick={() => {
                    setIsDrawerOpen(false);
                    router.push(`/${page}`);
                  }}
                  className="text-left font-dmSans font-normal text-sm tracking-widest uppercase text-fadedBlack hover:opacity-40 transition-opacity"
                >
                  {page}
                </button>
              ))}
            </div>

            <div className="mt-auto">
              {!isAuthenticated ? (
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    router.push("/login");
                  }}
                  className="font-dmSans text-sm tracking-widest uppercase text-fadedBlack hover:opacity-40 transition-opacity"
                >
                  sign in
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    logout();
                  }}
                  className="font-dmSans text-sm tracking-widest uppercase text-danger hover:opacity-70 transition-opacity"
                >
                  sign out
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
