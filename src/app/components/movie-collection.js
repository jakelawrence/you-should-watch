import React, { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Film, X } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";

export const MovieCollection = () => {
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
    <div
      ref={drawerRef}
      className={`fixed right-0 top-0 h-full w-80 bg-background border-l border-border shadow-lg transform transition-transform duration-300 z-50 ${
        isCollectionOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <Film size={20} className="mr-2 text-purple-600" />
            <h2 className="text-lg font-medium text-text-primary">Movie Collection ({collectionItems.length}/5)</h2>
          </div>
          <div className="flex space-x-2">
            <button onClick={() => setIsCollectionOpen(false)} className="text-text-secondary hover:text-text-primary">
              <X size={20} />
            </button>
          </div>
        </div>

        {!isCollectionMinimized && (
          <>
            <div className="space-y-4 mb-4">
              {collectionItems.length === 0 ? (
                <p className="text-text-secondary text-center py-4">Your collection is empty. Add up to 5 movies!</p>
              ) : (
                collectionItems.map((item) => (
                  <div key={item.slug} className="flex gap-3 items-center p-2 border-b border-border">
                    <img src={item.posterUrl} alt={item.name} className="w-12 h-16 object-cover rounded" />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-text-primary">{item.name}</h3>
                      <button onClick={() => removeFromCollection(item)} className="text-danger text-sm hover:text-danger/80">
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {collectionItems.length > 0 && (
              <button onClick={handleGetSuggestedMovies} className="w-full bg-black text-white py-2 rounded-lg mt-4 hover:bg-black/90 transition-all">
                Get Suggested Movies
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
