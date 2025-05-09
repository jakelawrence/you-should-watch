"use client";

import { useState, useEffect, useRef } from "react";
import { NavigationBar } from "./components/navigation-bar";
import { MovieCollection } from "./components/movie-collection";
import { useRouter } from "next/navigation";
import { Loading } from "./components/loading";
import { LandingPage } from "./components/landing-page";
import { useMovieCollection } from "./contexts/MovieCollectionContext";
import addedToCollectionAlert from "./components/added-to-collection-alert";

export default function Home() {
  const router = useRouter();

  // Use the movie collection context instead of local state
  const {
    collectionItems,
    isCollectionOpen,
    closeCollection,
    removeFromCollection,
    addToCollection,
    fetchingSuggestedMovies,
    handleGetSuggestedMovies,
  } = useMovieCollection();

  const [searchQuery, setSearchQuery] = useState("");

  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const { CollectionAlert } = addedToCollectionAlert();
  const searchInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (fetchingSuggestedMovies) {
    return (
      <main className="flex text-center items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loading />
      </main>
    );
  }

  return (
    <>
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <LandingPage
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showDropdown={showDropdown}
          searchResults={searchResults}
          addToCollection={addToCollection}
          isSearching={isSearching}
          setIsSearching={setIsSearching}
          searchError={searchError}
          setSearchError={setSearchError}
          setShowDropdown={setShowDropdown}
          setSearchResults={setSearchResults}
        />
      </main>
      <CollectionAlert />
    </>
  );
}
