import React, { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Film, X } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";
import { MovieCard } from "./movie-card";
import { MovieSlot } from "./movie-slot";

export const MovieDrawer = () => {
  const drawerRef = useRef(null);
  const { isCollectionOpen, setIsCollectionOpen, isCollectionMinimized, collectionItems, handleGetSuggestedMovies, removeFromCollection } =
    useMovieCollection();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isCollectionOpen && drawerRef.current && !drawerRef.current.contains(event.target)) {
        setIsCollectionOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCollectionOpen, () => setIsCollectionOpen(false)]);

  return (
    <div className="w-full overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center p-2 sm:p-4">
        {[...collectionItems, ...Array(4 - collectionItems.length).fill(null)].map((movie, index) =>
          movie ? <MovieCard key={movie.slug} movie={movie} /> : <MovieSlot key={`placeholder-${index}`} index={index} />
        )}
      </div>
    </div>
  );
};
