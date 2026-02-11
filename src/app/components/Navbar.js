"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, Settings, Film } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import Image from "next/image";

export default function Navbar({ isLoaded }) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const dropdownRef = useRef(null);

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
    <nav className={`fixed top-0 left-0 right-0 z-[100] bg-fadedBlack transition-all duration-500 ${isLoaded ? "opacity-100 " : "opacity-0"}`}>
      <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <button onClick={() => router.push("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image src="/images/eye-black-and-white.png" alt="Logo" width={32} height={32} className="" />
            <span className="font-black text-xl text-background hidden sm:block mb-1">you should watch</span>
          </button>
          <div></div>
          {/* Right side - Auth */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push("/login")}
                  className="px-6 py-2 bg-background font-bold text-fadedBlack uppercase border-4 border-background hover:bg-fadedBlue hover:text-background transition-all duration-200"
                >
                  Sign In/Up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
