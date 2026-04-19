"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
const MovieCollectionContext = createContext(null);

export function MovieCollectionProvider({ children }) {
  const router = useRouter();
  const [collectionItems, setCollectionItems] = useState([]);
  const [collectionError, setCollectionError] = useState(null);

  const handleGetSuggestedMovies = async () => {
    try {
      router.push("/suggested-films");
    } catch (error) {
      console.error("Failed to fetch suggested movies:", error);
    }
  };

  const addToCollection = (movie) => {
    if (collectionItems.length >= 4) {
      setCollectionError("Your collection is limited to 4 movies.");
      setTimeout(() => setCollectionError(null), 3000);
      return;
    }
    if (!collectionItems.find((item) => item.slug === movie.slug)) {
      setCollectionItems([...collectionItems, movie]);
    }
  };

  const removeFromCollection = (movie) => {
    const movieIdx = collectionItems.findIndex((item) => item.slug === movie.slug);
    if (movieIdx !== -1) {
      const updatedItems = [...collectionItems];
      updatedItems.splice(movieIdx, 1);
      setCollectionItems(updatedItems);
    }
  };

  const resetCollection = () => {
    setCollectionItems([]);
  };

  const value = {
    collectionItems,
    collectionError,
    setCollectionItems,
    addToCollection,
    removeFromCollection,
    resetCollection,
  };

  return <MovieCollectionContext.Provider value={value}>{children}</MovieCollectionContext.Provider>;
}
export function useMovieCollection() {
  const context = useContext(MovieCollectionContext);
  if (!context) throw new Error("useMovieCollection must be used within MovieCollectionProvider");
  return context;
}
