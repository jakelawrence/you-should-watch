// app/admin/add-movies/page.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Check, X } from "lucide-react";

export default function AddMoviesPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [slug, setSlug] = useState("");
  const [tmdbId, setTmdbId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/movies/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tmdbId: parseInt(tmdbId) }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Failed to add movie" });
        setIsSubmitting(false);
        return;
      }

      setMessage({ type: "success", text: `Successfully added movie: ${data.movie.title}` });
      setSlug("");
      setTmdbId("");
      setIsSubmitting(false);
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 py-8 lg:py-16">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <button onClick={() => router.push("/admin")} className="mb-6 text-black font-bold text-lg hover:underline flex items-center">
            <ArrowLeft className="mr-2" size={20} />
            Back to Dashboard
          </button>

          <h1
            className={`text-5xl sm:text-6xl lg:text-7xl font-black text-black leading-none transition-all duration-1000 ${
              isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
          >
            add movies
          </h1>
          <p className="text-lg font-bold text-black mt-4">Add new movies to the database using Letterboxd slug and TMDB ID</p>
        </div>

        {/* Form */}
        <div
          className={`bg-white border-4 border-black p-8 transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transitionDelay: "200ms" }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {message.text && (
              <div className={`border-4 border-black p-4 ${message.type === "success" ? "bg-green-200" : "bg-red-400"}`}>
                <div className="flex items-center">
                  {message.type === "success" ? (
                    <Check className="mr-2" size={24} strokeWidth={3} />
                  ) : (
                    <X className="mr-2" size={24} strokeWidth={3} />
                  )}
                  <p className="text-black font-black">{message.text}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-black font-black uppercase mb-2">Letterboxd Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                placeholder="the-dark-knight"
              />
              <p className="text-sm font-bold text-gray-600 mt-2">Example: For letterboxd.com/film/the-dark-knight, enter "the-dark-knight"</p>
            </div>

            <div>
              <label className="block text-black font-black uppercase mb-2">TMDB ID</label>
              <input
                type="number"
                value={tmdbId}
                onChange={(e) => setTmdbId(e.target.value)}
                required
                className="w-full border-4 border-black p-4 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-blue-200"
                placeholder="155"
              />
              <p className="text-sm font-bold text-gray-600 mt-2">Example: For themoviedb.org/movie/155, enter "155"</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-black text-white px-8 py-6 text-xl font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-50"
              style={{
                boxShadow: "8px 8px 0px 0px #000000",
              }}
            >
              {isSubmitting ? (
                "Adding Movie..."
              ) : (
                <>
                  <Plus className="inline mr-2" size={24} strokeWidth={3} />
                  Add Movie
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
