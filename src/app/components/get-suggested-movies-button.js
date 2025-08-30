import React from "react";
import { useMovieCollection } from "../context/MovieCollectionContext";

export const GetSuggestedMovieButton = () => {
  const { handleGetSuggestedMovies, collectionItems } = useMovieCollection();

  const isDisabled = collectionItems.length === 0;

  return (
    <div className="flex justify-center mb-6">
      <button
        onClick={handleGetSuggestedMovies}
        disabled={isDisabled}
        className={`
          flex items-center gap-2 px-6 py-3 text-white font-medium rounded-full transition-all duration-200 shadow-md
          ${
            isDisabled
              ? "bg-gray-400 cursor-not-allowed shadow-none"
              : "bg-gradient-to-r from-[#ff8000] to-[#40bcf4] hover:from-[#ff8000]/90 hover:to-[#40bcf4]/90 hover:shadow-lg"
          }
        `}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
            clipRule="evenodd"
          />
        </svg>
        Suggest Movies For Me
      </button>
    </div>
  );
};
