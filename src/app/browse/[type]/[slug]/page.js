"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MovieCard } from "../../../components/movie-card";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMovieCollection } from "../../../contexts/MovieCollectionContext";

export default function GenrePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Use the movie collection context
  const { collectionItems, isCollectionOpen, toggleCollection, closeCollection, addToCollection, removeFromCollection } = useMovieCollection();

  const { type, slug } = params;
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const moviesPerPage = parseInt(searchParams.get("limit") || "20", 10);

  const [movies, setMovies] = useState([]);
  const [totalMovies, setTotalMovies] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState("");

  // Available options for movies per page
  const perPageOptions = [24, 48, 64, 84];

  // Fetch movies for the genre/nanogenre
  useEffect(() => {
    const fetchMovies = async () => {
      try {
        setLoading(true);
        const queryParam = type === "genre" ? "genre" : "nanogenre";
        const offset = (currentPage - 1) * moviesPerPage;

        const response = await fetch(`/api/movies?${queryParam}=${encodeURIComponent(slug)}&limit=${moviesPerPage}&page=${currentPage}`);
        console.log(response);
        if (!response.ok) {
          throw new Error("Failed to fetch movies");
        }

        const data = await response.json();
        console.log(data);
        setMovies(data.movies || []);
        setTotalMovies(data.pagination.total);

        // Set the title based on the type and slug
        const formattedTitle =
          type === "genre"
            ? slug
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")
            : slug
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(", ");
        setTitle(formattedTitle);
      } catch (err) {
        console.error("Error fetching movies:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [type, slug, currentPage, moviesPerPage]);

  const navigateToPage = (page) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    router.push(`/browse/${type}/${slug}?${params.toString()}`);
  };

  const changeMoviesPerPage = (limit) => {
    const params = new URLSearchParams(searchParams);
    params.set("limit", limit.toString());
    params.set("page", "1"); // Reset to first page when changing limit
    router.push(`/browse/${type}/${slug}?${params.toString()}`);
  };

  // Calculate pagination values
  const totalPages = Math.ceil(totalMovies / moviesPerPage);
  const showingFrom = totalMovies === 0 ? 0 : (currentPage - 1) * moviesPerPage + 1;
  const showingTo = Math.min(currentPage * moviesPerPage, totalMovies);

  // Generate page numbers to display
  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if there are less than maxVisiblePages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Determine middle pages
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);

      // Adjust start and end to always show 3 pages in the middle
      if (currentPage <= 2) {
        endPage = 4;
      } else if (currentPage >= totalPages - 1) {
        startPage = totalPages - 3;
      }

      // Add ellipsis before middle pages if needed
      if (startPage > 2) {
        pages.push("...");
      }

      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Add ellipsis after middle pages if needed
      if (endPage < totalPages - 1) {
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse text-text-secondary">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-danger bg-danger/10 px-4 py-2 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/browse" className="mb-4 inline-block">
              ← Back to Browse
            </Link>
            <h1 className="text-3xl font-bold mt-2">{title}</h1>
            <p className="mt-2">
              Showing {showingFrom}-{showingTo} of {totalMovies} movies
            </p>
          </div>

          <div className="mt-4 sm:mt-0 flex items-center">
            <label htmlFor="moviesPerPage" className="mr-2 text-sm">
              Show:
            </label>
            <select
              id="moviesPerPage"
              value={moviesPerPage}
              onChange={(e) => changeMoviesPerPage(e.target.value)}
              className="bg-background-card text-text-primary border border-border-light rounded-md px-3 py-1.5 text-sm"
            >
              {perPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {movies.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {movies.map((movie) => (
              <MovieCard key={movie.slug} movie={movie} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-text-secondary">No movies found</div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-col items-center space-y-4">
            <div className="text-sm text-text-secondary">
              Page {currentPage} of {totalPages}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className={`p-2 rounded-md ${
                  currentPage === 1 ? "text-text-disabled cursor-not-allowed" : "text-text-primary hover:bg-background-card"
                }`}
                aria-label="Previous page"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="flex space-x-1">
                {generatePageNumbers().map((page, index) => (
                  <button
                    key={index}
                    onClick={() => typeof page === "number" && navigateToPage(page)}
                    disabled={page === "..." || page === currentPage}
                    className={`min-w-10 h-10 flex items-center justify-center rounded-md ${
                      page === currentPage
                        ? "bg-primary text-purple-600 font-medium"
                        : page === "..."
                        ? "text-text-secondary cursor-default"
                        : "hover:bg-background-card text-text-primary"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => navigateToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-md ${
                  currentPage === totalPages ? "text-text-disabled cursor-not-allowed" : "text-text-primary hover:bg-background-card"
                }`}
                aria-label="Next page"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
