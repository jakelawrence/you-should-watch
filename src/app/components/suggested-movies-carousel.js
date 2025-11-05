"use client";

import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { ArrowLeft } from "lucide-react";

export const SuggestedMoviesCarousel = ({ suggestedMovies }) => {
  return (
    <div className="w-full px-2 sm:px-4">
      {/* Title */}
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-text-primary mb-2">Suggested Movies</h2>
        <p className="text-text-secondary text-sm sm:text-base">Based on your movie collection</p>
      </div>

      {/* Carousel Container */}
      <div className="max-w-xs sm:max-w-sm md:max-w-md lg:max-w-2xl xl:max-w-4xl mx-auto">
        <Carousel
          swipeable={true}
          emulateTouch={true}
          dynamicHeight={false}
          infiniteLoop={true}
          thumbWidth={40}
          showThumbs={false} // Hide thumbnails on mobile
          showStatus={false}
          className="carousel-container"
          renderArrowPrev={(clickHandler, hasPrev) => (
            <button
              onClick={clickHandler}
              disabled={!hasPrev}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background text-text-primary p-2 sm:p-3 rounded-full shadow-lg transition-all duration-200 disabled:opacity-50"
            >
              <ArrowLeft size={16} className="sm:size-20" />
            </button>
          )}
          renderArrowNext={(clickHandler, hasNext) => (
            <button
              onClick={clickHandler}
              disabled={!hasNext}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background text-text-primary p-2 sm:p-3 rounded-full shadow-lg transition-all duration-200 disabled:opacity-50 rotate-180"
            >
              <ArrowLeft size={16} className="sm:size-20" />
            </button>
          )}
        >
          {suggestedMovies.map((film) => (
            <div className="p-2 sm:p-4 lg:p-6 flex flex-col items-center" key={film.slug}>
              {/* Movie Poster */}
              <div className="relative mb-4">
                <img
                  src={film.posterUrl.replace("-0-140-0-210-", "-0-1000-0-1500-")}
                  alt={film.title}
                  className="max-h-90 sm:max-h-64 md:max-h-80 lg:max-h-96 xl:max-h-[28rem] object-contain rounded-lg shadow-lg"
                />
              </div>

              {/* Movie Details */}
              <div className="text-center max-w-xs sm:max-w-sm md:max-w-md">
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-text-primary mb-2 line-clamp-2">{film.title}</h3>

                {film.year && <p className="text-text-secondary text-sm sm:text-base mb-2">{film.year}</p>}

                {film.genres && film.genres.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 sm:gap-2 mb-3">
                    {film.genres.slice(0, 3).map((genre, index) => (
                      <span key={index} className="bg-secondary text-text-secondary px-2 py-1 rounded text-xs sm:text-sm">
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                {film.rating && (
                  <div className="flex items-center justify-center gap-1 mb-3">
                    <span className="text-yellow-400">★</span>
                    <span className="text-text-primary text-sm sm:text-base font-medium">{film.rating.toFixed(1)}</span>
                  </div>
                )}

                {film.description && (
                  <p className="text-text-secondary text-xs sm:text-sm leading-relaxed line-clamp-3 sm:line-clamp-4">{film.description}</p>
                )}
              </div>
            </div>
          ))}
        </Carousel>
      </div>

      {/* Navigation Dots (for mobile) */}
      <div className="flex justify-center mt-6 sm:hidden">
        <div className="flex gap-2">
          {suggestedMovies.map((_, index) => (
            <div key={index} className="w-2 h-2 rounded-full bg-text-secondary/30" />
          ))}
        </div>
      </div>
    </div>
  );
};
