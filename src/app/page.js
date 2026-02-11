"use client";

import React, { useState, useEffect, useRef } from "react";
import Navbar from "./components/Navbar";
import { SearchBar } from "./components/SearchBar";
import Scenarios from "./components/Scenarios";
import Image from "next/image";

export default function HomePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="min-h-screen bg-background pt-[50px]">
      <div className="mx-auto">
        <Navbar isLoaded={isLoaded} />

        {/* Header */}
        <div
          className={`text-center text-background bg-fadedBlue border-4 border-fadedBlack m-8 mt-16 md:p-12 p-6 transition-all duration-1000 relative z-50 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
          }`}
        >
          <Image src="/images/eye-black-and-white.png" alt="Logo" width={100} height={100} className="mx-auto mb-4" />
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black leading-none mb-4">you should</h1>
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black leading-none mb-6">watch</h1>
          <h1 className="text-xl font-bold mb-6 w-full max-w-lg mx-auto text-center">
            Search movies you like and let us recommend the perfect film for you to watch next!
          </h1>
          <div className="flex justify-center">
            <div ref={searchInputRef} className="w-full max-w-md">
              <SearchBar />
            </div>
          </div>
        </div>

        {/* Main CTA */}
        <div
          className={`px-8 text-center mb-8 transition-all duration-700 relative z-10 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "300ms" }}
        >
          <p className="text-lg font-bold text-black max-w-2xl mx-auto pb-2">or...</p>
          <h2 className="text-3xl lg:text-4xl font-black text-black uppercase mb-6">Choose Your Scenario</h2>
          <h1 className="text-xl font-bold mb-6 w-full max-w-lg mx-auto text-center">
            Pick a movie watching scenario below to get personalized movie recommendations
          </h1>
        </div>

        {/* Scenario Cards - CAROUSEL ON MOBILE */}
        <Scenarios isLoaded={isLoaded} />
      </div>
    </div>
  );
}
