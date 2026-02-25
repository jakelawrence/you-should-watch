"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import AuthModal from "../../components/AuthModal";
import Navbar from "../../components/Navbar";

export default function StreamingServicesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, refreshAuth } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectAllFree, setSelectAllFree] = useState(false);
  const [providers, setProviders] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    fetchProviders();
  }, []);

  useEffect(() => {
    // Load user preferences only if authenticated
    if (isAuthenticated && !authLoading) {
      loadUserPreferences();
    }
  }, [isAuthenticated, authLoading]);

  const fetchProviders = async () => {
    try {
      setIsLoadingProviders(true);
      const response = await fetch("/api/providers");
      const data = await response.json();
      const processedProviders = data.providers.map((provider) => ({
        id: provider.provider_id,
        name: provider.provider_name,
        type: provider.type,
        logo_path: provider.logo_path,
      }));
      setProviders(processedProviders);
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const loadUserPreferences = async () => {
    try {
      const response = await fetch("/api/user/streaming-services");
      if (response.ok) {
        const data = await response.json();
        const services = data.streamingServices || [];

        if (Array.isArray(services)) {
          setSelectedServices(services);
        } else {
          console.error("streamingServices is not an array:", services);
          setSelectedServices([]);
        }
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  const toggleService = (serviceId) => {
    setSelectedServices((prev) => (prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]));
  };

  useEffect(() => {
    if (providers.length > 0 && selectedServices.length > 0) {
      const freeServiceIds = providers.filter((p) => p.type === "free").map((s) => s.id);
      const allFreeSelected = freeServiceIds.length > 0 && freeServiceIds.every((id) => selectedServices.includes(id));
      setSelectAllFree(allFreeSelected);
    }
  }, [selectedServices, providers]);

  const handleSaveAndContinue = async () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Show auth modal instead of saving
      setShowAuthModal(true);
      return;
    }

    // User is authenticated, proceed with saving
    await savePreferences();
  };

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/user/streaming-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamingServices: selectedServices }),
      });

      if (response.ok) {
        // Get return URL from query params, default to profile
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get("returnTo") || "/";
        console.log("Redirecting to:", returnTo);
        router.push(returnTo);
      } else {
        console.error("Failed to save preferences");
        alert("Failed to save preferences. Please try again.");
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuthSuccess = async () => {
    // Close modal
    setShowAuthModal(false);

    // Refresh auth state
    await refreshAuth();

    // Save preferences and continue
    await savePreferences();
  };

  const handleSkip = () => {
    router.push("/scenario");
  };

  // Show loading state while checking auth or loading providers
  if (authLoading || isLoadingProviders) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-black font-bold text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fadedBlack pb-24">
      <Navbar isLoaded={isLoaded} currentPage="profile" />

      <div className="max-w-6xl mx-auto px-4 pt-4">
        {/* ── Header ── */}
        <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"} mb-10`}>
          <h1 className="font-specialGothicExpandedOne text-background text-5xl sm:text-6xl lg:text-7xl leading-none uppercase">your</h1>
          <h2 className="font-specialGothicExpandedOne text-background text-5xl sm:text-6xl lg:text-7xl leading-none uppercase">services</h2>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 pt-4">
        {/* Paid/Subscription Services */}
        <div
          className={`transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          style={{ transitionDelay: "300ms" }}
        >
          <h2 className="text-2xl lg:text-3xl font-black text-background uppercase mb-[50px]">Subscription Services</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            {providers
              .filter((p) => p.type === "flatrate")
              .map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <div key={service.id} className="flex flex-col items-center gap-3 bg-background p-4 rounded-lg">
                    <span className="text-xs font-bold text-black text-center">{service.name}</span>
                    <button onClick={() => toggleService(service.id)} className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                      <img src={`https://image.tmdb.org/t/p/w500${service.logo_path}`} alt={service.name} className="h-24 w-auto" />
                    </button>
                    <div className="flex flex-col items-center gap-2 w-full">
                      <label className="flex items-center cursor-pointer gap-2">
                        <div
                          className={`w-5 h-5 border-3 border-black rounded-full flex items-center justify-center transition-all duration-200 ${
                            isSelected ? "bg-black" : "bg-white"
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleService(service.id)} className="hidden" />
                      </label>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Free Services with Ads */}
        <div
          className={`transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
          style={{ transitionDelay: "400ms" }}
        >
          <div className="flex items-center justify-between mb-[50px] mt-[50px]">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black text-background uppercase">Free Services (with ads)</h2>
              <p className="text-sm font-bold text-background mt-1">Ad-supported streaming platforms</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            {providers
              .filter((p) => p.type === "free")
              .map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <div key={service.id} className="flex flex-col items-center gap-3 bg-background p-4 rounded-lg">
                    <span className="text-xs font-bold text-black text-center">{service.name}</span>
                    <button onClick={() => toggleService(service.id)} className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                      <img src={`https://image.tmdb.org/t/p/w500${service.logo_path}`} alt={service.name} className="h-24 w-auto" />
                    </button>
                    <div className="flex flex-col items-center gap-2 w-full">
                      <label className="flex items-center cursor-pointer gap-2">
                        <div
                          className={`w-5 h-5 border-3 border-black rounded-full flex items-center justify-center transition-all duration-200 ${
                            isSelected ? "bg-black" : "bg-white"
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleService(service.id)} className="hidden" />
                      </label>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
