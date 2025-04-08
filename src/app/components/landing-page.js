"use client";

import { useState, useEffect, useRef } from "react";
import { NavigationBar } from "./navigation-bar";
import { MovieCollection } from "./movie-collection";
import { useRouter } from "next/navigation";
import { useDebounce } from "../hooks/useDebounce";
import { Search, Loader2 } from "lucide-react";
import addedToCollectionAlert from "./added-to-collection-alert";

export default function LandingPage() {
  const router = useRouter();

  const [collectionItems, setCollectionItems] = useState([]);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [hasShownCollection, setHasShownCollection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
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

  // Handle search when query changes
  useEffect(() => {
    const searchMovies = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      try {
        const response = await fetch(`/api/movies?name=${encodeURIComponent(debouncedSearchQuery)}&limit=10`);
        if (!response.ok) {
          throw new Error("Failed to search movies");
        }
        const data = await response.json();
        setSearchResults(data.movies || []);
        setShowDropdown(true);
      } catch (err) {
        setSearchError("Failed to search movies");
        console.error("Error searching movies:", err);
      } finally {
        setIsSearching(false);
      }
    };

    searchMovies();
  }, [debouncedSearchQuery]);

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

  // Calculate max height for dropdown
  useEffect(() => {
    const updateDropdownMaxHeight = () => {
      if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.top;
        const maxHeight = Math.min(spaceBelow - 20, 400); // 20px padding from bottom, max 400px
        dropdownRef.current.style.maxHeight = `${maxHeight}px`;
      }
    };

    if (showDropdown) {
      updateDropdownMaxHeight();
      window.addEventListener("resize", updateDropdownMaxHeight);
    }

    return () => {
      window.removeEventListener("resize", updateDropdownMaxHeight);
    };
  }, [showDropdown]);

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

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <NavigationBar collectionItemsCount={collectionItems.length} onCollectionClick={() => setIsCollectionOpen(!isCollectionOpen)} />
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-2xl mx-auto px-4">
          <div className="max-w-fit mx-auto">
            <h2 className="text-lg font-semibold mb-4 ml-2">welcome to...</h2>
            <h1 className="text-5xl font-bold mb-6">the movie plug</h1>
          </div>

          <div className="relative" ref={searchInputRef}>
            <form onSubmit={(e) => e.preventDefault()} className="relative">
              <div className="relative">
                <Search className="text-purple-600 absolute left-4 top-1/2 -translate-y-1/2" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for movies..."
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-lg transition-all"
                />
              </div>
            </form>

            {showDropdown && searchResults.length > 0 && (
              <div ref={dropdownRef} className="absolute z-10 w-full mt-2 bg-background rounded-xl shadow-lg border border-border overflow-y-auto">
                {searchResults.map((movie) => (
                  <button
                    key={movie.slug}
                    onClick={() => addToCollection(movie)}
                    className="w-full px-4 py-3 text-left hover:bg-secondary/50 transition-colors flex items-center justify-between border-b border-border last:border-0"
                  >
                    <div>
                      <div className="font-medium text-text-primary">{movie.name}</div>
                      <div className="text-sm text-text-secondary">{movie.year}</div>
                    </div>
                    <div className="text-primary font-medium">+</div>
                  </button>
                ))}
              </div>
            )}

            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="animate-spin text-primary" size={20} />
              </div>
            )}

            {searchError && <div className="mt-2 text-danger text-sm bg-danger/10 px-3 py-2 rounded-lg inline-block">{searchError}</div>}
          </div>
        </div>
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
