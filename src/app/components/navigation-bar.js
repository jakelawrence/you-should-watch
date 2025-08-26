"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./logo";
import { Clapperboard } from "lucide-react";
import { useMovieCollection } from "../context/MovieCollectionContext";

export function NavigationBar() {
  const router = useRouter();
  const { collectionItems, setIsCollectionOpen, isCollectionOpen } = useMovieCollection();
  return (
    <>
      {/* This spacer div keeps content from going under the fixed navbar */}
      <div className="h-16"></div>

      <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Logo />
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/browse")}
                className="text-text-secondary hover:text-text-primary px-3 py-2 rounded-md text-sm transition-colors"
              >
                Browse
              </button>
              <button
                onClick={() => setIsCollectionOpen(true)}
                className="relative text-text-secondary hover:text-text-primary px-3 py-2 rounded-md transition-colors"
              >
                <Clapperboard size={24} className="text-purple-600" />
                {collectionItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs/4 font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {collectionItems.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
