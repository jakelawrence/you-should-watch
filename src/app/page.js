"use client";

import { useState, useEffect, useRef } from "react";
import { NavigationBar } from "./components/navigation-bar";
import { MovieCollection } from "./components/movie-collection";
import { useRouter } from "next/navigation";
import addedToCollectionAlert from "./components/added-to-collection-alert";
import { Loading } from "./components/loading";
import { LandingPage } from "./components/landing-page";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef(null);
  const { showCollectionAlert, CollectionAlert } = addedToCollectionAlert();

  return (
    <div className="overflow-hidden bg-background text-text-primary">
      <main className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <LandingPage
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showDropdown={showDropdown}
          searchResults={searchResults}
          isSearching={isSearching}
          setIsSearching={setIsSearching}
          searchError={searchError}
          setSearchError={setSearchError}
          setShowDropdown={setShowDropdown}
          setSearchResults={setSearchResults}
        />
        <CollectionAlert />
      </main>
    </div>
  );
}
