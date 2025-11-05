"use client";
import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Star, Clock, Calendar } from "lucide-react";

// Static test data
const TEST_MOVIES = [
  {
    averageRating: 3.04,
    director: "Kenji Kamiyama",
    length: 134,
    numberOfReviews: 111676,
    tagline: "Hope has yet to abandon these lands.",
    year: "2024",
    slug: "the-lord-of-the-rings-the-war-of-the-rohirrim",
    titleLower: "the lord of the rings: the war of the rohirrim",
    description:
      "A sudden attack by Wulf, a clever and traitorous lord of Rohan seeking vengeance for the death of his father, forces Helm Hammerhand, the King of Rohan, and his people to make a daring last stand in the ancient stronghold of the Hornburg.",
    posterUrl:
      "https://a.ltrbxd.com/resized/film-poster/7/5/4/1/1/5/754115-the-lord-of-the-rings-the-war-of-the-rohirrim-0-140-0-210-crop.jpg?v=375e344669",
    title: "The Lord of the Rings: The War of the Rohirrim",
    score: 2426.009047619048,
    genres: ["Action", "Fantasy", "Adventure", "Animation"],
    actors: [],
  },
  {
    averageRating: 3.55,
    director: "Ron Howard",
    length: 104,
    numberOfReviews: 834468,
    tagline: "You better watch out!",
    year: "2000",
    slug: "how-the-grinch-stole-christmas-2000",
    titleLower: "how the grinch stole christmas",
    description:
      "The Grinch decides to rob Whoville of Christmas - but a dash of kindness from little Cindy Lou Who and her family may be enough to melt his heart…",
    posterUrl: "https://a.ltrbxd.com/resized/film-poster/4/7/5/5/3/47553-the-grinch-0-140-0-210-crop.jpg?v=38c8815075",
    title: "How the Grinch Stole Christmas",
    score: 1390.3050780912793,
    genres: ["Fantasy", "Comedy", "Family"],
    actors: [],
  },
  {
    averageRating: 3.84,
    director: "Nick Park",
    length: 79,
    numberOfReviews: 404696,
    tagline: "New friends. Old enemies.",
    year: "2024",
    slug: "wallace-gromit-vengeance-most-fowl",
    titleLower: "wallace & gromit: vengeance most fowl",
    description:
      "Gromit's concern that Wallace is becoming too dependent on his inventions proves justified, when Wallace invents a smart gnome that seems to develop a mind of its own. When it emerges that a vengeful figure from the past might be masterminding things, it falls to Gromit to battle sinister forces and save his master… or Wallace may never be able to invent again!",
    posterUrl: "https://a.ltrbxd.com/resized/film-poster/8/3/4/5/6/1/834561-wallace-gromit-vengeance-most-fowl-0-140-0-210-crop.jpg?v=b5b3c56e5e",
    title: "Wallace & Gromit: Vengeance Most Fowl",
    score: 1017.063595890411,
    genres: ["Adventure", "Animation", "Family", "Comedy"],
    actors: [],
  },
  {
    averageRating: 3.69,
    director: "Robert Eggers",
    length: 133,
    numberOfReviews: 2167295,
    tagline: "Succumb to the darkness.",
    year: "2024",
    slug: "nosferatu-2024",
    titleLower: "nosferatu",
    description:
      "A gothic tale of obsession between a haunted young woman and the terrifying vampire infatuated with her, causing untold horror in its wake.",
    posterUrl: "https://a.ltrbxd.com/resized/film-poster/3/5/9/5/0/5/359505-nosferatu-2024-0-140-0-210-crop.jpg?v=a12d4ad648",
    title: "Nosferatu",
    score: 939.7509628378375,
    genres: ["Fantasy", "Horror", "Drama"],
    actors: [],
  },
  {
    averageRating: 4.09,
    director: "Joachim Trier",
    length: 128,
    numberOfReviews: 742710,
    tagline: "A journey of self-discovery.",
    year: "2021",
    slug: "the-worst-person-in-the-world",
    titleLower: "the worst person in the world",
    description:
      "The chronicles of four years in the life of Julie, a young woman who navigates the troubled waters of her love life and struggles to find her career path, leading her to take a realistic look at who she really is.",
    posterUrl: "https://a.ltrbxd.com/resized/film-poster/5/8/5/2/5/8/585258-the-worst-person-in-the-world-0-140-0-210-crop.jpg?v=92bc344c27",
    title: "The Worst Person in the World",
    score: 873.8579357798167,
    genres: ["Romance", "Comedy", "Drama"],
    actors: [],
  },
];

// Static color palettes for each movie
const TEST_COLORS = {
  "the-lord-of-the-rings-the-war-of-the-rohirrim": {
    dominant: "#8B4513",
    palette: ["#8B4513", "#D2691E", "#FFE4B5", "#2F4F4F"],
    background: "#8B4513",
    accent: "#FFE4B5",
    button: "#D2691E",
  },
  "how-the-grinch-stole-christmas-2000": {
    dominant: "#228B22",
    palette: ["#228B22", "#DC143C", "#FFD700", "#FFFFFF"],
    background: "#228B22",
    accent: "#DC143C",
    button: "#FFD700",
  },
  "wallace-gromit-vengeance-most-fowl": {
    dominant: "#FF8C00",
    palette: ["#FF8C00", "#8B4513", "#F5DEB3", "#4682B4"],
    background: "#FF8C00",
    accent: "#4682B4",
    button: "#F5DEB3",
  },
  "nosferatu-2024": {
    dominant: "#2C1810",
    palette: ["#2C1810", "#8B0000", "#D3D3D3", "#4A4A4A"],
    background: "#2C1810",
    accent: "#8B0000",
    button: "#D3D3D3",
  },
  "the-worst-person-in-the-world": {
    dominant: "#FF6B9D",
    palette: ["#FF6B9D", "#FFA07A", "#87CEEB", "#F0E68C"],
    background: "#FF6B9D",
    accent: "#87CEEB",
    button: "#FFA07A",
  },
};

const MovieSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [movies] = useState(TEST_MOVIES);
  const [extractedColors] = useState(TEST_COLORS);
  const [currentMovie, setCurrentMovie] = useState(TEST_MOVIES[0]);
  const [currentColors, setCurrentColors] = useState(TEST_COLORS[TEST_MOVIES[0].slug]);

  const nextSlide = useCallback(() => {
    if (isAnimating) return;
    let nextSlideIndex = (currentSlide + 1) % movies.length;
    setIsAnimating(true);
    setCurrentSlide(nextSlideIndex);
    setCurrentMovie(movies[nextSlideIndex]);
    setCurrentColors(extractedColors[movies[nextSlideIndex].slug]);
    setTimeout(() => setIsAnimating(false), 200);
  }, [isAnimating, movies.length, currentSlide, movies, extractedColors]);

  const prevSlide = useCallback(() => {
    if (isAnimating) return;
    let prevSlideIndex = (currentSlide - 1) % movies.length;
    if (prevSlideIndex === -1) prevSlideIndex = movies.length - 1;
    setIsAnimating(true);
    setCurrentSlide(prevSlideIndex);
    setCurrentMovie(movies[prevSlideIndex]);
    setCurrentColors(extractedColors[movies[prevSlideIndex].slug]);
    setTimeout(() => setIsAnimating(false), 200);
  }, [isAnimating, movies.length, currentSlide, movies, extractedColors]);

  const goToSlide = (index) => {
    if (isAnimating || index === currentSlide) return;
    setIsAnimating(true);
    setCurrentSlide(index);
    setCurrentMovie(movies[index]);
    setCurrentColors(extractedColors[movies[index].slug]);
    setTimeout(() => setIsAnimating(false), 200);
  };

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      prevSlide();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Main Card Container */}
        <div
          className="relative border-8 border-black p-6 md:p-12 transition-all duration-300 shadow-none md:shadow-[12px_12px_0px_0px_#000000]"
          style={{
            backgroundColor: currentColors.dominant,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Back Button */}
          <a
            href="http://localhost:3000/"
            className="inline-block mb-6 bg-white border-4 border-black px-6 py-3 text-black font-black text-sm uppercase tracking-wider hover:translate-x-1 hover:translate-y-1 transition-transform"
            style={{ boxShadow: "4px 4px 0px 0px #000000" }}
          >
            ← BACK
          </a>

          {/* Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center min-h-[600px]">
            {/* Movie Info Section */}
            <div className="order-2 md:order-1 space-y-6">
              <div className={`transition-all duration-200 ${isAnimating ? "opacity-0" : "opacity-100"}`}>
                {/* Title Card */}
                <div className="bg-white border-4 border-black p-6 mb-6" style={{ boxShadow: "6px 6px 0px 0px #000000" }}>
                  <h1 className="text-4xl md:text-6xl font-black text-black mb-3 uppercase tracking-tight">{currentMovie.title}</h1>
                  <p className="text-black text-lg font-bold leading-relaxed">{currentMovie.tagline}</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-yellow-300 border-4 border-black p-4 text-center" style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
                    <Calendar className="mx-auto mb-2 text-black" size={24} strokeWidth={3} />
                    <p className="text-black font-black text-lg">{currentMovie.year}</p>
                  </div>
                  <div className="bg-cyan-300 border-4 border-black p-4 text-center" style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
                    <Clock className="mx-auto mb-2 text-black" size={24} strokeWidth={3} />
                    <p className="text-black font-black text-lg">{currentMovie.length}m</p>
                  </div>
                  <div className="bg-pink-300 border-4 border-black p-4 text-center" style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
                    <Star className="mx-auto mb-2 text-black fill-black" size={24} strokeWidth={3} />
                    <p className="text-black font-black text-lg">{currentMovie.averageRating}/5</p>
                  </div>
                </div>

                {/* Info Cards */}
                <div className="space-y-4">
                  <div className="bg-white border-4 border-black p-4" style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
                    <span className="text-black text-sm font-black uppercase">Genre: </span>
                    <span className="text-black font-bold">{currentMovie.genres?.join(", ") || "N/A"}</span>
                  </div>
                  <div className="bg-white border-4 border-black p-4" style={{ boxShadow: "4px 4px 0px 0px #000000" }}>
                    <span className="text-black text-sm font-black uppercase">Director: </span>
                    <span className="text-black font-bold">{currentMovie.director}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Poster Section */}
            <div className="order-1 md:order-2 flex justify-center items-center">
              <button
                onClick={prevSlide}
                className="bg-white border-4 border-black w-16 h-16 flex items-center justify-center mr-8"
                style={{ boxShadow: "6px 6px 0px 0px #000000" }}
              >
                <ChevronLeft className="text-black" size={32} strokeWidth={3} />
              </button>

              <div className={`transition-all duration-200 ${isAnimating ? "opacity-0" : "opacity-100"}`}>
                {/* Poster Container */}
                <div
                  className="relative w-64 h-96 border-6 border-black overflow-hidden bg-white"
                  style={{
                    boxShadow: "12px 12px 0px 0px #000000",
                    transform: "rotate(-2deg)",
                  }}
                >
                  <img
                    src={currentMovie.posterUrl?.replace("-0-140-0-210-", "-0-1000-0-1500-") || currentMovie.posterUrl}
                    alt={`${currentMovie.title} poster`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <button
                onClick={nextSlide}
                className="bg-white border-4 border-black w-16 h-16 flex items-center justify-center ml-8"
                style={{
                  boxShadow: "6px 6px 0px 0px #000000",
                }}
              >
                <ChevronRight className="text-black" size={32} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>

        {/* Slide Indicators */}
        <div className="flex justify-center gap-3 mt-8">
          {movies.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-4 h-4 border-2 border-black transition-all ${index === currentSlide ? "bg-black" : "bg-white"}`}
              style={{ boxShadow: "2px 2px 0px 0px #000000" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MovieSlider;
