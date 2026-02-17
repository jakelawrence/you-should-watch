"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Calendar, Tv, Heart, ThumbsUp, LogOut, Settings } from "lucide-react";
import Navbar from "../components/Navbar";
import Loading from "../components/Loading";

export default function ProfilePage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoaded(true);
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch("/api/user/profile");
      console.log("Profile fetch response status:", response.status);
      if (!response.ok) {
        if (response.status === 401) {
          console.log("User not authenticated, redirecting to login");
          router.push("/login");
          return;
        }
        throw new Error("Failed to load profile");
      }

      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      console.error("Error loading profile:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-fadedBlack flex flex-col">
        <Navbar isLoaded={isLoaded} />
        <div className="flex-1 flex items-center justify-center">
          <Loading />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-black font-bold text-xl mb-4">Error loading profile</p>
          <button
            onClick={() => router.push("/")}
            className="bg-black text-white px-6 py-3 font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const { user, stats } = profileData;

  // Generate avatar color based on email
  const getAvatarColor = () => {
    if (!user?.email) return "hsl(0, 0%, 40%)";
    let hash = 0;
    for (let i = 0; i < user.email.length; i++) {
      hash = user.email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const getInitials = () => {
    console.log("Generating initials for user:", user);
    if (!user) return "U";
    if (user.name) {
      const names = user.name.trim().split(" ");
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    return user.email ? user.email[0].toUpperCase() : "U";
  };

  const profileActions = [
    {
      id: "saved-movies",
      title: "Saved Movies",
      description: "View your favorite and liked movies",
      icon: Heart,
      route: "/profile/saved-movies",
      count: stats.totalFavorites + stats.totalLikes,
    },
    {
      id: "streaming-services",
      title: "Streaming Services",
      description: "Manage your streaming platforms",
      icon: Tv,
      route: "/streaming-service",
      count: stats.totalStreamingServices,
    },
    {
      id: "settings",
      title: "Account Settings",
      description: "Update your profile information",
      icon: Settings,
      route: "/profile/settings",
      disabled: true, // Coming soon
    },
  ];

  return (
    <div className="min-h-screen bg-fadedBlack pb-[100px]">
      <Navbar isLoaded={isLoaded} currentPage={"profile"} />
      <div className="max-w-6xl mx-auto">
        {/* Header */}

        {/* Profile Overview */}
        <div
          className={`p-8 mb-12 transition-all duration-700 text-white ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          style={{ transitionDelay: "200ms" }}
        >
          <div className="flex justify-between items-start mb-12 font-specialGothicExpandedOne text-background">
            <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"}`}>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-none">your</h1>
              <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-none">profile</h2>
            </div>
          </div>
          <h3 className="text-2xl font-black uppercase mb-6">Profile Overview</h3>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
            {/* Avatar */}
            <div
              className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center text-white font-black text-3xl flex-shrink-0"
              style={{ backgroundColor: getAvatarColor() }}
            >
              {getInitials()}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h4 className="text-3xl font-black mb-2">{user.username || "User"}</h4>
              <p className="text-lg font-bold">{user.email}</p>
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4 pb-6 border-b-4 border-white">
              <User size={32} strokeWidth={3} className="flex-shrink-0" />
              <div>
                <p className="text-sm font-black uppercase">Username</p>
                <p className="text-xl font-bold">{user.username || "Not set"}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-6 border-b-4 border-white">
              <Mail size={32} strokeWidth={3} className="flex-shrink-0" />
              <div>
                <p className="text-sm font-black uppercase">Email</p>
                <p className="text-xl font-bold break-all">{user.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-6 border-b-4 border-white">
              <Calendar size={32} strokeWidth={3} className="flex-shrink-0" />
              <div>
                <p className="text-sm font-black uppercase">Member Since</p>
                <p className="text-xl font-bold">{stats.memberSince}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-6 border-b-4 border-white">
              <Tv size={32} strokeWidth={3} className="flex-shrink-0" />
              <div>
                <p className="text-sm font-black uppercase">Streaming Services</p>
                <p className="text-xl font-bold">{stats.totalStreamingServices} selected</p>
              </div>
            </div>
          </div>
          {/* Action Buttons */}
          <div
            className={`mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-700 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
            style={{ transitionDelay: "400ms" }}
          >
            {profileActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => !action.disabled && router.push(action.route)}
                  disabled={action.disabled}
                  className={`bg-white border-4 border-black p-8 text-left transition-all duration-300 group relative ${
                    action.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-black hover:text-white"
                  }`}
                >
                  <Icon className="mb-4 text-black group-hover:text-white transition-colors" size={40} strokeWidth={3} />
                  <h3 className="text-2xl font-black uppercase mb-3 text-black group-hover:text-white transition-colors">{action.title}</h3>
                  <p className="text-base font-bold text-black group-hover:text-white transition-colors">{action.description}</p>

                  {/* Count Badge */}
                  {action.count !== undefined && !action.disabled && (
                    <div className="absolute top-4 right-4 bg-black text-white w-10 h-10 rounded-full flex items-center justify-center font-black group-hover:bg-white group-hover:text-black transition-colors">
                      {action.count}
                    </div>
                  )}

                  {action.disabled && <p className="text-sm font-bold mt-2 text-gray-600">Coming Soon</p>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
