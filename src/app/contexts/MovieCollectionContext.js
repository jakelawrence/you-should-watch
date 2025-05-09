"use client";

import { createContext, useContext, useState, useEffect } from "react";
import addedToCollectionAlert from "../components/added-to-collection-alert";
import { useRouter } from "next/navigation";

// Create the context
const MovieCollectionContext = createContext();

// Create a custom hook to use the context
export const useMovieCollection = () => {
  return useContext(MovieCollectionContext);
};

// Create the provider
export function MovieCollectionProvider({ children }) {
  const router = useRouter();
  const [collectionItems, setCollectionItems] = useState([]);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [hasShownCollection, setHasShownCollection] = useState(false);
  const [fetchingSuggestedMovies, setFetchingSuggestedMovies] = useState(false);
  const { showCollectionAlert, CollectionAlert } = addedToCollectionAlert();

  // Load collection from sessionStorage on mount
  useEffect(() => {
    const savedCollection = sessionStorage.getItem("userCollection");
    if (savedCollection) {
      try {
        setCollectionItems(JSON.parse(savedCollection));
      } catch (error) {
        console.error("Failed to parse collection from sessionStorage:", error);
      }
    }
  }, []);

  // Save collection to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem("userCollection", JSON.stringify(collectionItems));
  }, [collectionItems]);

  const addToCollection = (movie) => {
    if (collectionItems.length >= 5) {
      console.log("here in alert");
      showCollectionAlert("Your collection is limited to 5 movies maximum.", "error");
      return;
    }

    if (!collectionItems.find((item) => item.slug === movie.slug)) {
      setCollectionItems([...collectionItems, movie]);
      if (!hasShownCollection) setIsCollectionOpen(true);
      if (hasShownCollection) showCollectionAlert(`${movie.name} added to cart!`, "success");
      setHasShownCollection(true);
    } else {
      showCollectionAlert(`${movie.name} has already been added to cart.`, "warning");
    }
  };

  const removeFromCollection = (movie) => {
    setCollectionItems(collectionItems.filter((item) => item.slug !== movie.slug));
  };

  const toggleCollection = () => {
    setIsCollectionOpen(!isCollectionOpen);
  };

  const closeCollection = () => {
    setIsCollectionOpen(false);
  };

  const handleGetSuggestedMovies = async () => {
    console.log("here in the function");
    let slugs = collectionItems.map((movie) => movie.slug).join(",");
    try {
      // setFetchingSuggestedMovies(true);
      // const suggestedMoviesResponse = await fetch("/api/getSuggestedMovies?slugs=" + slugs);
      // const suggestedMoviesData = await suggestedMoviesResponse.json();

      // // Store suggested movies in sessionStorage
      // sessionStorage.setItem("suggestedMovies", JSON.stringify(suggestedMoviesData));
      // setFetchingSuggestedMovies(false);
      // // Navigate to the suggested films page
      router.push("/suggested-films");
    } catch (error) {
      console.error("Failed to fetch suggested movies:", error);
    }
  };

  // The values we want to expose through the context
  const value = {
    collectionItems,
    isCollectionOpen,
    setIsCollectionOpen,
    addToCollection,
    removeFromCollection,
    toggleCollection,
    closeCollection,
    CollectionAlert,
    showCollectionAlert,
    handleGetSuggestedMovies,
    fetchingSuggestedMovies,
  };

  return <MovieCollectionContext.Provider value={value}>{children}</MovieCollectionContext.Provider>;
}
