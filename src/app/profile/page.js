"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Calendar, Tv, Heart, ThumbsUp, Settings, LogOut } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../hooks/useAuth";
import Loading from "../components/Loading";

export default function ProfilePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);

  const AVATAR_COLORS = ["#4f6f8a", "#5b7c66", "#b25b5b", "#d7c7a3", "#1f1b17"];
  const avatarColor = useMemo(() => {
    const email = profileData?.user?.email;
    if (!email) return "#1f1b17";
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }, [profileData?.user?.email]);

  useEffect(() => {
    setIsLoaded(true);
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (!response.ok) {
        if (response.status === 401) {
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


  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar isLoaded={isLoaded} />
        <div className="flex-1 flex items-center justify-center">
          <Loading />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center border border-fadedBlack/15 bg-background p-8">
          <p className="text-fadedBlack font-bold text-xl mb-4">Error loading profile</p>
          <button
            onClick={() => router.push("/")}
            className="bg-fadedBlack text-background px-6 py-3 font-black uppercase border-2 border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const { user, stats } = profileData;

  const getInitials = () => {
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
      count: stats.totalSavedMovies,
    },
    {
      id: "streaming-services",
      title: "Streaming Services",
      description: "Manage your streaming platforms",
      icon: Tv,
      route: "/profile/streaming-service",
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
    <div className="min-h-screen bg-background pb-[20px]">
      <Navbar isLoaded={isLoaded} currentPage={"profile"} />
      <div className="max-w-6xl mx-auto">
        {/* Header */}

        {/* Profile Overview */}
        <div
          className={`p-8 mb-12 transition-all duration-700 text-fadedBlack ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          style={{ transitionDelay: "200ms" }}
        >
          <div className="flex justify-between items-start mb-12 font-specialGothicExpandedOne text-fadedBlack">
            <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"}`}>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-none">your</h1>
              <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-none">profile</h2>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 border border-fadedBlack/20 font-black text-sm uppercase text-fadedBlack hover:bg-fadedBlack hover:text-background hover:border-fadedBlack transition-all duration-200"
            >
              <LogOut size={16} strokeWidth={3} />
              Sign Out
            </button>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
            {/* Avatar */}
            <div
              className="w-24 h-24 rounded-full border-2 border-fadedBlack/15 flex items-center justify-center text-background font-black text-3xl flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {getInitials()}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h3 className="text-3xl font-black mb-2 text-fadedBlack">{user.username || "User"}</h3>
              <p className="text-lg font-bold text-fadedBlack/70">{user.email}</p>
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4 pb-6 border-b border-fadedBlack/10">
              <User size={32} strokeWidth={3} className="flex-shrink-0 text-fadedBlack" />
              <div>
                <p className="text-sm font-black uppercase text-fadedBlack/60">Username</p>
                <p className="text-xl font-bold text-fadedBlack">{user.username || "Not set"}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-6 border-b border-fadedBlack/10">
              <Mail size={32} strokeWidth={3} className="flex-shrink-0 text-fadedBlack" />
              <div>
                <p className="text-sm font-black uppercase text-fadedBlack/60">Email</p>
                <p className="text-xl font-bold break-all text-fadedBlack">{user.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-6 border-b border-fadedBlack/10">
              <Calendar size={32} strokeWidth={3} className="flex-shrink-0 text-fadedBlack" />
              <div>
                <p className="text-sm font-black uppercase text-fadedBlack/60">Member Since</p>
                <p className="text-xl font-bold text-fadedBlack">{stats.memberSince}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-6 border-b border-fadedBlack/10">
              <Tv size={32} strokeWidth={3} className="flex-shrink-0 text-fadedBlack" />
              <div>
                <p className="text-sm font-black uppercase text-fadedBlack/60">Streaming Services</p>
                <p className="text-xl font-bold text-fadedBlack">{stats.totalStreamingServices} selected</p>
              </div>
            </div>
          </div>
          {/* Action Buttons */}
          <div
            className={`mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-700 ${
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
                  className={`bg-background border border-fadedBlack/10 p-8 text-left transition-all duration-300 group relative ${
                    action.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-fadedBlack hover:text-background"
                  }`}
                >
                  <Icon className="mb-4 text-fadedBlack group-hover:text-background transition-colors" size={40} strokeWidth={3} />
                  <h3 className="text-2xl font-black uppercase mb-3 text-fadedBlack group-hover:text-background transition-colors">{action.title}</h3>
                  <p className="text-base font-bold text-fadedBlack/70 group-hover:text-background transition-colors">{action.description}</p>

                  {/* Count Badge */}
                  {action.count !== undefined && !action.disabled && (
                    <div className="absolute top-4 right-4 bg-fadedBlack text-background w-10 h-10 flex items-center justify-center font-black group-hover:bg-background group-hover:text-fadedBlack transition-colors">
                      {action.count}
                    </div>
                  )}

                  {action.disabled && <p className="text-sm font-bold mt-2 text-fadedBlack/50">Coming Soon</p>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
