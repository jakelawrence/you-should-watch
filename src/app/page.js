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
    <div className="min-h-screen text-background">
      <div className="mx-auto">
        <Navbar isLoaded={isLoaded} />
        {/* Header */}
        <div
          className={`text-left px-6 transition-all duration-1000 relative z-1 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
          }`}
        >
          {/* <Image src="/images/eye-black-and-white.png" alt="Logo" width={100} height={100} className="mx-auto mb-4" />  */}
          <div className="pt-[80px] pb-10">
            <div className="flex flex-col items-start">
              {/* Big title: split into three words so we can control layout responsively */}
              <div className="flex flex-col leading-none">
                <p className="font-specialGothicExpandedOne font-black text-4xl sm:text-7xl md:text-8xl lg:text-[10rem]">you</p>
                <p className="font-specialGothicExpandedOne font-black text-4xl sm:text-7xl md:text-8xl lg:text-[10rem] -mt-2">should</p>
                <p className="font-specialGothicExpandedOne font-black text-4xl sm:text-7xl md:text-8xl lg:text-[10rem] -mt-2">watch</p>
              </div>

              {/* Search blurb: always below the title */}
              <div className="mt-6 flex items-start">
                <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold max-w-md text-left ml-0 pb-2 border-b-4 border-background">
                  Search movies you like and let us recommend the perfect film for you to watch next!
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
            className={`transition-all duration-1000 ${isLoaded ? "translate-y-0" : "translate-y-10"}`}
          />
        </div>
        {/* Search */}
        <div
          className={`px-8 pt-10 text-center transition-all duration-700 relative z-10 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "300ms" }}
        >
          <p className="font-specialGothicExpandedOne text-3xl lg:text-6xl font-black uppercase mb-6">Search Movies </p>
          <h1 className="text-xl font-bold mb-10 w-full max-w-lg mx-auto text-center">
            Type in the name of a movie you like and we'll recommend the perfect movie for you to watch next
          </h1>
          <div className="w-full flex justify-center mb-10">
            <div ref={searchInputRef} className="max-w-md w-full">
              <SearchBar />
            </div>
          </div>
        </div>
        {/* Scenario */}
        <div
          className={`px-8 text-center mb-8 transition-all duration-700 relative z-1 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "300ms" }}
        >
          <p className="text-lg font-bold max-w-2xl mx-auto pb-2">or...</p>
          <p className="font-specialGothicExpandedOne text-3xl lg:text-6xl font-black uppercase mb-2">Choose Your</p>
          <p className="font-specialGothicExpandedOne text-3xl lg:text-6xl font-black uppercase mb-6">Scenario</p>
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
