"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Search, Heart, Sparkles, Smile } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";

function ChooseScenarioContent() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const { resetCollection } = useMovieCollection();

  useEffect(() => {
    setIsLoaded(true);
    resetCollection();
  }, []);

  const scenarios = [
    {
      id: "find-similar",
      title: "find similar",
      description: "Discover movies like one you love",
      icon: Search,
      route: "/add-movies?scenario=find-similar",
    },
    {
      id: "date-night",
      title: "date night",
      description: "Find the perfect compromise",
      icon: Heart,
      route: "/add-movies?scenario=date-night",
    },
    {
      id: "surprise-me",
      title: "surprise me",
      description: "Let AI pick something unexpected",
      icon: Sparkles,
      route: "/suggestions?scenario=surprise-me",
    },
    {
      id: "mood-match",
      title: "mood match",
      description: "Choose based on how you feel",
      icon: Smile,
      route: "/movie-mood?scenario=mood-match",
    },
  ];

  const handleScenarioClick = (scenario) => {
    // Route to Add Movies page with scenario parameter
    router.push(scenario.route);
  };

  useEffect(() => {
    //reset movie collection when arriving on this page
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
      {/* Large Title */}
      <div className="text-center mb-12 lg:mb-16">
        <h1
          className={`text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-black text-black leading-none transition-all duration-1000 ${
            isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
          }`}
        >
          choose your
        </h1>
        <h1
          className={`text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-black text-black leading-none transition-all duration-1000 ${
            isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
          }`}
          style={{ transitionDelay: "100ms" }}
        >
          scenario
        </h1>
      </div>

      {/* Scenario Grid */}
      <div
        className={`w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-6 transition-all duration-700 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
        style={{ transitionDelay: "300ms" }}
      >
        {scenarios.map((scenario, index) => {
          const Icon = scenario.icon;
          return (
            <button
              key={scenario.id}
              onClick={() => handleScenarioClick(scenario)}
              className="bg-white border-4 border-black p-8 lg:p-12 text-left hover:bg-black hover:text-white transition-all duration-300 group"
            >
              <Icon className="mb-4 text-black group-hover:text-white transition-colors" size={40} strokeWidth={3} />
              <h2 className="text-3xl lg:text-4xl font-black uppercase mb-3 text-black group-hover:text-white transition-colors">{scenario.title}</h2>
              <p className="text-lg font-bold text-black group-hover:text-white transition-colors">{scenario.description}</p>
            </button>
          );
        })}
      </div>

      {/* Back to Home Link */}
      <button
        onClick={() => router.push("/")}
        className={`mt-12 mb-6 text-black font-bold text-lg hover:underline transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDelay: "500ms" }}
      >
        ← Back to Home
      </button>
    </div>
  );
}

export default function ChooseScenarioPage() {
  return (
    <Suspense fallback={null}>
      <ChooseScenarioContent />
    </Suspense>
  );
}
