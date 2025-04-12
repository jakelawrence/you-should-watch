"use client";

import { useState, useEffect, useRef } from "react";
import { NavigationBar } from "./components/navigation-bar";
import { MovieCollection } from "./components/movie-collection";
import { useRouter } from "next/navigation";
import addedToCollectionAlert from "./components/added-to-collection-alert";
import { Loading } from "./components/loading";
import { LandingPage } from "./components/landing-page";

export default function Home() {
  const router = useRouter();

  const [collectionItems, setCollectionItems] = useState([]);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [hasShownCollection, setHasShownCollection] = useState(false);
  const [fetchingSuggestedMovies, setFetchingSuggestedMovies] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef(null);
  const { showCollectionAlert, CollectionAlert } = addedToCollectionAlert();

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

  const addToCollection = (movie) => {
    if (collectionItems.length >= 5) {
      showCollectionAlert("Your collection is limited to 5 movies maximum.", "error");
      return;
    }

    if (!collectionItems.find((item) => item.slug === movie.slug)) {
      setCollectionItems([...collectionItems, movie]);
      if (!hasShownCollection) setIsCollectionOpen(true);

      setSearchQuery("");
      setSearchResults([]);
      setShowDropdown(false);
      if (hasShownCollection) showCollectionAlert(`${movie.name} added to cart!`, "success");
      setHasShownCollection(true);
    } else {
      showCollectionAlert(`${movie.name} has already been added to cart.`, "warning");
    }
  };

  const removeFromCollection = (movie) => {
    setCollectionItems(collectionItems.filter((item) => item.slug !== movie.slug));
  };

  const handleGetSuggestedMovies = async () => {
    let slugs = collectionItems.map((movie) => movie.slug).join(",");
    try {
      setFetchingSuggestedMovies(true);
      const suggestedMoviesResponse = await fetch("/api/getSuggestedMovies?slugs=" + slugs);
      const suggestedMoviesData = await suggestedMoviesResponse.json();

      // Store suggested movies in sessionStorage
      sessionStorage.setItem("suggestedMovies", JSON.stringify(suggestedMoviesData));

      // Navigate to the suggested films page
      router.push("/suggested-films");
    } catch (error) {
      console.error("Failed to fetch suggested movies:", error);
    }
  };

  if (fetchingSuggestedMovies) {
    return (
      <div className={`min-h-screen bg-background text-text-primary`}>
        <NavigationBar collectionItemsCount={collectionItems.length} onCollectionClick={() => setIsCollectionOpen(!isCollectionOpen)} />
        <main className="flex text-center items-center justify-center min-h-[calc(100vh-4rem)]">
          <Loading />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <NavigationBar collectionItemsCount={collectionItems.length} onCollectionClick={() => setIsCollectionOpen(!isCollectionOpen)} />
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
        <CollectionAlert />
      </main>
      <MovieCollection
        isOpen={isCollectionOpen}
        onClose={() => setIsCollectionOpen(false)}
        items={collectionItems}
        onRemove={removeFromCollection}
        onGetSuggestions={handleGetSuggestedMovies}
      />
    </div>
  );
}
