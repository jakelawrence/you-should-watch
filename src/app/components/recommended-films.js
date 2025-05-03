import React from "react";
import Image from "next/image";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";

const RecommendedFilms = ({ recommendations, onBack }) => {
  return (
    <div className="p-5">
      <button onClick={onBack} className="text-white px-4 py-1 rounded hover:bg-gray-600 mt-4 fixed top-0 left-4 z-50">
        ←
      </button>
      <h2 className="text-center text-2xl font-bold mb-4">Recommendations</h2>
      <Carousel swipeable={true}>
        {recommendations.map((movie) => (
          <MovieCard
            key={movie.slug}
            movie={movie}
            onAddToCollection={() => addToCollection(movie)}
            isInCollection={collectionItems.some((item) => item.slug === movie.slug)}
          />
        ))}
      </Carousel>
    </div>
  );
};

export default RecommendedFilms;
