"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Trigger animation after component mounts
    setIsLoaded(true);
  }, []);

  const handleGetStarted = () => {
    router.push("/scenario");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Main Title */}
      <div className="text-center mb-12">
        {/* Mobile: 3 lines */}
        <div className="lg:hidden">
          <h1
            className={`text-8xl sm:text-9xl font-black text-black leading-none transition-all duration-700 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
            style={{ transitionDelay: "0ms" }}
          >
            you
          </h1>
          <h1
            className={`text-8xl sm:text-9xl font-black text-black leading-none transition-all duration-700 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            should
          </h1>
          <h1
            className={`text-8xl sm:text-9xl font-black text-black leading-none transition-all duration-700 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
            style={{ transitionDelay: "400ms" }}
          >
            watch
          </h1>
        </div>

        {/* Desktop: 2 lines */}
        <div className="hidden lg:block">
          <h1
            className={`text-[10rem] xl:text-[14rem] 2xl:text-[16rem] font-black text-black leading-none transition-all duration-1000 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
          >
            youshould
          </h1>
          <h1
            className={`text-[10rem] xl:text-[14rem] 2xl:text-[16rem] font-black text-black leading-none transition-all duration-1000 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            watch
          </h1>
        </div>
      </div>

      {/* Get Started Button */}
      <button
        onClick={handleGetStarted}
        className={`bg-black text-white px-12 py-6 text-2xl font-black uppercase border-4 border-black transition-all duration-200 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        } `}
        style={{
          transitionDelay: isLoaded ? "600ms" : "0ms",
        }}
      >
        Get Started
      </button>

      {/* Optional tagline */}
      <p
        className={`mt-8 text-black text-lg font-bold max-w-md text-center transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDelay: "800ms" }}
      >
        Discover your next favorite movie with personalized recommendations
      </p>
    </div>
  );
}
