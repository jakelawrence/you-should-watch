"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Navbar } from "./components/Navbar";
import { SearchBar } from "./components/SearchBar";
import Scenarios from "./components/Scenarios";
import HowToUsePopup from "./components/HowToUsePopup";

export default function HomePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="min-h-screen text-fadedBlack">
      <div className="mx-auto">
        <Navbar isLoaded={isLoaded} />
        {/* Header */}
        <div
          className={`text-center sm:text-left px-4 sm:px-6 transition-all duration-1000 relative z-1 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
          }`}
        >
          {/* <Image src="/images/eye-black-and-white.png" alt="Logo" width={100} height={100} className="mx-auto mb-4" />  */}
          <div className="pt-10 sm:pt-[80px] pb-6 sm:pb-10">
            <div className="flex flex-col items-center sm:items-start">
              {/* Big title: split into three words so we can control layout responsively */}
              <div className="flex flex-col leading-none">
                <p className="font-syne font-black text-3xl sm:text-7xl md:text-8xl lg:text-[8rem]">you</p>
                <p className="font-syne font-black text-3xl sm:text-7xl md:text-8xl lg:text-[8rem] -mt-1 sm:-mt-2">should</p>
                <p className="font-syne font-black text-3xl sm:text-7xl md:text-8xl lg:text-[8rem] -mt-1 sm:-mt-2">watch</p>
              </div>

              {/* Search blurb: always below the title */}
              <div className="mt-4 sm:mt-6 flex items-start">
                <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold max-w-sm sm:max-w-md text-center sm:text-left mx-auto sm:mx-0 pb-2 border-b-2 sm:border-b-2 border-fadedBlack">
                  Pick a film you love. We'll find your next watch.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div>
          <Image
            src="/images/you-should-watch-banner.jpg"
            alt="You Should Watch Banner"
            width={5541}
            height={400}
            priority
            sizes="100vw"
            className={`w-full h-[220px] sm:h-auto object-cover transition-all duration-1000 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"}`}
          />
        </div>
        {/* Search */}
        <div
          className={`px-4 sm:px-8 pt-8 sm:pt-10 text-center transition-all duration-700 relative z-10 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "300ms" }}
        >
          <p className="font-specialGothicExpandedOne text-2xl sm:text-3xl lg:text-6xl font-black uppercase mb-6 sm:mb-10">Find a Film</p>
          <div className="w-full flex justify-center mb-4">
            <div className="max-w-md sm:max-w-lg w-full">
              <SearchBar />
            </div>
          </div>
          <div className="flex justify-center mb-8 sm:mb-10">
            <button
              onClick={() => setShowHow(true)}
              className="text-xs font-black uppercase tracking-widest text-fadedBlack/30 hover:text-fadedBlack transition-colors border-b border-fadedBlack/20 hover:border-fadedBlack pb-0.5"
            >
              How it works
            </button>
          </div>
        </div>
        {/* Scenario */}
        <div
          className={`px-4 sm:px-8 text-center mb-6 sm:mb-8 transition-all duration-700 relative z-1 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "300ms" }}
        >
          <p className="text-base sm:text-lg font-bold max-w-2xl mx-auto pb-2 text-fadedBlack/40">or...</p>
          <p className="font-specialGothicExpandedOne text-2xl sm:text-3xl lg:text-6xl font-black uppercase mb-1 sm:mb-2">Choose Your</p>
          <p className="font-specialGothicExpandedOne text-2xl sm:text-3xl lg:text-6xl font-black uppercase mb-6 sm:mb-10">Scenario</p>
        </div>

        {/* Scenario Cards - CAROUSEL ON MOBILE */}
        <Scenarios isLoaded={isLoaded} />
      </div>

      <HowToUsePopup open={showHow} onClose={() => setShowHow(false)} />
    </div>
  );
}
