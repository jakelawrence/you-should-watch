import React from "react";
import { Star, Plus, Minus } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";

export const MovieCard = ({ movie }) => {
  const { addToCollection, removeFromCollection } = useMovieCollection();
  return (
    <div className="w-40 h-64 sm:w-20 sm:h-28 md:w-24 md:h-36 lg:w-28 lg:h-40 xl:w-32 xl:h-48 bg-background rounded-lg overflow-hidden">
      <div className="relative">
        <img
          src={movie.posterUrl.replace("-0-140-0-210-", "-0-1000-0-1500-")}
          alt={movie.name}
          className="w-full h-full object-cover rounded-t-lg"
          loading="lazy"
        />

        {/* Remove button */}
        <button
          onClick={() => removeFromCollection(movie)}
          className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 md:top-2 md:right-2 bg-red-500/90 hover:bg-red-600/90 text-white rounded-full p-0.5 sm:p-1 transition-colors duration-200 shadow-sm"
        >
          <Minus size={8} className="sm:size-7 md:size-5 lg:size-5" />
        </button>
      </div>
    </div>
  );
};
