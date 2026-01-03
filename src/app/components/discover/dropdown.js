import React from "react";
import { useMovieCollection } from "../../context/MovieCollectionContext";

export const Dropdown = ({ dropdownRef, searchResults, onMovieAdded }) => {
  const { addToCollection } = useMovieCollection();

  const handleAddMovie = (movie) => {
    addToCollection(movie);
    if (onMovieAdded) {
      onMovieAdded(); // This will clear the search
    }
  };

  return (
    <div ref={dropdownRef} className="border-4 border-black bg-white overflow-y-auto max-h-[420px] w-[270px] lg:w-[320px]">
      {searchResults.map((movie, idx) => (
        <button
          key={idx}
          onClick={() => handleAddMovie(movie)}
          className="w-full p-4 text-left border-b-4 border-black last:border-b-0 hover:bg-yellow-200 transition-colors duration-100 flex items-center gap-3"
        >
          {/* Poster Thumbnail */}
          <img
            src={movie.posterUrl}
            alt={`${movie.title} poster`}
            className="w-12 h-16 object-cover border-2 border-black flex-shrink-0"
            onError={(e) => {
              e.target.src = "/placeholder-poster.jpg"; // Optional: fallback image
            }}
          />

          {/* Movie Info */}
          <div className="flex-1">
            <div className="font-black text-black text-lg">{movie.title}</div>
            <div className="text-sm text-black font-bold">{movie.year}</div>
          </div>
        </button>
      ))}
    </div>
  );
};
