"use client";

import { useState } from "react";
import Link from "next/link";
import { useMovieCollection } from "../contexts/MovieCollectionContext";
import { Clapperboard } from "lucide-react";
import { Logo } from "./logo";
import addedToCollectionAlert from "./added-to-collection-alert";

export function NavigationBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { collectionItems, toggleCollection } = useMovieCollection();
  const { CollectionAlert } = addedToCollectionAlert();

  return (
    <>
      <div className="bg-background-card shadow-md text-text-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Logo />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Link
                href="/browse"
                className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium hover:border-primary hover:text-primary"
              >
                Browse
              </Link>
              <button
                onClick={toggleCollection}
                className="ml-3 p-2 rounded-full text-purple-600 hover:bg-background-hover relative"
                aria-label="View collection"
              >
                <Clapperboard size={20} />
                {collectionItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    {collectionItems.length}
                  </span>
                )}
              </button>

              {/* Mobile menu button */}
              <div className="sm:hidden ml-3">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-text-primary hover:bg-background-hover focus:outline-none"
                  aria-expanded="false"
                >
                  <span className="sr-only">Open main menu</span>
                  <svg
                    className={`${isMenuOpen ? "hidden" : "block"} h-6 w-6`}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <svg
                    className={`${isMenuOpen ? "block" : "hidden"} h-6 w-6`}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile menu, show/hide based on menu state */}
        <div className={`${isMenuOpen ? "block" : "hidden"} sm:hidden`}>
          <div className="pt-2 pb-3 space-y-1">
            <Link
              href="/"
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium hover:bg-background-hover hover:border-primary hover:text-primary"
            >
              Home
            </Link>
            <Link
              href="/browse"
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium hover:bg-background-hover hover:border-primary hover:text-primary"
            >
              Browse
            </Link>
            <Link
              href="/suggested-films"
              className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium hover:bg-background-hover hover:border-primary hover:text-primary"
            >
              Suggested Films
            </Link>
          </div>
        </div>
      </div>
      <CollectionAlert />
    </>
  );
}
