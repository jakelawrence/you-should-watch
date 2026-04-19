import React, { useState } from "react";
import { RemoveScroll } from "react-remove-scroll";
import { X, Star, Bookmark, BookmarkCheck, Calendar, Clock } from "lucide-react";

export function MovieDetailsModal({ movie, providers, onClose, onToggleSave, isSaved, canSave }) {
  if (!movie) return null;

  return (
    <RemoveScroll>
      <div className="fixed inset-0 bg-fadedBlack/60 flex items-end sm:items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
        <div
          className="bg-background w-full sm:max-w-lg max-h-[88vh] overflow-y-auto border-t sm:border border-fadedBlack/15"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky header */}
          <div className="sticky z-100 top-0 bg-background border-b border-fadedBlack/10 p-4 flex items-center justify-between">
            <p className="font-black text-fadedBlack/60 bg-background text-xs uppercase tracking-widest">About This Film</p>
            <button
              onClick={onClose}
              className="bg-fadedBlack text-background p-2 hover:bg-fadedBlue border border-fadedBlack transition-colors"
            >
              <X size={18} strokeWidth={3} />
            </button>
          </div>

          <div className="p-6 space-y-5 z-40">
            <div>
              <h2 className="text-2xl font-black text-fadedBlack uppercase leading-tight">{movie.title?.replace(/\u00A0/g, " ")}</h2>
              {movie.tagline && (
                <p className="text-fadedBlack/70 text-sm font-bold mt-2 border-l-2 border-fadedBlack/20 pl-3 z-40">{movie.tagline}</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <Calendar size={18} strokeWidth={3} />, label: "Year", val: movie.year || "N/A" },
                { icon: <Clock size={18} strokeWidth={3} />, label: "Runtime", val: movie.duration ? `${movie.duration}m` : "N/A" },
                {
                  icon: <Star size={18} strokeWidth={3} className="fill-black" />,
                  label: "Rating",
                  val: movie.averageRating ? movie.averageRating.toFixed(1) : "N/A",
                },
              ].map(({ icon, label, val }) => (
                <div key={label} className="bg-backgroundSecondary border border-fadedBlack/10 p-3 text-center">
                  <div className="flex justify-center mb-1">{icon}</div>
                  <p className="text-fadedBlack font-black text-base">{val}</p>
                  <p className="text-fadedBlack/60 text-[10px] font-black uppercase mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Vibe meters */}
            <div className="border border-fadedBlack/10 p-4 bg-backgroundSecondary">
              <p className="text-fadedBlack text-xs font-black uppercase tracking-widest mb-3">Tone & Mood</p>
              {[
                { label: "Darkness", val: movie.darknessLevel },
                { label: "Intensity", val: movie.intensenessLevel },
                { label: "Funniness", val: movie.funninessLevel },
                { label: "Slow Burn", val: movie.slownessLevel },
              ].map(
                ({ label, val }) =>
                  val != null && (
                    <div key={label} className="flex items-center gap-3 mb-2 last:mb-0">
                      <span className="text-[10px] font-black uppercase w-16 text-fadedBlack/60">{label}</span>
                      <div className="flex-1 bg-fadedBlack/10 border border-fadedBlack/10 h-2.5 rounded-sm">
                        <div className="h-full bg-fadedBlack transition-all" style={{ width: `${(val / 10) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-black w-6 text-right text-fadedBlack">{val}</span>
                    </div>
                  ),
              )}
            </div>

            {/* Genre + Director */}
            {(movie.genres?.length > 0 || movie.genreNames?.length > 0) && (
              <div className="border border-fadedBlack/10 p-4 bg-backgroundSecondary">
                <p className="text-xs font-black uppercase mb-1 text-fadedBlack/60">Genre</p>
                <p className="font-bold text-base text-fadedBlack">{(movie.genres || movie.genreNames).join(", ")}</p>
              </div>
            )}
            {movie.director && (
              <div className="border border-fadedBlack/10 p-4 bg-backgroundSecondary">
                <p className="text-xs font-black uppercase mb-1 text-fadedBlack/60">Director</p>
                <p className="font-bold text-base text-fadedBlack">{movie.director}</p>
              </div>
            )}

            {/* Streaming */}
            {movie.streamingProviders?.length > 0 && (
              <div className="border border-fadedBlack/10 p-4 bg-backgroundSecondary">
                <p className="text-xs font-black uppercase mb-3 text-fadedBlack/60">Available On</p>
                <div className="flex flex-wrap gap-3">
                  {movie.streamingProviders
                    .filter((p) => !providers || providers.some((dp) => dp.provider_id === p.provider_id))
                    .map((p) => (
                      <div key={p.provider_id} className="flex flex-col items-center gap-1">
                        <img
                          src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                          alt={p.provider_name}
                          className="h-10 w-auto border border-fadedBlack/10"
                        />
                        <span className="text-[10px] font-bold text-fadedBlack">{p.provider_name}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <button
              onClick={onToggleSave}
              disabled={!canSave}
              className={`w-full py-3 font-black text-sm uppercase border-2 transition-colors flex items-center justify-center gap-2 ${
                !canSave
                  ? "bg-fadedBlack/5 text-fadedBlack/40 border-fadedBlack/20 cursor-not-allowed"
                  : isSaved
                    ? "bg-fadedBlack text-background border-fadedBlack hover:bg-background hover:text-fadedBlack"
                    : "bg-fadedBlack text-background border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue"
              }`}
            >
              {isSaved ? <BookmarkCheck size={16} strokeWidth={3} /> : <Bookmark size={16} strokeWidth={3} />}
              {isSaved ? "Remove from Saved" : "Save to My Movies"}
            </button>
            {!canSave && <p className="text-fadedBlack/50 text-[10px] font-bold text-center">Sign in to save movies.</p>}
          </div>
        </div>
      </div>
    </RemoveScroll>
  );
}
