"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, LogOut, Settings, Film } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import Image from "next/image";

export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
    router.push("/");
  };

  // Generate initials from email or name
  const getInitials = () => {
    if (!user) return "U";

    // If user has a name, use first letter of first and last name
    if (user.name) {
      const names = user.name.trim().split(" ");
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return names[0][0].toUpperCase();
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
    <nav className="fixed top-0 left-0 right-0 z-40 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <button onClick={() => router.push("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {/* Image of Eye Logo */}
            <Image src="/images/eye.png" alt="Logo" width={32} height={32} className="w-8 h-8 sm:w-10 sm:h-10" />
          </button>

          {/* Right side - Auth */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                {/* Profile Button */}
                <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-white font-black text-sm"
                    style={{ backgroundColor: getAvatarColor() }}
                  >
                    {getInitials()}
                  </div>

                  {/* User name/email on larger screens */}
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-black text-black">{user?.name || user?.email?.split("@")[0] || "User"}</p>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border-4 border-black shadow-lg">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b-4 border-black">
                      <p className="text-sm font-black text-black truncate">{user?.name || "User"}</p>
                      <p className="text-xs font-bold text-gray-600 truncate">{user?.email}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          router.push("/profile");
                        }}
                        className="w-full px-4 py-3 text-left font-black text-black hover:bg-blue-200 transition-colors flex items-center gap-3"
                      >
                        <User size={18} strokeWidth={3} />
                        Profile
                      </button>

                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          router.push("/streaming-service");
                        }}
                        className="w-full px-4 py-3 text-left font-black text-black hover:bg-blue-200 transition-colors flex items-center gap-3"
                      >
                        <Settings size={18} strokeWidth={3} />
                        Streaming Services
                      </button>

                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-3 text-left font-black text-black hover:bg-red-200 transition-colors flex items-center gap-3 border-t-4 border-black"
                      >
                        <LogOut size={18} strokeWidth={3} />
                        Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => router.push("/login")} className="px-4 py-2 font-black text-black hover:bg-gray-100 transition-colors">
                  Log In
                </button>
                <button
                  onClick={() => router.push("/signup")}
                  className="px-6 py-2 bg-black text-white font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-all duration-200"
                  style={{
                    boxShadow: "4px 4px 0px 0px #000000",
                  }}
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
