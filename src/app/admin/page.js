// app/admin/page.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Film, Tv, Users, Database, LogOut } from "lucide-react";
import Loading from "../components/Loading";
import Navbar from "../components/Navbar";

export default function AdminDashboard() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [stats, setStats] = useState({
    totalMovies: 0,
    totalProviders: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/verify", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        router.push("/admin/login");
        return;
      }

      const data = await response.json();
      setAdminUser(data.user);
      setIsAuthenticated(true);
      loadStats();
    } catch (error) {
      console.error("Auth check failed:", error);
      router.push("/admin/login");
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch("/api/admin/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
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

  if (!isAuthenticated) {
    return null;
  }

  const adminActions = [
    {
      id: "add-movies",
      title: "Add Movies",
      description: "Add new movies to the database",
      icon: Film,
      route: "/admin/add-movies",
    },
    {
      id: "add-providers",
      title: "Add Streaming Services",
      description: "Add streaming service providers",
      icon: Tv,
      route: "/admin/add-providers",
    },
    {
      id: "edit-providers",
      title: "Edit Streaming Services",
      description: "Modify existing streaming service providers",
      icon: Tv,
      route: "/admin/edit-providers",
    },
    {
      id: "manage-users",
      title: "Manage Users",
      description: "View and manage user accounts",
      icon: Users,
      route: "/admin/users",
      disabled: true, // Coming soon
    },
    {
      id: "database",
      title: "Database Tools",
      description: "Bulk operations and data management",
      icon: Database,
      route: "/admin/database",
      disabled: true, // Coming soon
    },
  ];

  return (
    <div className="min-h-screen bg-white px-4 py-8 lg:py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-12">
          <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"}`}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-black leading-none">admin</h1>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-black leading-none">dashboard</h2>
            {adminUser && <p className="text-lg font-bold text-black mt-4">Welcome, {adminUser.email}</p>}
          </div>

          <button
            onClick={handleLogout}
            className="bg-white border-4 border-black px-6 py-3 font-black uppercase hover:bg-black hover:text-white transition-all duration-200"
          >
            <LogOut className="inline mr-2" size={20} strokeWidth={3} />
            Logout
          </button>
        </div>

        {/* Stats */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <div className="bg-blue-200 border-4 border-black p-6">
            <p className="text-sm font-black uppercase mb-2">Total Movies</p>
            <p className="text-4xl font-black">{stats.totalMovies.toLocaleString()}</p>
          </div>
          <div className="bg-yellow-300 border-4 border-black p-6">
            <p className="text-sm font-black uppercase mb-2">Streaming Services</p>
            <p className="text-4xl font-black">{stats.totalProviders.toLocaleString()}</p>
          </div>
          <div className="bg-green-200 border-4 border-black p-6">
            <p className="text-sm font-black uppercase mb-2">Total Users</p>
            <p className="text-4xl font-black">{stats.totalUsers.toLocaleString()}</p>
          </div>
        </div>

        {/* Actions Grid */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 gap-6 transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "400ms" }}
        >
          {adminActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => !action.disabled && router.push(action.route)}
                disabled={action.disabled}
                className={`bg-white border-4 border-black p-8 lg:p-12 text-left transition-all duration-300 group ${
                  action.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-black hover:text-white"
                }`}
              >
                <Icon className="mb-4 text-black group-hover:text-white transition-colors" size={40} strokeWidth={3} />
                <h3 className="text-2xl lg:text-3xl font-black uppercase mb-3 text-black group-hover:text-white transition-colors">{action.title}</h3>
                <p className="text-lg font-bold text-black group-hover:text-white transition-colors">{action.description}</p>
                {action.disabled && <p className="text-sm font-bold mt-2 text-gray-600">Coming Soon</p>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
