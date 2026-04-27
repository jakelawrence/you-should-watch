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
      <Navbar isLoaded={isLoaded} />

      {/* Hero header */}
      <div
        className={`px-6 sm:px-12 lg:px-20 transition-all duration-1000 relative z-1 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
        }`}
      >
        <div className="pt-12 sm:pt-20 pb-8 sm:pb-12">
          <div className="flex flex-col items-start">
            {/* Vertical rule + stacked title */}
            <div className="flex gap-5 sm:gap-8">
              <div className="w-px bg-fadedBlack/15 self-stretch flex-shrink-0" />
              <div className="flex flex-col" style={{ lineHeight: 0.95 }}>
                {["you", "should", "watch"].map((word, i) => (
                  <p
                    key={word}
                    className="font-dmSerifDisplay text-[3.5rem] sm:text-[6rem] md:text-[8rem] lg:text-[8rem]"
                    style={{ marginTop: i === 0 ? 0 : "-0.05em" }}
                  >
                    {word}
                  </p>
                ))}
              </div>
            </div>

            {/* Subline */}
            <div className="mt-6 sm:mt-8 pl-6 sm:pl-12">
              <p className="font-dmSans font-light text-sm sm:text-base text-fadedBlack/50 max-w-xs sm:max-w-sm">
                Pick a film you love. We&apos;ll find your next watch.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Banner image — warm overlay + bottom fade */}
      <div
        className={`relative overflow-hidden transition-all duration-1000 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
      >
        <Image
          src="/images/you-should-watch-banner.jpg"
          alt="You Should Watch Banner"
          width={5541}
          height={400}
          priority
          sizes="100vw"
          className="w-full h-[200px] sm:h-[260px] lg:h-[340px] object-cover"
        />
        {/* Warm tint */}
        <div className="absolute inset-0 bg-fadedGold/20 pointer-events-none" />
        {/* Fade to background at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </div>

      {/* Search section */}
      <div
        className={`px-6 sm:px-12 lg:px-20 pt-20 pb-16 text-center transition-all duration-700 relative z-10 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
        style={{ transitionDelay: "300ms" }}
      >
        <p className="font-bigShouldersDisplay font-black text-2xl sm:text-3xl lg:text-5xl uppercase tracking-wide mb-8 sm:mb-10">
          Find a Film
        </p>
        <div className="w-full flex justify-center mb-5">
          <div className="max-w-md sm:max-w-lg w-full">
            <SearchBar />
          </div>
        </div>
        <div className="flex justify-center">
          <button
            onClick={() => setShowHow(true)}
            className="font-dmSans text-xs uppercase tracking-widest text-fadedBlack/30 hover:text-fadedBlack transition-colors border-b border-fadedBlack/15 hover:border-fadedBlack pb-0.5"
          >
            How it works
          </button>
        </div>
      </div>

      {/* Scenarios — demoted */}
      <div
        className={`px-6 sm:px-12 lg:px-20 text-center mb-8 transition-all duration-700 relative z-1 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
        style={{ transitionDelay: "400ms" }}
      >
        <p className="font-dmSans font-light text-fadedBlack/35 text-xs uppercase tracking-widest">
          or choose a scenario
        </p>
      </div>

      <Scenarios isLoaded={isLoaded} />

      <HowToUsePopup open={showHow} onClose={() => setShowHow(false)} />
    </div>
  );
}
