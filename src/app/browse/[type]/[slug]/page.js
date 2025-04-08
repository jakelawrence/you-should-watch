"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { NavigationBar } from "../../../components/navigation-bar";
import { MovieCollection } from "../../../components/movie-collection";
import { MovieCard } from "../../../components/movie-card";
import Link from "next/link";

export default function GenrePage() {
  const params = useParams();
  const { type, slug } = params;
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collectionItems, setCollectionItems] = useState([]);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [isCollectionMinimized, setIsCollectionMinimized] = useState(false);
  const [title, setTitle] = useState("");

  // Load collection from sessionStorage on mount
  useEffect(() => {
    const savedCollection = sessionStorage.getItem("userCollection");
    if (savedCollection) {
      setCollectionItems(JSON.parse(savedCollection));
    }
  }, []);

  // Save collection to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem("userCollection", JSON.stringify(collectionItems));
  }, [collectionItems]);

  // Fetch movies for the genre/nanogenre
  useEffect(() => {
    const fetchMovies = async () => {
      try {
        setLoading(true);
        const queryParam = type === "genre" ? "genre" : "nanogenre";
        const response = await fetch(`/api/movies?${queryParam}=${encodeURIComponent(slug)}&limit=50`);

        if (!response.ok) {
          throw new Error("Failed to fetch movies");
        }

        const data = await response.json();
        setMovies(data.movies || []);

        // Set the title based on the type and slug
        const formattedTitle =
          type === "genre"
            ? slug
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")
            : slug
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(", ");
        setTitle(formattedTitle);
      } catch (err) {
        console.error("Error fetching movies:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [type, slug]);

  const addToCollection = (movie) => {
    if (collectionItems.length >= 5) {
      alert("Your collection is limited to 5 movies maximum.");
      return;
    }

    if (!collectionItems.find((item) => item.slug === movie.slug)) {
      setCollectionItems([...collectionItems, movie]);
      setIsCollectionOpen(true);
      if (isCollectionMinimized) {
        setIsCollectionMinimized(false);
      }
    }
  };

  const removeFromCollection = (movie) => {
    setCollectionItems(collectionItems.filter((item) => item.slug !== movie.slug));
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-background text-text-primary`}>
        <NavigationBar collectionItemsCount={collectionItems.length} onCollectionClick={() => setIsCollectionOpen(!isCollectionOpen)} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse text-text-secondary">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-background text-text-primary`}>
        <NavigationBar collectionItemsCount={collectionItems.length} onCollectionClick={() => setIsCollectionOpen(!isCollectionOpen)} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-danger bg-danger/10 px-4 py-2 rounded-lg">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background text-text-primary`}>
      <NavigationBar collectionItemsCount={collectionItems.length} onCollectionClick={() => setIsCollectionOpen(!isCollectionOpen)} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/browse" className="mb-4 inline-block">
                ← Back to Browse
              </Link>
              <h1 className="text-3xl font-bold mt-2">{title}</h1>
              <p className="mt-2">{movies.length} movies found</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {movies.map((movie) => (
              <MovieCard
                key={movie.slug}
                movie={movie}
                onAddToCollection={() => addToCollection(movie)}
                isInCollection={collectionItems.some((item) => item.slug === movie.slug)}
              />
            ))}
          </div>
        </div>
      </main>

      <MovieCollection
        isOpen={isCollectionOpen}
        onClose={() => setIsCollectionOpen(false)}
        isMinimized={isCollectionMinimized}
        onToggleMinimize={() => setIsCollectionMinimized(!isCollectionMinimized)}
        items={collectionItems}
        onRemove={removeFromCollection}
      />
    </div>
  );
}
