"use client";

import React, { useState, useEffect } from "react";
import { X, SlidersHorizontal, RotateCcw } from "lucide-react";

export default function FilterModal({ isOpen, onClose, onApplyFilters, currentFilters = {} }) {
  const [filters, setFilters] = useState({
    popularity: "any", // "popular" | "hidden-gem" | "any"
    duration: "any", // "short" | "long" | "any"
    rating: "any", // "highly-rated" | "any"
    tone: "any", // "light" | "dark" | "any"
    style: "any", // "serious" | "funny" | "any"
    pace: "any", // "fast" | "slow" | "any"
    intensity: "any", // "mild" | "intense" | "any"
    releaseDecade: "any", // "2020s" | "2010s" | "2000s" | "90s" | "80s" | "older" | "any"
    genres: [], // Array of selected genre IDs
  });

  const [tempFilters, setTempFilters] = useState(filters);

  // Update temp filters when modal opens with current filters
  useEffect(() => {
    if (isOpen) {
      setTempFilters(currentFilters);
    }
  }, [isOpen, currentFilters]);

  if (!isOpen) return null;

  const handleReset = () => {
    const resetFilters = {
      popularity: "any",
      duration: "any",
      rating: "any",
      tone: "any",
      style: "any",
      pace: "any",
      intensity: "any",
      releaseDecade: "any",
      genres: [],
    };
    setTempFilters(resetFilters);
  };

  const handleApply = () => {
    onApplyFilters(tempFilters);
    onClose();
  };

  const toggleGenre = (genreId) => {
    setTempFilters((prev) => ({
      ...prev,
      genres: prev.genres.includes(genreId) ? prev.genres.filter((id) => id !== genreId) : [...prev.genres, genreId],
    }));
  };

  // Available genres with their TMDB IDs
  const availableGenres = [
    { id: 28, name: "Action" },
    { id: 12, name: "Adventure" },
    { id: 16, name: "Animation" },
    { id: 35, name: "Comedy" },
    { id: 80, name: "Crime" },
    { id: 99, name: "Documentary" },
    { id: 18, name: "Drama" },
    { id: 10751, name: "Family" },
    { id: 14, name: "Fantasy" },
    { id: 36, name: "History" },
    { id: 27, name: "Horror" },
    { id: 10402, name: "Music" },
    { id: 9648, name: "Mystery" },
    { id: 10749, name: "Romance" },
    { id: 878, name: "Science Fiction" },
    { id: 10770, name: "TV Movie" },
    { id: 53, name: "Thriller" },
    { id: 10752, name: "War" },
    { id: 37, name: "Western" },
  ];

  const FilterSection = ({ title, children }) => (
    <div className="mb-6">
      <h3 className="text-lg font-black text-black uppercase mb-3">{title}</h3>
      {children}
    </div>
  );

  const RadioGroup = ({ value, options, onChange }) => (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 font-bold text-sm uppercase border-3 border-black transition-all duration-200 ${
            value === option.value ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white border-4 border-black w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-4 border-black p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SlidersHorizontal size={32} strokeWidth={3} />
            <h2 className="text-3xl font-black text-black uppercase">Filters</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        {/* Filter Content */}
        <div className="p-6">
          {/* Popularity */}
          <FilterSection title="Popularity">
            <RadioGroup
              value={tempFilters.popularity}
              onChange={(val) => setTempFilters({ ...tempFilters, popularity: val })}
              options={[
                { value: "any", label: "Any" },
                { value: "popular", label: "Popular" },
                { value: "hidden-gem", label: "Hidden Gems" },
              ]}
            />
            <p className="text-xs font-bold text-gray-600 mt-2">Popular: Well-known movies | Hidden Gems: Lesser-known discoveries</p>
          </FilterSection>

          {/* Duration */}
          <FilterSection title="Movie Length">
            <RadioGroup
              value={tempFilters.duration}
              onChange={(val) => setTempFilters({ ...tempFilters, duration: val })}
              options={[
                { value: "any", label: "Any" },
                { value: "short", label: "Under 2 Hours" },
                { value: "long", label: "Over 2 Hours" },
              ]}
            />
          </FilterSection>

          {/* Rating */}
          <FilterSection title="Rating">
            <RadioGroup
              value={tempFilters.rating}
              onChange={(val) => setTempFilters({ ...tempFilters, rating: val })}
              options={[
                { value: "any", label: "Any" },
                { value: "highly-rated", label: "Highly Rated (3.5+)" },
              ]}
            />
          </FilterSection>

          {/* Tone (Darkness) */}
          <FilterSection title="Tone">
            <RadioGroup
              value={tempFilters.tone}
              onChange={(val) => setTempFilters({ ...tempFilters, tone: val })}
              options={[
                { value: "any", label: "Any" },
                { value: "light", label: "Light & Uplifting" },
                { value: "dark", label: "Dark & Heavy" },
              ]}
            />
            <p className="text-xs font-bold text-gray-600 mt-2">Based on themes, mood, and emotional weight</p>
          </FilterSection>

          {/* Style (Funniness) */}
          <FilterSection title="Style">
            <RadioGroup
              value={tempFilters.style}
              onChange={(val) => setTempFilters({ ...tempFilters, style: val })}
              options={[
                { value: "any", label: "Any" },
                { value: "serious", label: "Serious" },
                { value: "funny", label: "Comedy" },
              ]}
            />
          </FilterSection>

          {/* Pace (Slowness) */}
          <FilterSection title="Pace">
            <RadioGroup
              value={tempFilters.pace}
              onChange={(val) => setTempFilters({ ...tempFilters, pace: val })}
              options={[
                { value: "any", label: "Any" },
                { value: "fast", label: "Fast-Paced" },
                { value: "slow", label: "Slow Burn" },
              ]}
            />
            <p className="text-xs font-bold text-gray-600 mt-2">How quickly the story moves</p>
          </FilterSection>

          {/* Intensity */}
          <FilterSection title="Intensity">
            <RadioGroup
              value={tempFilters.intensity}
              onChange={(val) => setTempFilters({ ...tempFilters, intensity: val })}
              options={[
                { value: "any", label: "Any" },
                { value: "mild", label: "Mild & Relaxed" },
                { value: "intense", label: "Intense & Gripping" },
              ]}
            />
            <p className="text-xs font-bold text-gray-600 mt-2">Emotional and dramatic intensity</p>
          </FilterSection>

          {/* Release Decade */}
          <FilterSection title="Release Period">
            <RadioGroup
              value={tempFilters.releaseDecade}
              onChange={(val) => setTempFilters({ ...tempFilters, releaseDecade: val })}
              options={[
                { value: "any", label: "Any" },
                { value: "2020s", label: "2020s" },
                { value: "2010s", label: "2010s" },
                { value: "2000s", label: "2000s" },
                { value: "90s", label: "90s" },
                { value: "80s", label: "80s" },
                { value: "older", label: "Before 1980" },
              ]}
            />
          </FilterSection>

          {/* Genres */}
          <FilterSection title="Genres">
            <p className="text-xs font-bold text-gray-600 mb-3">Select specific genres (optional)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableGenres.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => toggleGenre(genre.id)}
                  className={`px-4 py-2 font-bold text-sm border-3 border-black transition-all duration-200 ${
                    tempFilters.genres.includes(genre.id) ? "bg-blue-500 text-white" : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  {genre.name}
                </button>
              ))}
            </div>
          </FilterSection>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t-4 border-black p-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleReset}
            className="flex-1 bg-white text-black px-6 py-4 font-black uppercase border-4 border-black hover:bg-gray-100 transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              boxShadow: "4px 4px 0px 0px #000000",
            }}
          >
            <RotateCcw size={20} strokeWidth={3} />
            Reset
          </button>

          <button
            onClick={handleApply}
            className="flex-1 bg-black text-white px-6 py-4 font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-all duration-200"
            style={{
              boxShadow: "4px 4px 0px 0px #000000",
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
