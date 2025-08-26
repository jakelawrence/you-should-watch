"use client";

import { useState, useEffect } from "react";
import { NavigationBar } from "../components/navigation-bar";
import { MovieCard } from "../components/movie-card";
import { MovieCollection } from "../components/movie-collection";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Carousel } from "react-responsive-carousel";
import { Logo } from "../components/logo";
import { useMovieCollection } from "../context/MovieCollectionContext";
import "react-responsive-carousel/lib/styles/carousel.min.css";

export default function SuggestedFilmsPage() {
  const { collectionItems } = useMovieCollection();
  const [suggestedMovies, setSuggestedMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const loadSuggestedMovies = async () => {
      try {
        if (collectionItems.length == 0) {
          setError("No collection found. Please add movies to your collection first.");
          setLoading(false);
          return;
        }
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

  const handleGetSuggestedMovies = async () => {
    let slugs = collectionItems.map((movie) => movie.slug).join(",");
    try {
      router.push("/suggested-films");
    } catch (error) {
      console.error("Failed to fetch suggested movies:", error);
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < suggestedMovies.length - 1 ? prev + 1 : prev));
  };

  return (
    <div className="overflow-hidden bg-background text-text-primary">
      <main className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex justify-center px-4">
          <div className="w-full max-w-2xl lg:max-w-full lg:px-8">
            <Logo />

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
              <div className="max-w-2xl mx-auto">
                <Carousel
                  swipeable={true}
                  emulateTouch={true}
                  dynamicHeight={false}
                  infiniteLoop={true}
                  thumbWidth={50}
                  className="carousel-container"
                >
                  {suggestedMovies.map((film) => (
                    <div className="p-4 flex justify-center" key={film.slug}>
                      <img src={film.posterUrl.replace("-0-140-0-210-", "-0-1000-0-1500-")} alt={film.name} className="max-h-96 object-contain" />
                    </div>
                  ))}
                </Carousel>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
