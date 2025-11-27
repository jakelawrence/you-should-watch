import React from "react";
import { useMovieCollection } from "../context/MovieCollectionContext";

export const GetSuggestedMovieButton = () => {
  const { handleGetSuggestedMovies, collectionItems } = useMovieCollection();

  const isDisabled = collectionItems.length === 0;

  return (
    <div className="flex justify-center">
      <button
        onClick={handleGetSuggestedMovies}
        disabled={isDisabled}
        className="w-full py-5 px-6 bg-blue-400 border-4 border-black text-black font-[1000] text-xl uppercase active:shadow-none "
      >
        Get Suggested Movies
      </button>
    </div>
  );
};
