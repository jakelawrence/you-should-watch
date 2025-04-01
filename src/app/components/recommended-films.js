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
      <Carousel showArrows={true}>
        {recommendations.map((film) => (
          <div key={film.slug}>
            <img src={film.posterUrl.replace("-0-140-0-210-", "-0-1000-0-1500-")} alt={film.name} />
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export default RecommendedFilms;
