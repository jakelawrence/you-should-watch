import React from "react";
import { Star, Plus } from "lucide-react";

export const MovieCard = ({ movie, onAddToCollection }) => {
  return (
    <div className="bg-background rounded-lg shadow-sm overflow-hidden">
      <div className="relative h-[400px]">
        <img
          src={movie.posterUrl.replace("-0-140-0-210-", "-0-1000-0-1500-")}
          alt={movie.name}
          className="w-full h-full object-contain"
          loading="lazy"
        />
        {onAddToCollection && (
          <button
            onClick={() => onAddToCollection(movie)}
            className="absolute top-2 right-2 p-2 bg-primary hover:bg-primary-light text-white rounded-full shadow-lg transition-colors"
            aria-label={`Add ${movie.name} to collection`}
          >
            <Plus size={20} />
          </button>
        )}
        {movie.rating && (
          <div className="absolute bottom-2 left-2 bg-background/90 text-text-primary px-2 py-1 rounded-lg flex items-center text-sm shadow-sm">
            <Star size={16} className="mr-1 text-yellow-400" /> {movie.rating.toFixed(1)}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-xl mb-2 line-clamp-1 text-text-primary">{movie.name}</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-sm text-text-secondary">{movie.year}</span>
          {movie.genres?.slice(0, 2).map((genre, index) => (
            <span key={index} className="text-sm text-text-secondary">
              {genre}
            </span>
          ))}
        </div>
        <p className="text-sm line-clamp-3 text-text-secondary leading-relaxed">{movie.description}</p>
      </div>
    </div>
  );
};
