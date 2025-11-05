import React from "react";
import { Star, Plus, Minus } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";

export const MovieCard = ({ movie }) => {
  const { addToCollection, removeFromCollection } = useMovieCollection();
  return (
    <div className="w-36 h-52 sm:w-34 sm:h-54 md:w-36 md:h-52 lg:w-40 lg:h-56 xl:w-44 xl:h-64 bg-background rounded-lg overflow-hidden">
      <div className="relative">
        <img
          src={movie.posterUrl.replace("-0-70-0-105-", "-0-1000-0-1500-")}
          alt={movie.title}
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
