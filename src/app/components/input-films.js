import React, { useState, useRef } from "react";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import RecommendedFilms from "./recommended-films"; // Import the new component
import { MovieCard } from "./movie-card";

const InputFilms = () => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [inputFilms, setInputFilms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState([
    {
      name: "Before Sunrise",
      avgRating: "4.32",
      posterUrl: "https://a.ltrbxd.com/resized/film-poster/5/1/9/7/4/51974-before-sunrise-0-140-0-210-crop.jpg?v=006e8fedea",
      link: "https://letterboxd.com/film/before-sunrise/",
      slug: "before-sunrise",
      score: 116.26279004752585,
    },
    {
      name: "Before Sunset",
      avgRating: "4.33",
      posterUrl: "https://a.ltrbxd.com/resized/film-poster/5/1/9/7/0/51970-before-sunset-0-140-0-210-crop.jpg?v=059bc2bbc0",
      link: "https://letterboxd.com/film/before-sunset/",
      slug: "before-sunset",
      score: 96.66298681386078,
    },
    {
      name: "In the Mood for Love",
      avgRating: "4.40",
      posterUrl: "https://a.ltrbxd.com/resized/sm/upload/g1/7l/2j/qk/tSRdvZY1waXrTeMqeLBmq9IRs08-0-140-0-210-crop.jpg?v=938633fc19",
      link: "https://letterboxd.com/film/in-the-mood-for-love/",
      slug: "in-the-mood-for-love",
      score: 92.68854655056933,
    },
    {
      name: "When Harry Met Sally...",
      avgRating: "4.06",
      posterUrl: "https://a.ltrbxd.com/resized/film-poster/5/1/4/8/5/51485-when-harry-met-sally--0-140-0-210-crop.jpg?v=2f277e2fe7",
      link: "https://letterboxd.com/film/when-harry-met-sally/",
      slug: "when-harry-met-sally",
      score: 91.65105837075048,
    },
    {
      name: "Carol",
      avgRating: "4.02",
      posterUrl: "https://a.ltrbxd.com/resized/film-poster/1/8/2/1/4/2/182142-carol-0-140-0-210-crop.jpg?v=41ac88b68e",
      link: "https://letterboxd.com/film/carol-2015/",
      slug: "carol-2015",
      score: 89.60235640648011,
    },
  ]);

  const carouselRef = useRef(null);

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setQuery(value);

    if (value.trim() !== "") {
      const response = await fetch(`/api/suggestions?query=${encodeURIComponent(value)}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      }
    } else {
      setSuggestions([]);
    }
  };

  const getSuggestions = async () => {
    setLoading(true);
    try {
      if (recommendations.length > 0) {
        setShowRecommendations(true);
      } else {
        const response = await fetch("/api/getSuggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputFilms }),
        });
        if (response.ok) {
          const data = await response.json();
          setRecommendations(data);
          setShowRecommendations(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFilm = (filmSlug, idx) => {
    setInputFilms((prev) => prev.filter((film) => film.slug !== filmSlug));
    const carousel = carouselRef.current;
    if (carousel) {
      const nextIndex = Math.max(0, idx - 1);
      carousel.moveTo(nextIndex);
    }
  };

  const handleFilmSelect = (film) => {
    if (!inputFilms.find((m) => m.slug === film.slug)) {
      setInputFilms((prev) => [...prev, film]);
    }
    setQuery("");
    setSuggestions([]);
  };

  return (
    <div>
      <div className="relative flex flex-col h-screen justify-end p-6">
        <div className="w-full relative">
          {suggestions.length > 0 && (
            <ul className="absolute bottom-full w-full bg-[#F4A261] shadow-md rounded mb-2">
              {suggestions.map((film) => (
                <li key={film.slug} onClick={() => handleFilmSelect(film)} className="flex items-center gap-4 p-2 cursor-pointer hover:bg-gray-100">
                  <img src={film.posterUrl} alt={film.name} className="w-12 h-16 object-cover rounded" />
                  <span>{film.name}</span>
                </li>
              ))}
            </ul>
          )}
          <input
            type="text"
            placeholder="Search for a film..."
            value={query}
            onChange={handleInputChange}
            className="w-full p-2 border border-[#E76F51] bg-white text-[#264653] rounded"
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );
};

export default InputFilms;
