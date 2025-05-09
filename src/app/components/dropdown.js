import React from "react";

export const Dropdown = ({ dropdownRef, searchResults, addToCollection }) => {
  return (
    <div ref={dropdownRef} className="absolute z-10 w-full mt-2 bg-background rounded-xl shadow-lg border border-border overflow-y-auto">
      {searchResults.map((movie) => (
        <button
          key={movie.slug}
          onClick={() => addToCollection(movie)}
          className="w-full px-4 py-3 text-left hover:bg-secondary/50 transition-colors flex items-center justify-between border-b border-border last:border-0"
        >
          <div className="flex items-center space-x-3">
            <img src={movie.posterUrl} alt={movie.name} className="w-12 h-16 object-cover rounded flex-shrink-0" />
            <div>
              <div className="font-medium text-text-primary">{movie.name}</div>
              <div className="text-sm text-text-secondary">{movie.year}</div>
            </div>
          </div>
          <div className="text-primary font-medium">+</div>
        </button>
      ))}
    </div>
  );
};
