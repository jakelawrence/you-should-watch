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
    // <>
    //   <div className="min-h-screen bg-background flex flex-col items-center font-background text-background">
    //     {/* Large Title */}
    //     <div className="text-center mb-12 lg:mb-16 bg-fadedBlack p-8">
    //       <h1
    //         className={`text-5xl sm:text-6xl lg:text-7xl xl:text-8xl leading-none transition-all duration-1000 ${
    //           isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
    //         }`}
    //       >
    //         choose your
    //       </h1>
    //       <h1
    //         className={`text-5xl sm:text-6xl lg:text-7xl xl:text-8xl leading-none transition-all duration-1000 ${
    //           isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
    //         }`}
    //         style={{ transitionDelay: "100ms" }}
    //       >
    //         streaming services
    //       </h1>
    //       <p
    //         className={`text-lg lg:text-xl font-bold mt-6 max-w-2xl mx-auto transition-all duration-700 ${
    //           isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
    //         }`}
    //         style={{ transitionDelay: "200ms" }}
    //       >
    //         Select the streaming services you have access to. We'll only show movies available on your platforms.
    //       </p>
    //       {!isAuthenticated && (
    //         <p
    //           className={`text-base font-bold text-black mt-4 bg-yellow-200 border-4 border-black p-4 inline-block transition-all duration-700 ${
    //             isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
    //           }`}
    //           style={{ transitionDelay: "250ms" }}
    //         >
    //           💡 Create a free account to save your preferences!
    //         </p>
    //       )}
    //     </div>

    //     {/* Services Grid */}
    //     <div className="w-full max-w-5xl space-y-12 mb-12 px-4">
    //       {/* Paid/Subscription Services */}
    //       <div
    //         className={`transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
    //         style={{ transitionDelay: "300ms" }}
    //       >
    //         <h2 className="text-2xl lg:text-3xl font-black text-black uppercase mb-[50px]">Subscription Services</h2>
    //         <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 gap-4">
    //           {providers
    //             .filter((p) => p.type === "flatrate")
    //             .map((service) => {
    //               const isSelected = selectedServices.includes(service.id);
    //               return (
    //                 <div key={service.id} className="flex flex-col items-center gap-3">
    //                   <span className="text-xs font-bold text-black text-center">{service.name}</span>
    //                   <button onClick={() => toggleService(service.id)} className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
    //                     <img src={`https://image.tmdb.org/t/p/w500${service.logo_path}`} alt={service.name} className="h-24 w-auto" />
    //                   </button>
    //                   <div className="flex flex-col items-center gap-2 w-full">
    //                     <label className="flex items-center cursor-pointer gap-2">
    //                       <div
    //                         className={`w-5 h-5 border-3 border-black rounded-full flex items-center justify-center transition-all duration-200 ${
    //                           isSelected ? "bg-black" : "bg-white"
    //                         }`}
    //                       >
    //                         {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
    //                       </div>
    //                       <input type="checkbox" checked={isSelected} onChange={() => toggleService(service.id)} className="hidden" />
    //                     </label>
    //                   </div>
    //                 </div>
    //               );
    //             })}
    //         </div>
    //       </div>

    //       {/* Free Services with Ads */}
    //       <div
    //         className={`transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
    //         style={{ transitionDelay: "400ms" }}
    //       >
    //         <div className="flex items-center justify-between mb-[50px]">
    //           <div>
    //             <h2 className="text-2xl lg:text-3xl font-black text-black uppercase">Free Services (with ads)</h2>
    //             <p className="text-sm font-bold text-black mt-1">Ad-supported streaming platforms</p>
    //           </div>
    //           <button
    //             onClick={handleSelectAllFree}
    //             className="group relative bg-transparent border-none p-0 cursor-pointer outline-offset-4 select-none touch-manipulation hover:brightness-110 transition-all duration-700"
    //           >
    //             <span className="absolute top-0 left-0 w-full h-full rounded-lg bg-black/25 will-change-transform translate-y-[1px] transition-transform duration-[600ms] group-hover:translate-y-1 group-active:translate-y-[1px]"></span>
    //             <span className="absolute top-0 left-0 w-full h-full rounded-lg bg-gradient-to-l from-[hsl(220,100%,16%)] via-[hsl(220,100%,32%)] to-[hsl(220,100%,16%)]"></span>
    //             <span className="block relative px-6 py-3 rounded-lg text-lg font-black uppercase text-white bg-[hsl(220,100%,47%)] will-change-transform -translate-y-1 transition-transform duration-[600ms] group-hover:-translate-y-1.5 group-active:-translate-y-0.5">
    //               {selectAllFree ? "Deselect All" : "Select All"}
    //             </span>
    //           </button>
    //         </div>
    //         <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 gap-4">
    //           {providers
    //             .filter((p) => p.type === "free")
    //             .map((service) => {
    //               const isSelected = selectedServices.includes(service.id);
    //               return (
    //                 <div key={service.id} className="flex flex-col items-center gap-3">
    //                   <button onClick={() => toggleService(service.id)} className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
    //                     <img src={`https://image.tmdb.org/t/p/w500${service.logo_path}`} alt={service.name} className="h-24 w-auto" />
    //                   </button>
    //                   <div className="flex flex-col items-center gap-2 w-full">
    //                     <span className="text-xs font-bold text-black text-center">{service.name}</span>
    //                     <label className="flex items-center cursor-pointer gap-2">
    //                       <div
    //                         className={`w-5 h-5 border-3 border-black rounded-full flex items-center justify-center transition-all duration-200 ${
    //                           isSelected ? "bg-black" : "bg-white"
    //                         }`}
    //                       >
    //                         {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
    //                       </div>
    //                       <input type="checkbox" checked={isSelected} onChange={() => toggleService(service.id)} className="hidden" />
    //                     </label>
    //                   </div>
    //                 </div>
    //               );
    //             })}
    //         </div>
    //       </div>
    //     </div>

    //     {/* Selection Summary */}
    //     {selectedServices.length > 0 && (
    //       <div
    //         className={`w-full max-w-5xl mb-8 bg-blue-200 border-4 border-black p-6 transition-all duration-700 ${
    //           isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
    //         }`}
    //         style={{ transitionDelay: "500ms" }}
    //       >
    //         <p className="text-black font-black text-lg">
    //           {selectedServices.length} service
    //           {selectedServices.length !== 1 ? "s" : ""} selected
    //         </p>
    //       </div>
    //     )}

    //     {/* Action Buttons */}
    //     <div
    //       className={`flex flex-col sm:flex-row gap-4 transition-all duration-700 ${
    //         isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
    //       }`}
    //       style={{ transitionDelay: "600ms" }}
    //     >
    //       {selectedServices.length > 0 && (
    //         <button
    //           onClick={handleSaveAndContinue}
    //           disabled={isSaving}
    //           className="group relative bg-transparent border-none p-0 cursor-pointer outline-offset-4 select-none touch-manipulation hover:brightness-110 transition-all duration-700 disabled:opacity-50"
    //         >
    //           <span className="absolute top-0 left-0 w-full h-full rounded-xl bg-black/25 will-change-transform translate-y-[2px] transition-transform duration-[600ms] group-hover:translate-y-1 group-active:translate-y-[1px]"></span>
    //           <span className="absolute top-0 left-0 w-full h-full rounded-xl bg-gradient-to-l from-[hsl(140,97%,14%)] via-[hsl(140,97%,28%)] to-[hsl(140,97%,14%)]"></span>
    //           <span className="block relative px-12 py-6 rounded-xl text-2xl font-black uppercase text-white bg-[#03C03C] will-change-transform -translate-y-1 transition-transform duration-[600ms] group-hover:-translate-y-[6px] group-active:-translate-y-[2px]">
    //             {isSaving ? "Saving..." : isAuthenticated ? "Save & Continue" : "Continue"}
    //           </span>
    //         </button>
    //       )}

    //       <button
    //         onClick={handleSkip}
    //         className="group relative bg-transparent border-none p-0 cursor-pointer outline-offset-4 select-none touch-manipulation hover:brightness-110 transition-all duration-700"
    //       >
    //         <span className="absolute top-0 left-0 w-full h-full rounded-xl bg-black/25 will-change-transform translate-y-[2px] transition-transform duration-[600ms] group-hover:translate-y-1 group-active:translate-y-[1px]"></span>
    //         <span className="absolute top-0 left-0 w-full h-full rounded-xl bg-gradient-to-l from-[hsl(340,100%,16%)] via-[hsl(340,100%,32%)] to-[hsl(340,100%,16%)]"></span>
    //         <span className="block relative px-12 py-6 rounded-xl text-2xl font-black uppercase text-white bg-[hsl(345,100%,47%)] will-change-transform -translate-y-1 transition-transform duration-[600ms] group-hover:-translate-y-[6px] group-active:-translate-y-[2px]">
    //           {selectedServices.length > 0 ? "Skip for Now" : "Skip"}
    //         </span>
    //       </button>
    //     </div>

    //     {/* Back to Home Link */}
    //     <button
    //       onClick={() => router.push("/")}
    //       className={`mt-12 mb-6 text-black font-bold text-lg hover:underline transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
    //       style={{ transitionDelay: "700ms" }}
    //     >
    //       ← Back to Home
    //     </button>
    //   </div>

    //   {/* Auth Modal */}
    //   <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />
    // </>
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
          <h2 className="text-2xl lg:text-3xl font-black text-black uppercase mb-[50px]">Subscription Services</h2>
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
          <div className="flex items-center justify-between mb-[50px]">
            <div>
              <h2 className="text-2xl lg:text-3xl font-black text-black uppercase">Free Services (with ads)</h2>
              <p className="text-sm font-bold text-black mt-1">Ad-supported streaming platforms</p>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            {providers
              .filter((p) => p.type === "free")
              .map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <div key={service.id} className="flex flex-col items-center gap-3">
                    <button onClick={() => toggleService(service.id)} className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                      <img src={`https://image.tmdb.org/t/p/w500${service.logo_path}`} alt={service.name} className="h-24 w-auto" />
                    </button>
                    <div className="flex flex-col items-center gap-2 w-full">
                      <span className="text-xs font-bold text-black text-center">{service.name}</span>
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
