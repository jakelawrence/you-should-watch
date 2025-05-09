"use client";

import { useState, useEffect } from "react";
import { NavigationBar } from "../components/navigation-bar";
import { MoviePoster } from "../components/movie-poster";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { MdOutlineKeyboardArrowLeft, MdOutlineKeyboardArrowRight } from "react-icons/md";
import { useMovieCollection } from "../contexts/MovieCollectionContext";
import addedToCollectionAlert from "../components/added-to-collection-alert";

export default function SuggestedFilmsPage() {
  const [suggestedMovies, setSuggestedMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { collectionItems } = useMovieCollection();
  const { CollectionAlert } = addedToCollectionAlert();

  useEffect(() => {
    const loadSuggestedMovies = async () => {
      try {
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

  return (
    <>
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
          <div className="max-w-2xl mx-auto select-none">
            <Carousel
              swipeable={true}
              emulateTouch={true}
              dynamicHeight={false}
              infiniteLoop={true}
              thumbWidth={50}
              renderArrowPrev={(clickHandler, hasPrev) => {
                return (
                  <div
                    className={`${
                      hasPrev ? "absolute" : "hidden"
                    } top-0 bottom-0 left-0 flex justify-center items-center p-3 opacity-30 hover:opacity-100 cursor-pointer z-20`}
                    onClick={clickHandler}
                  >
                    <MdOutlineKeyboardArrowLeft className="w-9 h-9 text-dark" />
                  </div>
                );
              }}
              renderArrowNext={(clickHandler, hasNext) => {
                return (
                  <div
                    className={`${
                      hasNext ? "absolute" : "hidden"
                    } top-0 bottom-0 right-0 flex justify-center items-center p-3 opacity-30 hover:opacity-100 cursor-pointer z-20`}
                    onClick={clickHandler}
                  >
                    <MdOutlineKeyboardArrowRight className="w-9 h-9 text-dark" />
                  </div>
                );
              }}
              className="carousel-container"
            >
              {suggestedMovies.map((movie) => (
                <img src={movie.posterUrl.replace("-0-140-0-210-", "-0-1000-0-1500-")} alt={movie.name} className="max-h-96 object-contain" />
              ))}
            </Carousel>
          </div>
        )}
      </main>
      <CollectionAlert />
    </>
  );
}
