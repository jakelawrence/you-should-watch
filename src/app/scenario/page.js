"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Search, Heart, Sparkles, Smile } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";
import Navbar from "../components/Navbar";
import Loading from "../components/Loading";

export default function Scenarios() {
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
    <div className="min-h-screen bg-fadedBlack flex flex-col">
      <Navbar isLoaded={isLoaded} currentPage="search" />
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 p-8">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => handleScenarioClick(scenario)}
              className="bg-background border-4 border-fadedBlack rounded-lg p-6 flex flex-col items-center gap-4 hover:bg-blue-500 transition-colors duration-200"
            >
              <scenario.icon size={48} className="text-fadedBlack" />
              <p className="font-specialGothicExpandedOne text-fadedBlack text-xl font-bold uppercase">{scenario.title}</p>
              <p className="font-bold text-fadedBlack text-sm text-center">{scenario.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
