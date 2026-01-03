"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function MovieMoodContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenario");
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedMoods, setSelectedMoods] = useState({});

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const moodOptions = [
    {
      id: "tone",
      question: "light or dark?",
      options: [
        { value: "light", label: "light" },
        { value: "dark", label: "dark" },
      ],
    },
    {
      id: "style",
      question: "serious or comedy?",
      options: [
        { value: "serious", label: "serious" },
        { value: "comedy", label: "comedy" },
      ],
    },
    {
      id: "popularity",
      question: "popular or hidden gem?",
      options: [
        { value: "popular", label: "popular" },
        { value: "hidden-gem", label: "hidden gem" },
      ],
    },
    {
      id: "duration",
      question: "long or short?",
      options: [
        { value: "long", label: "long" },
        { value: "short", label: "short" },
      ],
    },
    {
      id: "pace",
      question: "fast or slow?",
      options: [
        { value: "fast", label: "fast-paced" },
        { value: "slow", label: "slow-burn" },
      ],
    },
    {
      id: "emotion",
      question: "uplifting or intense?",
      options: [
        { value: "uplifting", label: "uplifting" },
        { value: "intense", label: "intense" },
      ],
    },
  ];

  const handleMoodSelect = (categoryId, value) => {
    setSelectedMoods((prev) => ({
      ...prev,
      [categoryId]: value,
    }));
  };

  const handleContinue = () => {
    // Convert selected moods to URL params
    const moodParams = new URLSearchParams();
    Object.entries(selectedMoods).forEach(([key, value]) => {
      moodParams.append(key, value);
    });

    // Navigate to add-movies with scenario and mood preferences
    router.push(`/suggestions?scenario=${scenarioId}&${moodParams.toString()}`);
  };

  const allCategoriesSelected = moodOptions.every((category) => selectedMoods[category.id]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 py-8 lg:py-16">
      {/* Large Title */}
      <div className="text-center mb-12 lg:mb-16">
        <p
          className={`text-lg lg:text-xl font-bold text-black mb-4 transition-all duration-1000 ${
            isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
          }`}
        >
          what mood?
        </p>
        <h1
          className={`text-5xl sm:text-6xl lg:text-7xl font-black text-black leading-none transition-all duration-1000 ${
            isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
          }`}
        >
          pick your vibe
        </h1>
      </div>

      {/* Mood Options Grid */}
      <div
        className={`w-full max-w-4xl space-y-8 mb-12 transition-all duration-700 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
        style={{ transitionDelay: "300ms" }}
      >
        {moodOptions.map((category, index) => (
          <div key={category.id} className="space-y-4">
            {/* Question */}
            <h2 className="text-2xl lg:text-3xl font-black text-black uppercase text-center">{category.question}</h2>

            {/* Options */}
            <div className="grid grid-cols-2 gap-4">
              {category.options.map((option) => {
                const isSelected = selectedMoods[category.id] === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleMoodSelect(category.id, option.value)}
                    className={`border-4 border-black p-6 lg:p-8 text-center font-black text-xl lg:text-2xl uppercase transition-all duration-300 ${
                      isSelected ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Continue Button */}
      {allCategoriesSelected && (
        <button
          onClick={handleContinue}
          className={`bg-black text-white px-12 py-6 text-2xl font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-all duration-200 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{
            transitionDelay: "500ms",
          }}
        >
          Continue
        </button>
      )}

      {/* Back to Scenario Link */}
      <button
        onClick={() => router.push("/scenario")}
        className={`mt-8 mb-6 text-black font-bold text-lg hover:underline transition-all duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDelay: "600ms" }}
      >
        ← Back to Scenario
      </button>
    </div>
  );
}

export default function MovieMoodPage() {
  return (
    <Suspense fallback={null}>
      <MovieMoodContent />
    </Suspense>
  );
}
