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
    router.push("/streaming-service");
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
        className={`group relative bg-transparent border-none p-0 cursor-pointer outline-offset-4 select-none touch-manipulation hover:brightness-110 transition-all duration-700 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
        style={{
          transitionDelay: isLoaded ? "600ms" : "0ms",
        }}
      >
        {/* Shadow */}
        <span className="absolute top-0 left-0 w-full h-full rounded-xl bg-black/25 will-change-transform translate-y-[2px] transition-transform duration-[600ms] [transition-timing-function:cubic-bezier(0.3,0.7,0.4,1)] group-hover:translate-y-1 group-hover:duration-250 group-hover:[transition-timing-function:cubic-bezier(0.3,0.7,0.4,1.5)] group-active:translate-y-[1px] group-active:duration-[34ms]"></span>

        {/* Edge */}
        <span className="absolute top-0 left-0 w-full h-full rounded-xl bg-gradient-to-l from-[hsl(340,100%,16%)] via-[hsl(340,100%,32%)] to-[hsl(340,100%,16%)]"></span>

        {/* Front */}
        <span className="block relative px-12 py-6 rounded-xl text-2xl font-black uppercase text-white bg-[hsl(345,100%,47%)] will-change-transform -translate-y-1 transition-transform duration-[600ms] [transition-timing-function:cubic-bezier(0.3,0.7,0.4,1)] group-hover:-translate-y-[6px] group-hover:duration-250 group-hover:[transition-timing-function:cubic-bezier(0.3,0.7,0.4,1.5)] group-active:-translate-y-[2px] group-active:duration-[34ms]">
          Get Started
        </span>
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
