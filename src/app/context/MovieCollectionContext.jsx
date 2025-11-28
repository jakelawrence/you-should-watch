"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
const MovieCollectionContext = createContext(null);

export function MovieCollectionProvider({ children }) {
  const router = useRouter();
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [isCollectionMinimized, setIsCollectionMinimized] = useState(false);
  const [collectionItems, setCollectionItems] = useState([]);
  const [isGettingSuggestions, setIsGettingSuggestions] = useState(false);

  console.log("isCollectionOpen=" + isCollectionOpen);
  const handleGetSuggestedMovies = async () => {
    try {
      router.push("/suggested-films");
    } catch (error) {
      console.error("Failed to fetch suggested movies:", error);
    }
  };

  const addToCollection = (movie) => {
    if (collectionItems.length >= 4) {
      alert("Your collection is limited to 4 movies maximum.");
      return;
    }
    console.log("Adding movie to collection: " + movie.title);
    if (!collectionItems.find((item) => item.slug === movie.slug)) {
      setCollectionItems([...collectionItems, movie]);
      setIsCollectionOpen(true);
      if (isCollectionMinimized) {
        setIsCollectionMinimized(false);
      }
    }
  };

  const removeFromCollection = (movie) => {
    console.log("Removing movie from collection: " + movie.title);
    console.log(collectionItems);
    let movieIdx = collectionItems.findIndex((item) => item.slug === movie.slug);
    console.log("movieIdx=" + movieIdx);
    if (movieIdx !== -1) {
      const updatedItems = [...collectionItems]; // Create a new array
      updatedItems.splice(movieIdx, 1); // Remove 1 item at movieIdx
      console.log(updatedItems);
      setCollectionItems(updatedItems);
    }
  };

  const value = {
    collectionItems,
    setCollectionItems,
    isCollectionOpen,
    setIsCollectionOpen,
    isCollectionMinimized,
    setIsCollectionMinimized,
    addToCollection,
    removeFromCollection,
    handleGetSuggestedMovies,
    isGettingSuggestions,
  };

  return <MovieCollectionContext.Provider value={value}>{children}</MovieCollectionContext.Provider>;
}
export function useMovieCollection() {
  const context = useContext(MovieCollectionContext);
  if (!context) throw new Error("useMovieCollection must be used within MovieCollectionProvider");
  return context;
}
