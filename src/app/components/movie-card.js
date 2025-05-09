import React from "react";
import { Star, Plus } from "lucide-react";
import { MoviePoster } from "./movie-poster";
import { useMovieCollection } from "../contexts/MovieCollectionContext";

export const MovieCard = ({ movie }) => {
  const { addToCollection } = useMovieCollection();
  return (
    <div className="bg-background rounded-lg overflow-hidden">
      <MoviePoster movie={movie} />
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
