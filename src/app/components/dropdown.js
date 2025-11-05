import React from "react";
import { useMovieCollection } from "../context/MovieCollectionContext";

export const Dropdown = ({ dropdownRef, searchResults, onMovieAdded }) => {
  const { addToCollection } = useMovieCollection();

  const handleAddMovie = (movie) => {
    addToCollection(movie);
    if (onMovieAdded) {
      onMovieAdded(); // This will clear the search
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="border-4 border-black bg-white overflow-hidden"
      style={{
        boxShadow: "8px 8px 0px 0px #000000",
      }}
    >
      <div className="max-h-96 overflow-y-auto">
        {searchResults.map((movie, idx) => (
          <button
            key={idx}
            onClick={() => handleAddMovie(movie)}
            className="w-full p-4 text-left border-b-4 border-black last:border-b-0 hover:bg-yellow-200 transition-colors duration-100"
          >
            <div className="font-black text-black text-lg">{movie.title}</div>
            <div className="text-sm text-black font-bold">{movie.year}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
