"use client";

import { useState, useEffect } from "react";
import { NavigationBar } from "../components/navigation-bar";
import { MovieCard } from "../components/movie-card";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function SuggestedFilmsPage() {
  const [suggestedMovies, setSuggestedMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const loadSuggestedMovies = async () => {
      try {
        // Get the slugs from sessionStorage
        const savedCollection = sessionStorage.getItem("userCollection");
        if (!savedCollection) {
          setError("No collection found. Please add movies to your collection first.");
          setLoading(false);
          return;
        }

        const collectionItems = JSON.parse(savedCollection);
        const slugs = collectionItems.map((movie) => movie.slug).join(",");

        // Fetch suggested movies
        const response = await fetch(`/api/getSuggestedMovies?slugs=${slugs}`);
        if (!response.ok) {
          throw new Error("Failed to fetch suggested movies");
        }

        const data = await response.json();
        setSuggestedMovies(data);
      } catch (err) {
        setError("Failed to load suggested movies");
        console.error("Error loading suggested movies:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestedMovies();
  }, []);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < suggestedMovies.length - 1 ? prev + 1 : prev));
  };

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <NavigationBar />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Suggested Films</h1>
          <p className="text-text-secondary">Based on your collection</p>
        </div>

        {loading && (
          <div className="flex justify-center items-center min-h-[200px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}

        {error && <div className="text-center text-danger text-lg p-4 bg-danger/10 rounded-lg">{error}</div>}

        {!loading && !error && suggestedMovies.length === 0 && (
          <div className="text-center text-text-secondary text-lg p-4 bg-secondary rounded-lg">
            No suggested movies found. Try adding more movies to your collection.
          </div>
        )}

        {!loading && !error && suggestedMovies.length > 0 && (
          <div className="relative max-w-lg mx-auto">
            <div className="movie-card">
              <MovieCard movie={suggestedMovies[currentIndex]} />
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className={`p-2 rounded-full ${
                  currentIndex === 0 ? "bg-primary text-white hover:bg-primary-light cursor-not-allowed" : "bg-secondary text-text-secondary"
                }`}
              >
                <ChevronLeft size={24} />
              </button>

              <span className="text-text-secondary">
                {currentIndex + 1} of {suggestedMovies.length}
              </span>

              <button
                onClick={handleNext}
                disabled={currentIndex === suggestedMovies.length - 1}
                className={`p-2 rounded-full ${
                  currentIndex === suggestedMovies.length - 1
                    ? "bg-primary text-white hover:bg-primary-light cursor-not-allowed"
                    : "bg-secondary text-text-secondary "
                }`}
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
