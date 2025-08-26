"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { NavigationBar } from "../components/navigation-bar";
import { MovieCollection } from "../components/movie-collection";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ITEMS_PER_PAGE = 16;

export default function BrowsePage() {
  const router = useRouter();
  const [collections, setCollections] = useState([]);
  const [displayedCollections, setDisplayedCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collectionItems, setCollectionItems] = useState([]);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [isCollectionMinimized, setIsCollectionMinimized] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef(null);

  const handleGetSuggestedMovies = async () => {
    let slugs = collectionItems.map((movie) => movie.slug).join(",");
    try {
      router.push("/suggested-films");
    } catch (error) {
      console.error("Failed to fetch suggested movies:", error);
    }
  };

  const loadMoreCollections = useCallback(() => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);
    const currentLength = displayedCollections.length;
    const nextCollections = collections.slice(currentLength, currentLength + ITEMS_PER_PAGE);

    setDisplayedCollections((prev) => [...prev, ...nextCollections]);
    setHasMore(currentLength + ITEMS_PER_PAGE < collections.length);
    setIsLoadingMore(false);
  }, [collections, displayedCollections.length, isLoadingMore]);

  useEffect(() => {
    const savedCollection = sessionStorage.getItem("userCollection");
    if (savedCollection) {
      setCollectionItems(JSON.parse(savedCollection));
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem("userCollection", JSON.stringify(collectionItems));
  }, [collectionItems]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [genresResponse, nanogenresResponse] = await Promise.all([fetch("/api/genres"), fetch("/api/nanogenres")]);

        if (!genresResponse.ok || !nanogenresResponse.ok) {
          throw new Error("Failed to fetch data");
        }
        const { genres } = await genresResponse.json();
        const { nanogenres } = await nanogenresResponse.json();
        console.log(genres);
        console.log(nanogenresResponse);
        if (!genres || !nanogenres) {
          throw new Error("Invalid data format");
        }

        const allCollections = [
          ...genres.map((genre) => ({
            name: genre.genre,
            type: "genre",
            slug: genre.genre.toLowerCase().replace(/\s+/g, "-"),
            movieCount: genre.movieCount,
            examples: genre.examples,
          })),

          ...nanogenres.map((nanogenre) => ({
            name: nanogenre.nanogenre.replace(/-/g, ", ").replace(/\b\w/g, (char) => char.toUpperCase()),
            type: "nanogenre",
            slug: nanogenre.nanogenre,
            movieCount: nanogenre.movieCount,
            examples: nanogenre.examples,
          })),
        ];

        allCollections.sort((a, b) => b.movieCount - a.movieCount);
        setCollections(allCollections);
        setDisplayedCollections(allCollections.slice(0, ITEMS_PER_PAGE));
        setHasMore(allCollections.length > ITEMS_PER_PAGE);
      } catch (err) {
        console.error("Error in fetchInitialData:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreCollections();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, loadMoreCollections]);

  if (loading) {
    return (
      <div className={`min-h-screen bg-background text-text-primary`}>
        {/* <NavigationBar collectionItemsCount={collectionItems.length} onCollectionClick={() => setIsCollectionOpen(!isCollectionOpen)} /> */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse text-text-secondary">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-background text-text-primary`}>
        {/* <NavigationBar collectionItemsCount={collectionItems.length} onCollectionClick={() => setIsCollectionOpen(!isCollectionOpen)} /> */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-danger bg-danger/10 px-4 py-2 rounded-lg">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background text-text-primary`}>
      {/* <NavigationBar collectionItemsCount={collectionItems.length} onCollectionClick={() => setIsCollectionOpen(!isCollectionOpen)} /> */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">Browse Movies</h1>
            <p className="text-text-secondary">Explore movies by genre and nanogenre</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {displayedCollections.map((collection) => (
              <Link
                key={collection.slug}
                href={`/browse/${collection.type}/${collection.slug}`}
                className="group block p-6 bg-background border border-border rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:border-primary"
              >
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-text-primary group-hover:text-primary transition-colors duration-200">
                    {collection.name}
                  </h2>
                  <p className="text-sm text-text-secondary">{collection.movieCount} movies</p>
                  <p className="text-sm text-text-secondary">
                    Examples: {collection.examples.slice(0, 2).join(", ")}
                    {collection.examples.length > 2 ? "..." : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <div ref={observerTarget} className="py-4 text-center">
            {isLoadingMore && <div className="animate-pulse text-text-secondary">Loading more...</div>}
            {!hasMore && displayedCollections.length > 0 && <div className="text-text-secondary">No more collections to load</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
