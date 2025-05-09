import React from "react";
import { Star, Plus } from "lucide-react";
import { useMovieCollection } from "../contexts/MovieCollectionContext";

export const MoviePoster = ({ movie }) => {
  const { addToCollection } = useMovieCollection();
  return (
    <div className="relative">
      <img
        src={movie.posterUrl.replace("-0-140-0-210-", "-0-1000-0-1500-")}
        alt={movie.name}
        className="w-full h-full object-contain rounded-xl"
        loading="lazy"
      />
      <button
        onClick={() => addToCollection(movie)}
        className="absolute top-2 right-2 p-1 bg-white text-white rounded-full cursor-pointer"
        aria-label={`Add ${movie.name} to collection`}
      >
        <Plus size={25} className="text-purple-600" />
      </button>
      {movie.rating && (
        <div className="absolute bottom-2 left-2 bg-background/90 text-text-primary px-2 py-1 rounded-lg flex items-center text-sm shadow-sm">
          <Star size={16} className="mr-1 text-yellow-400" /> {movie.rating.toFixed(1)}
        </div>
      )}
    </div>
  );
};
