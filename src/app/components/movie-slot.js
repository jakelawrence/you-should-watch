import React from "react";
import { Star, Plus } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";

export const MovieSlot = ({ index }) => {
  return (
    <div
      key={`placeholder-${index}`}
      className="w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 lg:w-28 lg:h-40 xl:w-32 xl:h-48 flex items-center justify-center rounded-lg text-text-secondary text-xs sm:text-sm bg-foreground"
    >
      <div className="text-center">
        <Plus size={12} className="sm:size-14 md:size-16 lg:size-18 xl:size-20 mx-auto mb-1 opacity-50" />
        <span className="text-xs sm:text-sm">Add Movie</span>
      </div>
    </div>
  );
};
