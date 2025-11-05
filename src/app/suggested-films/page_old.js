"use client";

import { useState, useEffect } from "react";
import { Logo } from "../components/logo";
import { useMovieCollection } from "../context/MovieCollectionContext";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { SuggestedMoviesCarousel } from "../components/suggested-movies-carousel";

export default function SuggestedFilmsPage() {
  const { collectionItems } = useMovieCollection();
  const [suggestedMovies, setSuggestedMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();

  const handleBackClick = () => {
    router.push("/"); // Navigate to main page
    // Alternative: router.back(); // Go back to previous page
  };

  useEffect(() => {
    const loadSuggestedMovies = async () => {
      try {
        if (collectionItems.length == 0) {
          setError("No collection found. Please add movies to your collection first.");
          setLoading(false);
          return;
        }
        const slugs = collectionItems.map((movie) => movie.slug).join(",");

        // // Fetch suggested movies
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

  return (
    <div className="overflow-hidden bg-background text-text-primary min-h-screen">
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={handleBackClick}
            className="flex items-center gap-2 text-text-primary hover:text-primary transition-colors duration-200 bg-secondary hover:bg-secondary/80 px-4 py-2 rounded-lg"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Home</span>
          </button>
        </div>

        {/* Content Container */}
        <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto">
          <Logo />

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center min-h-[300px] sm:min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Error State */}
          {error && <div className="text-center text-danger text-sm sm:text-lg p-4 sm:p-6 bg-danger/10 rounded-lg mx-4">{error}</div>}

          {/* Empty State */}
          {!loading && !error && suggestedMovies.length === 0 && (
            <div className="text-center text-text-secondary text-sm sm:text-lg p-4 sm:p-6 bg-secondary rounded-lg mx-4">
              No suggested movies found. Try adding more movies to your collection.
            </div>
          )}

          {/* Suggestions Carousel */}
          {!loading && !error && suggestedMovies.length > 0 && <SuggestedMoviesCarousel suggestedMovies={suggestedMovies} />}
        </div>
      </main>
    </div>
  );
}
