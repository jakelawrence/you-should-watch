"use client";

import { useState, useEffect } from "react";
import { Logo } from "../components/logo";
import { useMovieCollection } from "../context/MovieCollectionContext";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { SuggestedMoviesCarousel } from "../components/suggested-movies-carousel";

export default function SuggestedFilmsPage() {
  const { collectionItems } = useMovieCollection();
  const [suggestedMovies, setSuggestedMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();

  const handleBackClick = () => {
    router.push("/"); // Navigate to main page
    // Alternative: router.back(); // Go back to previous page
  };

  useEffect(() => {
    const loadSuggestedMovies = async () => {
      try {
        if (collectionItems.length == 0) {
          setError("No collection found. Please add movies to your collection first.");
          setLoading(false);
          return;
        }
        const slugs = collectionItems.map((movie) => movie.slug).join(",");

        // // Fetch suggested movies
        // const response = await fetch(`/api/getSuggestedMovies?slugs=${slugs}`);
        // if (!response.ok) {
        //   throw new Error("Failed to fetch suggested movies");
        // }

        // const data = await response.json();
        // console.log(JSON.stringify(data));
        setSuggestedMovies([
          {
            popularity: 114,
            avgRating: 4.26,
            nameLower: "alien",
            year: "1979",
            slug: "alien",
            link: "https://letterboxd.com/film/alien/",
            name: "Alien",
            posterUrl: "https://a.ltrbxd.com/resized/sm/upload/8v/f1/qw/aa/bg7K6VtUG7Ew70gQj6SSroD5d4R-0-140-0-210-crop.jpg?v=a932f9e98e",
            score: 72600.83333333333,
            genres: ["Horror", "Science Fiction"],
            actors: [],
          },
          {
            popularity: 492,
            avgRating: 3.73,
            nameLower: "suspiria",
            year: "2018",
            slug: "suspiria-2018",
            link: "https://letterboxd.com/film/suspiria-2018/",
            name: "Suspiria",
            posterUrl: "https://a.ltrbxd.com/resized/film-poster/2/9/3/0/6/6/293066-suspiria-0-140-0-210-crop.jpg?v=1e4a2f2d40",
            score: 67200.83333333333,
            genres: ["Mystery", "Horror", "Drama"],
            actors: [],
          },
          {
            popularity: 515,
            avgRating: 4.21,
            nameLower: "rosemary's baby",
            year: "1968",
            slug: "rosemarys-baby",
            link: "https://letterboxd.com/film/rosemarys-baby/",
            name: "Rosemary's Baby",
            posterUrl: "https://a.ltrbxd.com/resized/sm/upload/ea/vc/su/y2/fdLOXB8AysEGRL44I1RvoKiWDcW-0-140-0-210-crop.jpg?v=8e18e4f70c",
            score: 51450.833333333336,
            genres: ["Horror", "Drama", "Thriller"],
            actors: [],
          },
          {
            popularity: 196,
            avgRating: 4.26,
            nameLower: "mulholland drive",
            year: "2001",
            slug: "mulholland-drive",
            link: "https://letterboxd.com/film/mulholland-drive/",
            name: "Mulholland Drive",
            posterUrl: "https://a.ltrbxd.com/resized/sm/upload/kv/7n/p8/tv/fMC8JBWx2VjsJ53JopAcFjqmlYv-0-140-0-210-crop.jpg?v=3d69c00608",
            score: 51450.833333333336,
            genres: ["Thriller", "Drama", "Mystery"],
            actors: [],
          },
          {
            popularity: 395,
            avgRating: 3.85,
            nameLower: "carrie",
            year: "1976",
            slug: "carrie-1976",
            link: "https://letterboxd.com/film/carrie-1976/",
            name: "Carrie",
            posterUrl: "https://a.ltrbxd.com/resized/sm/upload/2c/5d/69/bc/uc3OvgmbnYaS5Y0BOjSmC1EmSz1-0-140-0-210-crop.jpg?v=52ac29973c",
            score: 51450.833333333336,
            genres: ["Horror", "Thriller"],
            actors: [],
          },
          {
            popularity: 295,
            avgRating: 4.02,
            nameLower: "the favourite",
            year: "2018",
            slug: "the-favourite",
            link: "https://letterboxd.com/film/the-favourite/",
            name: "The Favourite",
            posterUrl: "https://a.ltrbxd.com/resized/film-poster/3/1/0/7/0/5/310705-the-favourite-0-140-0-210-crop.jpg?v=c5488e37ef",
            score: 48600.833333333336,
            genres: ["Drama", "Comedy", "History", "Thriller"],
            actors: [],
          },
          {
            popularity: 218,
            avgRating: 3.69,
            nameLower: "bones and all",
            year: "2022",
            slug: "bones-and-all",
            link: "https://letterboxd.com/film/bones-and-all/",
            name: "Bones and All",
            posterUrl: "https://a.ltrbxd.com/resized/sm/upload/xi/cb/mo/xg/bones2-0-140-0-210-crop.jpg?v=bdb6694df9",
            score: 38400.833333333336,
            genres: ["Romance", "Horror", "Drama"],
            actors: [],
          },
          {
            popularity: 173,
            avgRating: 4.25,
            nameLower: "the prestige",
            year: "2006",
            slug: "the-prestige",
            link: "https://letterboxd.com/film/the-prestige/",
            name: "The Prestige",
            posterUrl: "https://a.ltrbxd.com/resized/film-poster/5/1/1/4/7/51147-the-prestige-0-140-0-210-crop.jpg?v=ad7e891177",
            score: 38400.833333333336,
            genres: ["Drama", "Mystery", "Science Fiction"],
            actors: [],
          },
          {
            popularity: 74,
            avgRating: 4.12,
            nameLower: "arrival",
            year: "2016",
            slug: "arrival-2016",
            link: "https://letterboxd.com/film/arrival-2016/",
            name: "Arrival",
            posterUrl: "https://a.ltrbxd.com/resized/sm/upload/3u/dy/qd/qd/4Iu5f2nv7huqvuYkmZvSPOtbFjs-0-140-0-210-crop.jpg?v=0fc28fdf2c",
            score: 38400.833333333336,
            genres: ["Mystery", "Drama", "Science Fiction"],
            actors: [],
          },
          {
            popularity: 115,
            avgRating: 4.3,
            nameLower: "prisoners",
            year: "2013",
            slug: "prisoners",
            link: "https://letterboxd.com/film/prisoners/",
            name: "Prisoners",
            posterUrl: "https://a.ltrbxd.com/resized/sm/upload/iw/eg/4g/nm/3w79tTsv6tmlT8Jww6snyPrgVok-0-140-0-210-crop.jpg?v=778c7ae8b8",
            score: 38400.833333333336,
            genres: ["Thriller", "Drama", "Crime"],
            actors: [],
          },
        ]);
      } catch (err) {
        setError("Failed to load suggested movies");
        console.error("Error loading suggested movies:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestedMovies();
  }, []);

  const handleGetSuggestedMovies = async () => {
    let slugs = collectionItems.map((movie) => movie.slug).join(",");
    try {
      router.push("/suggested-films");
    } catch (error) {
      console.error("Failed to fetch suggested movies:", error);
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < suggestedMovies.length - 1 ? prev + 1 : prev));
  };

  return (
    <div className="overflow-hidden bg-background text-text-primary min-h-screen">
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={handleBackClick}
            className="flex items-center gap-2 text-text-primary hover:text-primary transition-colors duration-200 bg-secondary hover:bg-secondary/80 px-4 py-2 rounded-lg"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Home</span>
          </button>
        </div>

        {/* Content Container */}
        <div className="w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto">
          <Logo />

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center min-h-[300px] sm:min-h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Error State */}
          {error && <div className="text-center text-danger text-sm sm:text-lg p-4 sm:p-6 bg-danger/10 rounded-lg mx-4">{error}</div>}

          {/* Empty State */}
          {!loading && !error && suggestedMovies.length === 0 && (
            <div className="text-center text-text-secondary text-sm sm:text-lg p-4 sm:p-6 bg-secondary rounded-lg mx-4">
              No suggested movies found. Try adding more movies to your collection.
            </div>
          )}

          {/* Suggestions Carousel */}
          {!loading && !error && suggestedMovies.length > 0 && <SuggestedMoviesCarousel suggestedMovies={suggestedMovies} />}
        </div>
      </main>
    </div>
  );
}
