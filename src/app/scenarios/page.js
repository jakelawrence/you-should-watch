"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMovieCollection } from "../context/MovieCollectionContext";
import { Navbar } from "../components/Navbar";
import { SCENARIOS } from "../api/lib/scenarios";

export default function Scenarios() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const { resetCollection } = useMovieCollection();

  useEffect(() => {
    setIsLoaded(true);
    resetCollection();
  }, []);

  const handleScenarioClick = (scenario) => {
    router.push(scenario.route);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar isLoaded={isLoaded} />
      <div className={`flex-1 transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
        <div className="px-4 md:px-8 pt-8 pb-8">
          <div className={`transition-all duration-1000 ${isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"}`}>
            <h1 className="font-specialGothicExpandedOne text-fadedBlack text-5xl sm:text-6xl lg:text-7xl uppercase leading-none">choose your</h1>
            <h2 className="font-specialGothicExpandedOne text-fadedBlack text-5xl sm:text-6xl lg:text-7xl uppercase leading-none">scenario</h2>
          </div>
        </div>

        <div className="px-4 md:px-8 pb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.key}
                onClick={() => handleScenarioClick(scenario)}
                className="bg-background hover:bg-fadedBlack border border-fadedBlack/15 p-6 flex flex-col items-start gap-4 transition-colors duration-200 group"
              >
                <scenario.icon size={48} className="text-fadedBlack group-hover:text-background transition-colors" />
                <p className="font-specialGothicExpandedOne text-fadedBlack text-xl font-bold uppercase group-hover:text-background transition-colors">{scenario.label}</p>
                <p className="font-bold text-fadedBlack text-sm text-left group-hover:text-background transition-colors">{scenario.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
